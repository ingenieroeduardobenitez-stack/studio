"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Search, 
  Loader2, 
  Download, 
  MoreHorizontal, 
  User, 
  LayoutList, 
  Users,
  UserCircle,
  UserPlus,
  Trash2,
  Check,
  CreditCard,
  BookOpen,
  Eye,
  CheckCircle2,
  AlertCircle,
  UserMinus,
  X,
  MessageCircle,
  FileText,
  Church
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, updateDoc, deleteDoc, serverTimestamp, addDoc, runTransaction } from "firebase/firestore"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { QRCodeCanvas } from "qrcode.react"

type ViewMode = "LIST" | "GROUPS"

export default function RegistrationsListPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("GROUPS")
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false)
  const [isProofViewOpen, setIsProofViewOpen] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [newGroupId, setNewGroupId] = useState<string>("")
  const [withdrawalReason, setWithdrawalReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const userProfileRef = useMemoFirebase(() => db && user?.uid ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc(userProfileRef)
  const isAdmin = profile?.role === "Administrador"
  const isTesorero = profile?.role === "Tesorero"

  const treasuryRef = useMemoFirebase(() => db ? doc(db, "settings", "treasury") : null, [db])
  const { data: treasurySettings } = useDoc(treasuryRef)

  const regsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "confirmations")
  }, [db, user])

  const groupsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "groups")
  }, [db, user])

  const { data: registrations, loading: loadingRegs } = useCollection(regsQuery)
  const { data: groups, loading: loadingGroups } = useCollection(groupsQuery)

  const filteredRegistrations = useMemo(() => {
    if (!registrations) return []
    return registrations.filter(reg => 
      !reg.isArchived && (
        reg.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reg.ciNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }, [registrations, searchTerm])

  const registrationsByGroup = useMemo(() => {
    if (!registrations || !groups) return {}
    
    const grouped: Record<string, any[]> = {}
    groups.forEach(g => { grouped[g.id] = [] })
    grouped["none"] = []

    filteredRegistrations.forEach(reg => {
      const gId = reg.groupId && grouped[reg.groupId] ? reg.groupId : "none"
      grouped[gId].push(reg)
    })

    return grouped
  }, [filteredRegistrations, groups])

  const handleValidatePayment = async () => {
    if (!db || !selectedReg || !treasuryRef) return
    setIsSubmitting(true)

    const catechistName = profile ? `${profile.firstName} ${profile.lastName}` : "Personal del Santuario"

    try {
      await runTransaction(db, async (transaction) => {
        const treasurySnap = await transaction.get(treasuryRef);
        if (!treasurySnap.exists()) throw "Settings not found";
        
        const currentNext = treasurySnap.data()?.nextReceiptNumber || 1;
        const formattedReceipt = `001-001-${String(currentNext).padStart(7, '0')}`;
        
        transaction.update(doc(db, "confirmations", selectedReg.id), {
          status: "INSCRITO",
          amountPaid: selectedReg.registrationCost || 0,
          paymentStatus: "PAGADO",
          validatedAt: serverTimestamp(),
          validatedBy: catechistName,
          receiptNumber: formattedReceipt
        });

        transaction.update(treasuryRef, { nextReceiptNumber: currentNext + 1 });

        const logRef = doc(collection(db, "audit_logs"));
        transaction.set(logRef, {
          userId: user?.uid || "unknown",
          userName: catechistName,
          action: "Validación de Pago",
          module: "tesoreria",
          details: `Se validó el pago de ${selectedReg.fullName}. Recibo: ${formattedReceipt}`,
          timestamp: serverTimestamp()
        });
      });

      toast({ title: "Pago Validado", description: "Se ha registrado el ingreso y el alumno está inscrito oficialmente." })
      setIsDetailsDialogOpen(false)
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error", description: "No se pudo realizar la validación." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAssignGroup = async () => {
    if (!db || !selectedReg || !newGroupId) return
    setIsSubmitting(true)

    const group = groups?.find(g => g.id === newGroupId)
    if (!group) return

    try {
      await updateDoc(doc(db, "confirmations", selectedReg.id), {
        groupId: newGroupId,
        attendanceDay: group.attendanceDay,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Grupo asignado", description: `${selectedReg.fullName} ahora pertenece a ${group.name}.` })
      setIsAssignDialogOpen(false)
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error", description: "No se pudo asignar el grupo." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleWithdrawConfirmand = async () => {
    if (!db || !selectedReg || !withdrawalReason) {
      toast({ variant: "destructive", title: "Atención", description: "Debes ingresar un motivo de baja." })
      return
    }
    
    setIsSubmitting(true)
    try {
      await updateDoc(doc(db, "confirmations", selectedReg.id), {
        status: "BAJA",
        isArchived: true,
        withdrawalReason: withdrawalReason,
        withdrawalDate: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      await addDoc(collection(db, "audit_logs"), {
        userId: user?.uid || "unknown",
        userName: profile ? `${profile.firstName} ${profile.lastName}` : "Administrador",
        action: "BAJA",
        module: "inscripcion",
        details: `Baja de ${selectedReg.fullName}. Motivo: ${withdrawalReason}`,
        timestamp: serverTimestamp()
      })

      toast({ title: "Confirmando dado de baja", description: "El ciclo ha sido cerrado correctamente." })
      setIsWithdrawDialogOpen(false)
      setWithdrawalReason("")
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error", description: "No se pudo procesar la baja." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteRegistration = async () => {
    if (!db || !selectedReg) return
    setIsSubmitting(true)

    try {
      await deleteDoc(doc(db, "confirmations", selectedReg.id))
      toast({ title: "Registro eliminado" })
      setIsDeleteDialogOpen(false)
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDownloadPDF = async () => {
    const element = document.getElementById("receipt-area-details");
    if (!element) return;
    
    setIsGeneratingPDF(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Recibo-Santuario-NSPS-${selectedReg?.fullName?.replace(/\s+/g, '-')}.pdf`);
      
      toast({ title: "Descarga completada", description: "El PDF ha sido generado correctamente." });
    } catch (err) {
      console.error("PDF Error:", err);
      toast({ variant: "destructive", title: "Error al generar PDF" });
    } finally {
      setIsGeneratingPDF(false);
    }
  }

  const handleShareReceipt = () => {
    if (!selectedReg) return
    const amount = selectedReg.amountPaid || 0;
    const pending = (selectedReg.registrationCost || 0) - amount;
    const receiptNum = selectedReg.receiptNumber || `001-001-${selectedReg.id?.slice(-7).padStart(7, '0')}`;
    const message = encodeURIComponent(`⛪ *Santuario Nacional Ntra. Sra. del Perpetuo Socorro*\n\n¡Hola *${selectedReg.fullName}*! Comprobante de *Catequesis de Confirmación 2026*.\n\n*Recibo Oficial N°:* ${receiptNum}\n*Monto registrado:* ${amount.toLocaleString('es-PY')} Gs.\n*Saldo:* ${pending === 0 ? '✅ CANCELADO' : `${pending.toLocaleString('es-PY')} Gs. PENDIENTE`}\n\n_Secretaría de Tesorería_`)
    window.open(`https://wa.me/${selectedReg.phone?.replace(/[^0-9]/g, '')}?text=${message}`, '_blank')
  }

  const openAssignDialog = (reg: any) => {
    setSelectedReg(reg)
    setNewGroupId(reg.groupId || "")
    setIsAssignDialogOpen(true)
  }

  const openWithdrawDialog = (reg: any) => {
    setSelectedReg(reg)
    setWithdrawalReason("")
    setIsWithdrawDialogOpen(true)
  }

  const openDeleteDialog = (reg: any) => {
    setSelectedReg(reg)
    setIsDeleteDialogOpen(true)
  }

  const openDetailsDialog = (reg: any) => {
    setSelectedReg(reg)
    setIsDetailsDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "INSCRITO": return <Badge className="bg-green-500 hover:bg-green-600">Inscrito</Badge>
      case "POR_VALIDAR": return <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">Por Validar</Badge>
      case "PENDIENTE_PAGO": return <Badge variant="outline" className="text-blue-500 border-blue-200">Pendiente Pago</Badge>
      case "OBSERVADO": return <Badge variant="destructive">Observado</Badge>
      case "BAJA": return <Badge variant="destructive" className="bg-slate-900">Baja</Badge>
      case "ARCHIVADO": return <Badge variant="outline" className="bg-slate-100">Archivado</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatCatechesisYear = (year: string) => {
    switch (year) {
      case "PRIMER_AÑO": return "1° Año"
      case "SEGUNDO_AÑO": return "2° Año"
      case "ADULTOS": return "Adultos"
      default: return year
    }
  }

  if (!mounted) return null

  const loading = loadingRegs || loadingGroups

  const today = new Date();
  const dayNum = today.getDate();
  const monthStr = today.toLocaleString('es-PY', { month: 'long' });
  const yearNum = today.getFullYear();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Lista de Confirmandos</h1>
          <p className="text-muted-foreground">Consulta y valida los registros del Santuario Nacional.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Button 
              variant={viewMode === "LIST" ? "default" : "ghost"} 
              size="sm" 
              className={cn("h-8 rounded-lg text-xs font-bold gap-2", viewMode === "LIST" ? "shadow-sm" : "text-slate-500")}
              onClick={() => setViewMode("LIST")}
            >
              <LayoutList className="h-3.5 w-3.5" /> Lista Plana
            </Button>
            <Button 
              variant={viewMode === "GROUPS" ? "default" : "ghost"} 
              size="sm" 
              className={cn("h-8 rounded-lg text-xs font-bold gap-2", viewMode === "GROUPS" ? "shadow-sm" : "text-slate-500")}
              onClick={() => setViewMode("GROUPS")}
            >
              <Users className="h-3.5 w-3.5" /> Por Grupos
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nombre o C.I..." 
              className="pl-9 bg-slate-50 border-none h-11 rounded-xl" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border shadow-sm">
            <User className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No se encontraron inscripciones activas.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Accordion type="multiple" defaultValue={["none", ...(groups?.map(g => g.id) || [])]} className="space-y-4">
              {registrationsByGroup["none"]?.length > 0 && (
                <AccordionItem value="none" className="border-none">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <AccordionTrigger className="px-6 h-16 hover:no-underline hover:bg-slate-50">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
                          <AlertCircle className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-slate-900">Pendientes de Grupo o Validación</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{registrationsByGroup["none"].length} registros</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0 border-t border-slate-50">
                      <StudentTable 
                        students={registrationsByGroup["none"]} 
                        formatYear={formatCatechesisYear} 
                        getBadge={getStatusBadge} 
                        isAdmin={isAdmin} 
                        onAssignGroup={openAssignDialog}
                        onWithdraw={openWithdrawDialog}
                        onDelete={openDeleteDialog}
                        onViewDetails={openDetailsDialog}
                      />
                    </AccordionContent>
                  </div>
                </AccordionItem>
              )}

              {groups?.map((group: any) => {
                const groupStudents = registrationsByGroup[group.id] || []
                if (groupStudents.length === 0 && searchTerm) return null
                
                return (
                  <AccordionItem key={group.id} value={group.id} className="border-none">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                      <AccordionTrigger className="px-6 h-16 hover:no-underline hover:bg-slate-50">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                            <Users className="h-5 w-5" />
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-900">{group.name}</p>
                              <Badge variant="secondary" className="text-[9px] h-4 uppercase tracking-tighter">
                                {formatCatechesisYear(group.catechesisYear)}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                              {group.attendanceDay}s • {groupStudents.length} confirmandos
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0 border-t border-slate-50">
                        <StudentTable 
                          students={groupStudents} 
                          formatYear={formatCatechesisYear} 
                          getBadge={getStatusBadge} 
                          isAdmin={isAdmin} 
                          onAssignGroup={openAssignDialog}
                          onWithdraw={openWithdrawDialog}
                          onDelete={openDeleteDialog}
                          onViewDetails={openDetailsDialog}
                        />
                      </AccordionContent>
                    </div>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </div>
        )}
      </div>

      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 border-2 border-white/20">
                  <AvatarImage src={selectedReg?.photoUrl} className="object-cover" />
                  <AvatarFallback className="bg-white/10 text-white"><User className="h-6 w-6" /></AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-xl font-bold uppercase tracking-tight">{selectedReg?.fullName}</DialogTitle>
                  <p className="text-sm text-white/80 font-medium">C.I. N° {selectedReg?.ciNumber}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {getStatusBadge(selectedReg?.status)}
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="max-h-[80vh]">
            <div className="p-6 space-y-8 bg-slate-50">
              <div className="flex justify-center bg-white p-4 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div 
                  className="w-full max-w-[700px] bg-white text-slate-900 font-serif border-2 border-slate-900 p-6 md:p-8 space-y-6 shadow-sm transform scale-[0.95] origin-top" 
                  id="receipt-area-details"
                >
                  <div className="grid grid-cols-3 gap-4 items-center mb-4">
                    <div className="col-span-2 border-2 border-slate-900 p-4 min-h-[120px] flex items-center justify-center relative bg-white">
                      <img 
                        src="/logo-recibo.png" 
                        alt="Santuario Nacional NSPS" 
                        className="max-h-24 object-contain"
                        onError={(e) => { e.currentTarget.src = "/logo.png" }}
                      />
                      <div className="absolute top-1 right-2 text-[7px] font-black uppercase tracking-tighter text-slate-400 text-right leading-tight">Santuario Nacional<br/>Nuestra Señora del Perpetuo Socorro</div>
                    </div>
                    <div className="flex flex-col gap-2 h-full justify-between">
                      <div className="border-2 border-slate-900 p-2 text-center bg-slate-50">
                        <p className="text-[10px] font-black uppercase">Gs.</p>
                        <p className="text-xl font-black">{(selectedReg?.amountPaid || 0).toLocaleString('es-PY')}</p>
                      </div>
                      <div className="border-2 border-slate-900 p-2 text-center bg-white">
                        <p className="text-[8px] font-bold uppercase">Recibo N°</p>
                        <p className="text-xs font-black">{selectedReg?.receiptNumber || `001-001-${selectedReg?.id?.slice(-7).padStart(7, '0')}`}</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-center border-b-2 border-slate-900 pb-2 mb-4">
                    <h1 className="text-3xl font-black italic tracking-tighter uppercase">RECIBO</h1>
                  </div>

                  <div className="space-y-6 text-sm md:text-base">
                    <div className="flex items-baseline gap-2">
                      <span className="whitespace-nowrap font-bold shrink-0">Recibí(mos) de:</span>
                      <div className="flex-1 border-b border-dotted border-slate-400 font-bold uppercase pb-0.5 px-2 leading-tight truncate">
                        {selectedReg?.fullName}
                      </div>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="whitespace-nowrap font-bold shrink-0">la cantidad de:</span>
                      <div className="flex-1 border-b border-dotted border-slate-400 pb-0.5 px-2 italic leading-tight">
                        {(selectedReg?.amountPaid || 0).toLocaleString('es-PY')} Guaraníes
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-baseline gap-2">
                        <span className="whitespace-nowrap font-bold shrink-0">en concepto de:</span>
                        <div className="flex-1 border-2 border-slate-900 px-4 py-2 font-bold text-xs bg-slate-50 uppercase leading-tight">
                          Inscripción Catequesis de Confirmación - {selectedReg?.catechesisYear?.replace('_', ' ')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="whitespace-nowrap font-bold shrink-0">en concepto de:</span>
                      <div className="flex-1 border-b border-dotted border-slate-400 pb-0.5 px-2 text-xs text-slate-500 italic leading-tight">
                        {((selectedReg?.registrationCost || 0) - (selectedReg?.amountPaid || 0)) > 0 
                          ? `Saldo Pendiente: ${((selectedReg?.registrationCost || 0) - (selectedReg?.amountPaid || 0)).toLocaleString('es-PY')} Gs.` 
                          : 'Totalmente cancelado.'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-10">
                    <div className="flex flex-col justify-end space-y-3">
                      <p className="text-sm italic font-medium">
                        Asunción, a los {dayNum} de {monthStr} de {yearNum}
                      </p>
                      <div className="flex flex-col items-start pt-4">
                        <div className="w-48 border-t border-slate-900"></div>
                        <p className="text-[8px] font-bold uppercase mt-1 tracking-widest">(Firma y aclaración)</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-3">
                      <div className="p-1.5 border border-slate-900 rounded-lg bg-white shadow-sm">
                        <QRCodeCanvas 
                          value={`VERIFICADO-NSPS-${selectedReg?.id}-${selectedReg?.amountPaid}-${selectedReg?.receiptNumber}`}
                          size={80}
                          level="H"
                        />
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black uppercase text-primary tracking-widest leading-none">Firma Digitalizada</p>
                        <p className="text-xs font-bold text-slate-900 uppercase mt-1">{selectedReg?.validatedBy || 'Secretaría del Santuario'}</p>
                        <p className="text-[8px] text-slate-500 font-bold uppercase">Catequesis de Confirmación</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                    <AlertCircle className="h-3 w-3" /> Comprobante Adjunto
                  </h4>
                  {selectedReg?.paymentProofUrl ? (
                    <div className="relative group rounded-2xl overflow-hidden border-2 border-slate-100 shadow-inner">
                      <img 
                        src={selectedReg.paymentProofUrl} 
                        alt="Comprobante" 
                        className="w-full h-auto cursor-pointer transition-transform hover:scale-105"
                        onClick={() => setIsProofViewOpen(true)}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <Eye className="text-white h-8 w-8" />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-8 rounded-2xl border border-dashed border-slate-200 text-center">
                      <p className="text-xs text-slate-400 font-bold uppercase">Sin comprobante</p>
                    </div>
                  )}
                </div>

                <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                    <UserCircle className="h-3 w-3" /> Información Alumno
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs"><span className="text-slate-500 font-bold">Celular:</span><span className="font-bold">{selectedReg?.phone}</span></div>
                    <div className="flex justify-between items-center text-xs"><span className="text-slate-500 font-bold">Madre:</span><span className="font-bold">{selectedReg?.motherName || '---'}</span></div>
                    <div className="flex justify-between items-center text-xs"><span className="text-slate-500 font-bold">Padre:</span><span className="font-bold">{selectedReg?.fatherName || '---'}</span></div>
                    <Separator />
                    <div className="flex justify-between items-center text-xs"><span className="text-slate-500 font-bold">Nivel:</span><Badge variant="outline" className="h-5 text-[9px]">{formatCatechesisYear(selectedReg?.catechesisYear)}</Badge></div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-slate-100 border-t flex flex-row justify-between gap-3">
            <Button variant="outline" className="rounded-xl px-8 h-12 font-bold" onClick={() => setIsDetailsDialogOpen(false)}>Cerrar</Button>
            
            <div className="flex gap-2">
              {selectedReg?.status === "POR_VALIDAR" && (isAdmin || isTesorero) && (
                <Button 
                  className="rounded-xl px-8 h-12 bg-green-600 hover:bg-green-700 font-bold gap-2 shadow-lg"
                  onClick={handleValidatePayment}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <><CheckCircle2 className="h-4 w-4" /> Validar Pago</>}
                </Button>
              )}
              <Button 
                className="rounded-xl px-8 h-12 bg-green-600 hover:bg-green-700 text-white font-bold gap-2 shadow-lg" 
                onClick={handleShareReceipt}
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
              <Button 
                className="rounded-xl px-8 h-12 bg-slate-900 text-white font-bold gap-2 shadow-lg" 
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
              >
                {isGeneratingPDF ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />} PDF
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <UserMinus className="h-6 w-6 text-red-400" />
              <DialogTitle>Dar de Baja a Confirmando</DialogTitle>
            </div>
            <DialogDescription className="text-slate-400">
              Cerrar el ciclo para: <span className="font-bold text-white">{selectedReg?.fullName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-800 leading-relaxed font-medium">
                Esta acción cerrará el ciclo del confirmando para el año actual en el Santuario Nacional. No podrá registrar asistencia ni aparecerá en las listas regulares.
              </p>
            </div>
            <div className="space-y-3">
              <Label className="font-bold text-slate-700">Justificar Baja (Motivo)</Label>
              <Textarea 
                placeholder="Ej. Abandono voluntario, mudanza, cambio de parroquia, etc." 
                className="rounded-xl min-h-[120px] bg-slate-50 border-slate-200 resize-none"
                value={withdrawalReason}
                onChange={(e) => setWithdrawalReason(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setIsWithdrawDialogOpen(false)}>Cancelar</Button>
            <Button 
              className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 font-bold shadow-lg"
              onClick={handleWithdrawConfirmand}
              disabled={isSubmitting || !withdrawalReason}
            >
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Confirmar Baja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProofViewOpen} onOpenChange={setIsProofViewOpen}>
        <DialogContent className="max-w-3xl p-0 bg-transparent border-none shadow-none flex items-center justify-center">
          <DialogHeader className="sr-only">
            <DialogTitle>Vista de Comprobante</DialogTitle>
            <DialogDescription>Imagen ampliada del comprobante de transferencia.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Button 
              variant="secondary" 
              size="icon" 
              className="absolute -top-12 -right-12 rounded-full h-10 w-10 bg-white/20 hover:bg-white/40 text-white"
              onClick={() => setIsProofViewOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>
            <img src={selectedReg?.paymentProofUrl} alt="Comprobante Full" className="max-h-[90vh] rounded-xl shadow-2xl" />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Asignar Grupo</DialogTitle>
            <DialogDescription>Selecciona un grupo correspondiente al nivel del alumno.</DialogDescription>
          </DialogHeader>
          <div className="py-4"><Select value={newGroupId} onValueChange={setNewGroupId}><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Elige un grupo" /></SelectTrigger><SelectContent>{groups?.filter(g => g.catechesisYear === selectedReg?.catechesisYear).map((g: any) => (<SelectItem key={g.id} value={g.id}>{g.name} ({g.attendanceDay}s)</SelectItem>))}</SelectContent></Select></div>
          <DialogFooter><Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancelar</Button><Button onClick={handleAssignGroup} disabled={isSubmitting || !newGroupId}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer y borrará permanentemente la ficha del Santuario Nacional.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteRegistration} className="bg-destructive text-white">Eliminar Definitivamente</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function StudentTable({ students, formatYear, getBadge, isAdmin, onAssignGroup, onWithdraw, onDelete, onViewDetails }: any) {
  return (
    <Table>
      <TableHeader className="bg-slate-50/30"><TableRow><TableHead className="w-[60px] pl-6"></TableHead><TableHead className="font-bold text-xs uppercase">Confirmando</TableHead><TableHead className="font-bold text-xs uppercase">C.I. N°</TableHead><TableHead className="font-bold text-xs uppercase">Año</TableHead><TableHead className="font-bold text-xs uppercase">Estado</TableHead><TableHead className="text-right font-bold text-xs uppercase pr-8">Acciones</TableHead></TableRow></TableHeader>
      <TableBody>
        {students.map((reg: any) => (
          <TableRow key={reg.id} className="hover:bg-slate-50/30 h-14">
            <TableCell className="pl-6"><Avatar className="h-8 w-8 border"><AvatarImage src={reg.photoUrl} /><AvatarFallback><User className="h-4 w-4" /></AvatarFallback></Avatar></TableCell>
            <TableCell><div className="flex flex-col"><span className="font-bold text-slate-900 text-xs">{reg.fullName}</span><span className="text-[10px] text-slate-500">{reg.phone}</span></div></TableCell>
            <TableCell className="text-xs">{reg.ciNumber}</TableCell>
            <TableCell><span className="text-[10px] font-bold text-slate-400">{formatYear(reg.catechesisYear)}</span></TableCell>
            <TableCell>{getBadge(reg.status)}</TableCell>
            <TableCell className="text-right pr-8">
              <div className="flex justify-end gap-2">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onViewDetails(reg)}><Eye className="h-4 w-4 text-slate-400" /></Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl p-2 shadow-xl border-none">
                    <DropdownMenuLabel className="text-[10px] uppercase text-slate-400 px-3 py-2">Opciones de Gestión</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => onAssignGroup(reg)} className="gap-2 h-10 rounded-lg"><UserPlus className="h-4 w-4" /> Asignar Grupo</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {isAdmin && (
                      <>
                        <DropdownMenuItem onClick={() => onWithdraw(reg)} className="text-orange-600 gap-2 h-10 rounded-lg"><UserMinus className="h-4 w-4" /> Dar de Baja</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(reg)} className="text-destructive gap-2 h-10 rounded-lg"><Trash2 className="h-4 w-4" /> Eliminar Ficha</DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
