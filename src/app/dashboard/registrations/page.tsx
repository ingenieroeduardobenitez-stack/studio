
"use client"

import { useState, useMemo, useEffect, useRef } from "react"
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
  Church,
  Image as ImageIcon,
  Edit,
  Save,
  Phone,
  Calendar,
  ShieldCheck,
  Book,
  Camera,
  Receipt
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
import Image from "next/image"

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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [newGroupId, setNewGroupId] = useState<string>("")
  const [withdrawalReason, setWithdrawalReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [viewProofUrl, setViewProofUrl] = useState<string | null>(null)
  
  // Estados para edición de fotos
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null)
  const [editBaptismPreview, setEditBaptismPreview] = useState<string | null>(null)
  const editPhotoInputRef = useRef<HTMLInputElement>(null)
  const editBaptismInputRef = useRef<HTMLInputElement>(null)

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

  const handleEditRegistration = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !selectedReg || isSubmitting) return
    setIsSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const updateData: any = {
      fullName: (formData.get("fullName") as string).toUpperCase(),
      ciNumber: formData.get("ciNumber") as string,
      phone: formData.get("phone") as string,
      birthDate: formData.get("birthDate") as string,
      motherName: (formData.get("motherName") as string).toUpperCase(),
      motherPhone: formData.get("motherPhone") as string,
      fatherName: (formData.get("fatherName") as string).toUpperCase(),
      fatherPhone: formData.get("fatherPhone") as string,
      tutorName: (formData.get("tutorName") as string).toUpperCase(),
      tutorPhone: formData.get("tutorPhone") as string,
      baptismParish: (formData.get("baptismParish") as string).toUpperCase(),
      baptismBook: formData.get("baptismBook") as string,
      baptismFolio: formData.get("baptismFolio") as string,
      updatedAt: serverTimestamp()
    }

    if (editPhotoPreview) updateData.photoUrl = editPhotoPreview;
    if (editBaptismPreview) updateData.baptismCertificatePhotoUrl = editBaptismPreview;

    try {
      await updateDoc(doc(db, "confirmations", selectedReg.id), updateData)
      toast({ title: "Registro Actualizado", description: "Los datos de la ficha han sido guardados." })
      setIsEditDialogOpen(false)
      setSelectedReg({ ...selectedReg, ...updateData })
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error al actualizar" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileEdit = (e: React.ChangeEvent<HTMLInputElement>, target: "photo" | "baptism") => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const b64 = reader.result as string
        if (target === "photo") setEditPhotoPreview(b64);
        else setEditBaptismPreview(b64);
      }
      reader.readAsDataURL(file)
    }
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

  const openEditDialog = (reg: any) => {
    setSelectedReg(reg)
    setEditPhotoPreview(null)
    setEditBaptismPreview(null)
    setIsEditDialogOpen(true)
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
                        onViewImage={(url: string) => { setViewProofUrl(url); setIsProofViewOpen(true); }}
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
                          onViewImage={(url: string) => { setViewProofUrl(url); setIsProofViewOpen(true); }}
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

      {/* DIÁLOGO DE FICHA DETALLADA */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[850px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl h-[95vh] max-h-[95vh] flex flex-col">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 md:gap-6">
                <div className="relative cursor-pointer hover:scale-105 transition-transform" onClick={() => { if(selectedReg?.photoUrl) { setViewProofUrl(selectedReg.photoUrl); setIsProofViewOpen(true); } }}>
                  <Avatar className="h-20 w-20 md:h-24 md:w-24 border-4 border-white/20 shadow-xl">
                    <AvatarImage src={selectedReg?.photoUrl} className="object-cover" />
                    <AvatarFallback className="bg-white/10 text-white"><User className="h-10 w-10 md:h-12 md:w-12" /></AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 -right-2">
                    {getStatusBadge(selectedReg?.status)}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-white/60 leading-none">Ficha Institucional</p>
                  <DialogTitle className="text-xl md:text-2xl font-black uppercase tracking-tight leading-tight truncate max-w-[250px] md:max-w-none">{selectedReg?.fullName}</DialogTitle>
                  <div className="flex flex-wrap items-center gap-2 md:gap-4 pt-1">
                    <Badge variant="outline" className="text-white border-white/30 font-bold gap-1 text-[10px]"><ShieldCheck className="h-3 w-3" /> C.I. {selectedReg?.ciNumber}</Badge>
                    <Badge variant="secondary" className="bg-white text-primary font-black uppercase tracking-tighter text-[10px]">{formatCatechesisYear(selectedReg?.catechesisYear)}</Badge>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 p-2 md:p-3 rounded-xl border border-white/10 hidden sm:block">
                <QRCodeCanvas value={`FICHA-${selectedReg?.id}`} size={50} level="H" />
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto bg-slate-50">
            <div className="p-6 md:p-8 space-y-8 pb-20">
              {/* SECCIÓN 1: DATOS PERSONALES */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                  <UserCircle className="h-5 w-5 text-primary" />
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Información Personal</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Fecha de Nacimiento</Label>
                    <p className="text-sm font-bold text-slate-700 flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-slate-400" /> {selectedReg?.birthDate || 'No registrada'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Edad Calculada</Label>
                    <p className="text-sm font-bold text-slate-700">{selectedReg?.age} Años</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Contacto (WhatsApp)</Label>
                    <p className="text-sm font-bold text-slate-700 flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-green-500" /> {selectedReg?.phone}</p>
                  </div>
                </div>
              </section>

              {/* SECCIÓN 2: FAMILIA Y TUTORES */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Familia y Tutores</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-2">
                    <p className="text-[8px] font-black text-primary uppercase tracking-tighter">Madre</p>
                    <p className="text-xs font-bold text-slate-700 truncate">{selectedReg?.motherName || 'No registrada'}</p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-2"><Phone className="h-3 w-3" /> {selectedReg?.motherPhone || 'Sin celular'}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-2">
                    <p className="text-[8px] font-black text-primary uppercase tracking-tighter">Padre</p>
                    <p className="text-xs font-bold text-slate-700 truncate">{selectedReg?.fatherName || 'No registrado'}</p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-2"><Phone className="h-3 w-3" /> {selectedReg?.fatherPhone || 'Sin celular'}</p>
                  </div>
                </div>
              </section>

              {/* SECCIÓN 3: SACRAMENTOS */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Registro Sacramental</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className={cn("p-4 rounded-2xl border flex items-start gap-4", selectedReg?.hasBaptism ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100")}>
                    <div className={cn("p-2 rounded-xl shrink-0", selectedReg?.hasBaptism ? "bg-green-500 text-white" : "bg-red-500 text-white")}>
                      <Church className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-tighter">Bautismo</p>
                      <p className="text-[10px] font-bold text-slate-600 mt-0.5">{selectedReg?.hasBaptism ? 'Sacramento Realizado' : 'Pendiente / Requiere curso'}</p>
                      {selectedReg?.hasBaptism && (
                        <div className="mt-2 space-y-0.5 text-[9px] font-medium text-slate-500 leading-tight">
                          <p className="truncate">Parroquia: {selectedReg.baptismParish}</p>
                          <p>Libro: {selectedReg.baptismBook} • Folio: {selectedReg.baptismFolio}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={cn("p-4 rounded-2xl border flex items-start gap-4", selectedReg?.hasFirstCommunion ? "bg-blue-50 border-blue-100" : "bg-orange-50 border-orange-100")}>
                    <div className={cn("p-2 rounded-xl shrink-0", selectedReg?.hasFirstCommunion ? "bg-blue-500 text-white" : "bg-orange-500 text-white")}>
                      <Book className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-tighter">Primera Comunión</p>
                      <p className="text-[10px] font-bold text-slate-600 mt-0.5">
                        {selectedReg?.hasFirstCommunion ? 'Sacramento Realizado' : 'Pendiente / Nivelación obligatoria'}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* SECCIÓN 4: DOCUMENTOS Y RECIBO OFICIAL */}
              <section className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Documentación y Comprobantes</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* DOCUMENTOS ADJUNTOS */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archivos Adjuntos</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[8px] font-black text-slate-400 uppercase">Comprobante Alumno</Label>
                        <div 
                          className="aspect-[4/3] rounded-xl border-2 border-dashed border-slate-200 overflow-hidden bg-white cursor-pointer hover:border-primary transition-all group relative"
                          onClick={() => { if(selectedReg?.paymentProofUrl) { setViewProofUrl(selectedReg.paymentProofUrl); setIsProofViewOpen(true); } }}
                        >
                          {selectedReg?.paymentProofUrl ? (
                            <img src={selectedReg.paymentProofUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-1">
                              <ImageIcon className="h-6 w-6" />
                              <span className="text-[8px]">Sin archivo</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[8px] font-black text-slate-400 uppercase">Cert. Bautismo</Label>
                        <div 
                          className="aspect-[4/3] rounded-xl border-2 border-dashed border-slate-200 overflow-hidden bg-white cursor-pointer hover:border-primary transition-all group relative"
                          onClick={() => { if(selectedReg?.baptismCertificatePhotoUrl) { setViewProofUrl(selectedReg.baptismCertificatePhotoUrl); setIsProofViewOpen(true); } }}
                        >
                          {selectedReg?.baptismCertificatePhotoUrl ? (
                            <img src={selectedReg.baptismCertificatePhotoUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-1">
                              <ImageIcon className="h-6 w-6" />
                              <span className="text-[8px]">Sin archivo</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RECIBO OFICIAL (MINI PREVIEW) */}
                  {selectedReg?.receiptNumber && (
                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recibo Oficial del Santuario</p>
                      <div className="bg-white border-2 border-slate-900 p-4 rounded-xl shadow-sm space-y-4 relative overflow-hidden group">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <Church className="h-6 w-6 text-primary" />
                          <div className="text-right">
                            <p className="text-[8px] font-black uppercase text-primary">Recibo Oficial</p>
                            <p className="text-[10px] font-black">{selectedReg.receiptNumber}</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[8px] uppercase text-slate-400 font-bold">Concepto</p>
                          <p className="text-[10px] font-bold text-slate-700 leading-tight">Inscripción Catequesis 2026 - {formatCatechesisYear(selectedReg.catechesisYear)}</p>
                        </div>
                        <div className="flex items-end justify-between">
                          <div className="space-y-1">
                            <p className="text-[8px] uppercase text-slate-400 font-bold">Monto Total</p>
                            <p className="text-sm font-black text-slate-900">{selectedReg.amountPaid?.toLocaleString('es-PY')} Gs.</p>
                          </div>
                          <div className="p-1 bg-slate-50 border rounded-lg">
                            <QRCodeCanvas value={`RECIBO-${selectedReg.receiptNumber}`} size={35} level="H" />
                          </div>
                        </div>
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <p className="text-[8px] text-slate-400 italic">Validado por: {selectedReg.validatedBy}</p>
                          <Badge variant="outline" className="text-[7px] h-4 bg-green-50 text-green-600 border-green-100">VÁLIDO</Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>

          <DialogFooter className="p-4 md:p-6 bg-white border-t flex flex-row justify-between gap-3 shrink-0">
            <Button variant="outline" className="rounded-xl px-4 md:px-8 h-11 md:h-12 font-bold text-xs md:text-sm" onClick={() => setIsDetailsDialogOpen(false)}>Cerrar</Button>
            
            <div className="flex gap-2">
              <Button 
                variant="secondary"
                className="rounded-xl px-4 md:px-8 h-11 md:h-12 bg-slate-100 text-slate-700 border shadow-sm font-bold gap-2 hover:bg-slate-200 text-xs md:text-sm"
                onClick={() => openEditDialog(selectedReg)}
              >
                <Edit className="h-4 w-4 text-primary" /> Editar Ficha
              </Button>
              {selectedReg?.status === "POR_VALIDAR" && (isAdmin || isTesorero) && (
                <Button 
                  className="rounded-xl px-4 md:px-8 h-11 md:h-12 bg-green-600 hover:bg-green-700 font-bold gap-2 shadow-lg text-xs md:text-sm"
                  onClick={handleValidatePayment}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <><CheckCircle2 className="h-4 w-4" /> Validar Pago</>}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE EDICIÓN CON CARGA DE FOTOS */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[750px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl h-[90vh] max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5" /> Actualizar Ficha de Inscripción</DialogTitle>
            <DialogDescription className="text-slate-400">Corrige datos o completa fotos faltantes de {selectedReg?.fullName}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditRegistration} className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 bg-white space-y-10 pb-20">
              {/* BLOQUE FOTOS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <Label className="text-[10px] font-black text-primary uppercase tracking-widest">Foto de Perfil</Label>
                  <div className="flex flex-col items-center gap-4 p-4 border rounded-2xl bg-slate-50 border-dashed">
                    <Avatar className="h-32 w-32 border-4 border-white shadow-md">
                      <AvatarImage src={editPhotoPreview || selectedReg?.photoUrl} className="object-cover" />
                      <AvatarFallback><User className="h-12 w-12" /></AvatarFallback>
                    </Avatar>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" className="rounded-xl h-9 gap-2" onClick={() => editPhotoInputRef.current?.click()}>
                        <Camera className="h-4 w-4" /> Cambiar Foto
                      </Button>
                      <input type="file" ref={editPhotoInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileEdit(e, "photo")} />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <Label className="text-[10px] font-black text-primary uppercase tracking-widest">Certificado de Bautismo</Label>
                  <div className="flex flex-col items-center gap-4 p-4 border rounded-2xl bg-slate-50 border-dashed">
                    <div className="h-32 w-44 rounded-xl bg-white border overflow-hidden flex items-center justify-center relative">
                      {editBaptismPreview || selectedReg?.baptismCertificatePhotoUrl ? (
                        <img src={editBaptismPreview || selectedReg.baptismCertificatePhotoUrl} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-10 w-10 text-slate-200" />
                      )}
                    </div>
                    <Button type="button" size="sm" variant="outline" className="rounded-xl h-9 gap-2" onClick={() => editBaptismInputRef.current?.click()}>
                      <ImageIcon className="h-4 w-4" /> Subir Certificado
                    </Button>
                    <input type="file" ref={editBaptismInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => handleFileEdit(e, "baptism")} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* BLOQUE 1: PERSONALES */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Información Personal</h4>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Nombre Completo</Label>
                    <Input name="fullName" defaultValue={selectedReg?.fullName} required className="h-11 rounded-xl uppercase font-bold" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>C.I. N°</Label><Input name="ciNumber" defaultValue={selectedReg?.ciNumber} required className="h-11 rounded-xl" /></div>
                    <div className="space-y-2"><Label>Celular</Label><Input name="phone" defaultValue={selectedReg?.phone} required className="h-11 rounded-xl" /></div>
                  </div>
                  <div className="space-y-2"><Label>Fecha de Nacimiento</Label><Input type="date" name="birthDate" defaultValue={selectedReg?.birthDate} required className="h-11 rounded-xl" /></div>
                </div>
              </div>

              <Separator />

              {/* BLOQUE 2: FAMILIA */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Familia y Tutores</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3 p-4 bg-slate-50 rounded-2xl">
                    <Label className="text-xs font-bold text-primary">MADRE</Label>
                    <Input name="motherName" defaultValue={selectedReg?.motherName} placeholder="Nombre" className="h-10 uppercase bg-white" />
                    <Input name="motherPhone" defaultValue={selectedReg?.motherPhone} placeholder="Celular" className="h-10 bg-white" />
                  </div>
                  <div className="space-y-3 p-4 bg-slate-50 rounded-2xl">
                    <Label className="text-xs font-bold text-primary">PADRE</Label>
                    <Input name="fatherName" defaultValue={selectedReg?.fatherName} placeholder="Nombre" className="h-10 uppercase bg-white" />
                    <Input name="fatherPhone" defaultValue={selectedReg?.fatherPhone} placeholder="Celular" className="h-10 bg-white" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* BLOQUE 3: BAUTISMO */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Registro Sacramental</h4>
                <div className="grid gap-4 p-6 bg-slate-50 rounded-2xl border border-dashed border-primary/30">
                  <div className="space-y-2"><Label>Parroquia de Bautismo</Label><Input name="baptismParish" defaultValue={selectedReg?.baptismParish} className="h-11 rounded-xl uppercase bg-white" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>N° de Libro</Label><Input name="baptismBook" defaultValue={selectedReg?.baptismBook} className="h-11 rounded-xl bg-white" /></div>
                    <div className="space-y-2"><Label>N° de Folio</Label><Input name="baptismFolio" defaultValue={selectedReg?.baptismFolio} className="h-11 rounded-xl bg-white" /></div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3 shrink-0">
              <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-black font-bold gap-2 shadow-lg" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />} Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
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
            <DialogTitle>Vista de Documento</DialogTitle>
            <DialogDescription>Imagen ampliada del documento adjunto.</DialogDescription>
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
            <img src={viewProofUrl || ""} alt="Documento Full" className="max-h-[90vh] rounded-xl shadow-2xl" />
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

function StudentTable({ students, formatYear, getBadge, isAdmin, onAssignGroup, onWithdraw, onDelete, onViewDetails, onViewImage }: any) {
  return (
    <Table>
      <TableHeader className="bg-slate-50/30"><TableRow><TableHead className="w-[60px] pl-6"></TableHead><TableHead className="font-bold text-xs uppercase">Confirmando</TableHead><TableHead className="font-bold text-xs uppercase">C.I. N°</TableHead><TableHead className="font-bold text-xs uppercase">Año</TableHead><TableHead className="font-bold text-xs uppercase">Estado</TableHead><TableHead className="text-right font-bold text-xs uppercase pr-8">Acciones</TableHead></TableRow></TableHeader>
      <TableBody>
        {students.map((reg: any) => (
          <TableRow key={reg.id} className="hover:bg-slate-50/30 h-14">
            <TableCell className="pl-6">
              <Avatar 
                className="h-8 w-8 border cursor-pointer hover:scale-110 transition-transform" 
                onClick={() => reg.photoUrl && onViewImage(reg.photoUrl)}
              >
                <AvatarImage src={reg.photoUrl} className="object-cover" />
                <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
              </Avatar>
            </TableCell>
            <TableCell><div className="flex flex-col"><span className="font-bold text-slate-900 text-xs">{reg.fullName}</span><span className="text-[10px] text-slate-500">{reg.phone}</span></div></TableCell>
            <TableCell className="text-xs">{reg.ciNumber}</TableCell>
            <TableCell><span className="text-[10px] font-bold text-slate-400">{formatYear(reg.catechesisYear)}</span></TableCell>
            <TableCell>{getBadge(reg.status)}</TableCell>
            <TableCell className="text-right pr-8">
              <div className="flex justify-end gap-2">
                <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm" onClick={() => onViewDetails(reg)}><Eye className="h-4 w-4" /></Button>
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
