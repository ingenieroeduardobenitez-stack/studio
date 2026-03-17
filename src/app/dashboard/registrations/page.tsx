
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Search, 
  Loader2, 
  MoreHorizontal, 
  User, 
  Trash2, 
  Eye,
  AlertTriangle,
  FilterX,
  Download,
  Users,
  Banknote,
  ArrowRightLeft,
  FileText,
  MessageCircle,
  Church,
  Save,
  UserMinus,
  CheckCircle2,
  X,
  ImageIcon,
  Info,
  Shapes,
  CreditCard,
  RotateCcw,
  Plus
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, deleteDoc, updateDoc, serverTimestamp, query, orderBy, runTransaction, addDoc } from "firebase/firestore"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function RegistrationsListPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  const [filterSex, setFilterSex] = useState<string>("all")
  const [filterYear, setFilterYear] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterOrigin, setFilterOrigin] = useState<string>("all")
  const [filterDay, setFilterDay] = useState<string>("all")
  const [filterMethod, setFilterMethod] = useState<string>("all")
  
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isRevertDialogOpen, setIsRevertDialogOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false)
  const [isValidatingProofOpen, setIsValidatingProofOpen] = useState(false)
  const [withdrawalReason, setWithdrawalReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()

  useEffect(() => { 
    setMounted(true)
  }, [])

  const regsQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "confirmations")
  }, [db])

  const groupsQuery = useMemoFirebase(() => db ? collection(db, "groups") : null, [db])
  const usersQuery = useMemoFirebase(() => db ? collection(db, "users") : null, [db])
  const treasuryRef = useMemoFirebase(() => db ? doc(db, "settings", "treasury") : null, [db])

  const { data: rawData, loading } = useCollection(regsQuery)
  const { data: allGroups } = useCollection(groupsQuery)
  const { data: allUsers } = useCollection(usersQuery)

  const registrations = useMemo(() => {
    if (!rawData) return []
    return [...rawData]
      .filter(r => r.isArchived !== true)
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0))
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0))
        return dateB.getTime() - dateA.getTime()
      })
  }, [rawData])

  const userProfileRef = useMemoFirebase(() => db && user?.uid ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc(userProfileRef)

  const stats = useMemo(() => {
    if (!registrations) return { total: 0, masc: 0, fem: 0 }
    return {
      total: registrations.length,
      masc: registrations.filter(r => r.sexo === "M").length,
      fem: registrations.filter(r => r.sexo === "F").length
    }
  }, [registrations])

  const duplicateCis = useMemo(() => {
    if (!registrations) return new Set<string>()
    const counts: Record<string, number> = {}
    registrations.forEach(r => {
      if (r.ciNumber) {
        const cleanCi = r.ciNumber.replace(/[^0-9]/g, '')
        counts[cleanCi] = (counts[cleanCi] || 0) + 1
      }
    })
    return new Set(Object.keys(counts).filter(ci => counts[ci] > 1))
  }, [registrations])

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r: any) => {
      const cleanCi = r.ciNumber?.replace(/[^0-9]/g, '') || ""
      const matchesSearch = !searchTerm || 
        r.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        cleanCi.includes(searchTerm.replace(/[^0-9]/g, ''))
      
      const isRepetido = duplicateCis.has(cleanCi)
      const matchesSex = filterSex === "all" || r.sexo === filterSex
      const matchesYear = filterYear === "all" || r.catechesisYear === filterYear
      const matchesStatus = filterStatus === "all" || (filterStatus === "REPETIDO" ? isRepetido : r.status === filterStatus)
      const matchesOrigin = filterOrigin === "all" || (filterOrigin === "MANUAL" ? r.userId !== "public_registration" : r.userId === "public_registration")
      const matchesDay = filterDay === "all" || r.attendanceDay === filterDay
      const matchesMethod = filterMethod === "all" || r.paymentMethod === filterMethod

      return matchesSearch && matchesSex && matchesYear && matchesStatus && matchesOrigin && matchesDay && matchesMethod
    })
  }, [registrations, searchTerm, filterSex, filterYear, filterStatus, filterOrigin, filterDay, filterMethod, duplicateCis])

  const handleOpenDetails = (reg: any) => {
    setSelectedReg(reg)
    setIsDetailsOpen(true)
  }

  const handleQuickValidate = async (reg: any) => {
    if (!db || !treasuryRef || isProcessing) return
    setIsProcessing(true)
    const regRef = doc(db, "confirmations", reg.id)
    const catechistName = profile ? `${profile.firstName} ${profile.lastName}` : "Tesorero"
    
    try {
      await runTransaction(db, async (transaction) => {
        const treasurySnap = await transaction.get(treasuryRef);
        const currentNext = treasurySnap.exists() ? (treasurySnap.data()?.nextReceiptNumber || 1) : 1;
        const formattedReceipt = `001-001-${String(currentNext).padStart(7, '0')}`;
        const regCost = reg.registrationCost || (reg.catechesisYear === "ADULTOS" ? 50000 : 35000);

        transaction.update(regRef, {
          amountPaid: regCost,
          paymentStatus: "PAGADO",
          status: "INSCRITO",
          validatedBy: catechistName,
          receiptNumber: formattedReceipt,
          lastPaymentDate: serverTimestamp(),
          lastPaymentMethod: reg.paymentMethod || "TRANSFERENCIA"
        });
        transaction.update(treasuryRef, { nextReceiptNumber: currentNext + 1 });
      });
      toast({ title: "Validación completada con éxito" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error al validar" })
    } finally { setIsProcessing(false) }
  }

  const handleRevertValidation = async () => {
    if (!db || !selectedReg || isProcessing) return
    setIsProcessing(true)
    const regRef = doc(db, "confirmations", selectedReg.id)
    
    try {
      await updateDoc(regRef, {
        status: "POR_VALIDAR",
        paymentStatus: "PENDIENTE",
        amountPaid: 0,
        receiptNumber: null,
        validatedBy: null,
        lastPaymentDate: null,
        lastPaymentMethod: null,
        updatedAt: serverTimestamp()
      })

      await addDoc(collection(db, "audit_logs"), {
        userId: user?.uid || "unknown",
        userName: profile ? `${profile.firstName} ${profile.lastName}` : "Administrador",
        action: "Anular Validación",
        module: "tesoreria",
        details: `Se anuló la validación de ${selectedReg.fullName}. Registro volvió a 'Por Validar'.`,
        timestamp: serverTimestamp()
      })

      toast({ title: "Validación Anulada", description: "El registro ha vuelto al estado pendiente." })
      setIsRevertDialogOpen(false)
      setIsDetailsOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Error al revertir" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUpdateDetails = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !selectedReg || isProcessing) return
    setIsProcessing(true)
    const formData = new FormData(e.currentTarget)
    const updateData = {
      fullName: (formData.get("fullName") as string).toUpperCase(),
      ciNumber: formData.get("ciNumber") as string,
      phone: formData.get("phone") as string,
      groupId: formData.get("groupId") as string,
      catechesisYear: formData.get("catechesisYear") as string,
      updatedAt: serverTimestamp()
    }
    try {
      await updateDoc(doc(db, "confirmations", selectedReg.id), updateData)
      toast({ title: "Ficha actualizada" })
      setIsDetailsOpen(false)
    } catch (e) { toast({ variant: "destructive", title: "Error" }) }
    finally { setIsProcessing(false) }
  }

  const handleWithdrawal = async () => {
    if (!db || !selectedReg || isProcessing || !withdrawalReason) return
    setIsProcessing(true)
    try {
      await updateDoc(doc(db, "confirmations", selectedReg.id), {
        isArchived: true,
        status: "BAJA",
        withdrawalReason,
        withdrawalDate: serverTimestamp()
      })
      toast({ title: "Baja procesada" })
      setIsWithdrawalOpen(false)
      setIsDetailsOpen(false)
    } catch (e) { toast({ variant: "destructive", title: "Error" }) }
    finally { setIsProcessing(false) }
  }

  const handleDelete = async () => {
    if (!db || !selectedReg) return
    setIsProcessing(true)
    try {
      await deleteDoc(doc(db, "confirmations", selectedReg.id));
      toast({ title: "Registro eliminado" })
      setIsDeleteDialogOpen(false)
    } catch (e) { toast({ variant: "destructive", title: "Error" }) }
    finally { setIsProcessing(false) }
  }

  const resetFilters = () => {
    setSearchTerm(""); setFilterSex("all"); setFilterYear("all");
    setFilterStatus("all"); setFilterOrigin("all"); setFilterDay("all"); setFilterMethod("all");
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold text-primary tracking-tight">Lista de Confirmandos</h1>
          <p className="text-muted-foreground font-medium">Gestión administrativa de postulantes ciclo 2026.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl h-12 font-bold px-6 border-slate-200 bg-white hover:bg-slate-50 gap-2 shadow-sm" onClick={() => {
            if (filteredRegistrations.length === 0) return;
            const headers = ["Nombre", "CI", "Celular", "Año", "Dia", "Estado"];
            const rows = filteredRegistrations.map(r => [r.fullName, r.ciNumber, r.phone, r.catechesisYear, r.attendanceDay, r.status]);
            const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "lista_confirmandos.csv");
            document.body.appendChild(link);
            link.click();
          }}>
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Button asChild className="bg-primary hover:bg-primary/90 rounded-2xl h-12 font-black px-8 shadow-lg shadow-primary/20 text-white">
            <Link href="/dashboard/registration" prefetch={false}>Nueva Ficha</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-none shadow-sm bg-white rounded-3xl p-6 border-l-4 border-l-primary">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Inscritos</p>
            <Users className="h-4 w-4 text-primary opacity-40" />
          </div>
          <p className="text-4xl font-black text-slate-900 leading-none">{loading ? "..." : stats.total}</p>
        </Card>
        <Card className="border-none shadow-sm bg-white rounded-3xl p-6 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Masculinos</p>
            <div className="text-blue-500 font-black text-xs">♂</div>
          </div>
          <p className="text-4xl font-black text-slate-900 leading-none">{loading ? "..." : stats.masc}</p>
        </Card>
        <Card className="border-none shadow-sm bg-white rounded-3xl p-6 border-l-4 border-l-pink-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Femeninos</p>
            <div className="text-pink-500 font-black text-xs">♀</div>
          </div>
          <p className="text-4xl font-black text-slate-900 leading-none">{loading ? "..." : stats.fem}</p>
        </Card>
      </div>

      <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
        <CardHeader className="bg-slate-50/30 p-8 pb-0">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Buscador Principal</Label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                  placeholder="Nombre o C.I..." 
                  className="pl-12 h-14 rounded-2xl bg-white border-slate-200 shadow-sm text-lg" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4 pb-8 border-b border-slate-100">
              <div className="space-y-1.5 flex-1 min-w-[140px]"><Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sexo</Label><Select value={filterSex} onValueChange={setFilterSex}><SelectTrigger className="h-12 rounded-2xl bg-white"><SelectValue placeholder="Sexo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="M">Masc.</SelectItem><SelectItem value="F">Fem.</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5 flex-1 min-w-[140px]"><Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nivel</Label><Select value={filterYear} onValueChange={setFilterYear}><SelectTrigger className="h-12 rounded-2xl bg-white"><SelectValue placeholder="Nivel" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="PRIMER_AÑO">1° Año</SelectItem><SelectItem value="SEGUNDO_AÑO">2° Año</SelectItem><SelectItem value="ADULTOS">Adultos</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5 flex-1 min-w-[140px]"><Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado</Label><Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="h-12 rounded-2xl bg-white"><SelectValue placeholder="Estado" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="INSCRITO">Inscritos</SelectItem><SelectItem value="POR_VALIDAR">Por Validar</SelectItem><SelectItem value="REPETIDO">Repetidos</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5 flex-1 min-w-[140px]"><Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Horario</Label><Select value={filterDay} onValueChange={setFilterDay}><SelectTrigger className="h-12 rounded-2xl bg-white"><SelectValue placeholder="Horario" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="SABADO">Sábados</SelectItem><SelectItem value="DOMINGO">Domingos</SelectItem></SelectContent></Select></div>
              <div className="flex items-end pb-1"><Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-100" onClick={resetFilters}><FilterX className="h-5 w-5 text-slate-400" /></Button></div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cargando...</p></div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="py-32 text-center text-slate-400 italic">No se encontraron registros.</div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50 border-y">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-8 py-5 font-bold text-slate-500">Confirmando</TableHead>
                  <TableHead className="font-bold text-slate-500">Año / Horario</TableHead>
                  <TableHead className="font-bold text-slate-500">Forma Pago</TableHead>
                  <TableHead className="text-center font-bold text-slate-500">Estado</TableHead>
                  <TableHead className="font-bold text-slate-500">Fecha Insc.</TableHead>
                  <TableHead className="text-right pr-8 font-bold text-slate-500">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg) => {
                  const cleanCi = reg.ciNumber?.replace(/[^0-9]/g, '') || ""
                  const isRepetido = duplicateCis.has(cleanCi)
                  const isManual = reg.userId !== "public_registration"
                  const createdDate = reg.createdAt?.toDate ? reg.createdAt.toDate() : (reg.createdAt ? new Date(reg.createdAt) : new Date())
                  
                  return (
                    <TableRow key={reg.id} className="h-24 hover:bg-slate-50/30 transition-colors border-slate-100">
                      <TableCell className="pl-8">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12 border-2 border-white shadow-sm ring-1 ring-slate-100">
                            <AvatarImage src={reg.photoUrl} className="object-cover" />
                            <AvatarFallback className="bg-slate-50 text-slate-300 font-black"><User /></AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sm text-slate-900 uppercase tracking-tight leading-none">{reg.fullName}</span>
                              {isRepetido && (
                                <Badge className="bg-red-500 hover:bg-red-600 text-white text-[8px] font-black h-4 px-1.5 rounded-full animate-pulse">REPETIDO</Badge>
                              )}
                            </div>
                            <span className="text-xs font-bold text-blue-600 tracking-tighter mt-1">{reg.ciNumber}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{reg.phone}</span>
                          </div>
                          {!isManual && (
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[8px] font-black tracking-widest px-2 h-5 rounded-full ml-2">PÚBLICO</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-slate-200 bg-white w-fit">
                            {reg.catechesisYear?.replace("_", " ")}
                          </Badge>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                            {reg.attendanceDay}S
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-600 uppercase">
                          <CreditCard className="h-3 w-3" />
                          {reg.paymentMethod || "TRANSFERENCIA"}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn("h-6 px-3 rounded-full text-[9px] font-black tracking-widest border-orange-200 text-orange-600 bg-orange-50", 
                          reg.status === "INSCRITO" && "border-green-200 text-green-600 bg-green-50")}>
                          {reg.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700">{createdDate.toLocaleDateString('es-PY')}</span>
                          <span className="text-[9px] text-slate-400 font-medium">{createdDate.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex items-center justify-end gap-3">
                          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full text-slate-300 hover:text-primary" onClick={() => handleOpenDetails(reg)}>
                            <Eye className="h-5 w-5" />
                          </Button>
                          
                          {reg.status === "POR_VALIDAR" && (
                            <Button 
                              variant="outline" 
                              className="h-9 px-6 rounded-full font-black text-[10px] tracking-widest border-blue-600 text-blue-600 hover:bg-blue-50 transition-all uppercase"
                              onClick={() => {
                                if (reg.paymentProofUrl) {
                                  setSelectedReg(reg);
                                  setIsValidatingProofOpen(true);
                                } else {
                                  handleQuickValidate(reg);
                                }
                              }}
                              disabled={isProcessing}
                            >
                              VALIDAR
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-slate-300 hover:bg-slate-100">
                                <MoreHorizontal className="h-5 w-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[200px] p-2 rounded-2xl border-none shadow-2xl">
                              <DropdownMenuItem className="h-11 rounded-xl cursor-pointer gap-3" onClick={() => handleOpenDetails(reg)}>
                                <FileText className="h-4 w-4 text-slate-400" /> <span className="font-bold">Editar Ficha</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem className="h-11 rounded-xl cursor-pointer gap-3" onClick={() => handleOpenDetails(reg)}>
                                <Shapes className="h-4 w-4 text-slate-400" /> <span className="font-bold">Asignar Grupo</span>
                              </DropdownMenuItem>
                              {reg.status === "INSCRITO" && (
                                <DropdownMenuItem className="h-11 rounded-xl cursor-pointer gap-3 text-amber-600" onClick={() => { setSelectedReg(reg); setIsRevertDialogOpen(true); }}>
                                  <RotateCcw className="h-4 w-4" /> <span className="font-bold">Anular Validación</span>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="h-11 rounded-xl cursor-pointer gap-3 text-orange-600" onClick={() => { setSelectedReg(reg); setIsWithdrawalOpen(true); }}>
                                <UserMinus className="h-4 w-4" /> <span className="font-bold">Dar de Baja</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => { setSelectedReg(reg); setIsDeleteDialogOpen(true); }} 
                                className="h-11 rounded-xl text-destructive focus:bg-red-50 focus:text-destructive cursor-pointer gap-3"
                              >
                                <Trash2 className="h-4 w-4" /> <span className="font-bold">Eliminar</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* DIÁLOGO VISOR DE COMPROBANTE PARA VALIDACIÓN */}
      <Dialog open={isValidatingProofOpen} onOpenChange={setIsValidatingProofOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-[2rem]">
          <DialogHeader className="p-6 bg-blue-600 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl"><ImageIcon className="h-5 w-5" /></div>
              <div>
                <DialogTitle className="font-black uppercase tracking-tight">Validar Comprobante</DialogTitle>
                <DialogDescription className="text-white/80">Verifica el depósito de {selectedReg?.fullName}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="aspect-[3/4] relative bg-slate-100 rounded-2xl overflow-hidden border shadow-inner">
              {selectedReg?.paymentProofUrl ? (
                <img src={selectedReg.paymentProofUrl} className="w-full h-full object-contain" alt="Comprobante de pago" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <ImageIcon className="h-12 w-12 mb-2" />
                  <p className="text-xs font-bold uppercase">Sin Comprobante Adjunto</p>
                </div>
              )}
            </div>
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Monto a Validar:</p>
                <p className="text-2xl font-black text-blue-700 tracking-tight">
                  {(selectedReg?.registrationCost || (selectedReg?.catechesisYear === "ADULTOS" ? 50000 : 35000)).toLocaleString('es-PY')} Gs.
                </p>
              </div>
              <Badge className="bg-blue-600 text-white h-8 px-4 rounded-full font-black">{selectedReg?.paymentMethod}</Badge>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
            <Button variant="outline" className="flex-1 h-14 rounded-2xl font-black uppercase text-xs border-slate-200" onClick={() => setIsValidatingProofOpen(false)}>Cancelar</Button>
            <Button 
              className="flex-1 h-14 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs rounded-2xl shadow-xl shadow-blue-100 active:scale-95 transition-all" 
              onClick={() => {
                handleQuickValidate(selectedReg);
                setIsValidatingProofOpen(false);
              }}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : "Confirmar Validación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO FICHA DE INSCRIPCIÓN (MODAL ELEGANTE) */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] h-[90vh] flex flex-col">
          {selectedReg && (
            <form onSubmit={handleUpdateDetails} className="flex flex-col h-full overflow-hidden">
              <DialogHeader className="p-8 bg-slate-900 text-white shrink-0 relative">
                <div className="absolute top-0 right-0 p-8 opacity-10"><Church className="h-24 w-24" /></div>
                <div className="flex items-center gap-6 relative z-10">
                  <Avatar className="h-20 w-20 border-4 border-white/20 shadow-xl">
                    <AvatarImage src={selectedReg.photoUrl} className="object-cover" />
                    <AvatarFallback className="bg-white/10 text-white"><User className="h-10 w-10" /></AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <DialogTitle className="text-3xl font-black uppercase tracking-tight leading-none">{selectedReg.fullName}</DialogTitle>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-primary/20 text-primary-foreground border-none px-3 font-bold">{selectedReg.status}</Badge>
                      <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">ID: {selectedReg.id.split('_')[1]}</span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
                <Tabs defaultValue="general" className="w-full">
                  <TabsList className="mb-8 bg-white border p-1 rounded-xl shadow-sm h-12 w-full justify-start gap-2">
                    <TabsTrigger value="general" className="rounded-lg px-6 font-bold">Datos Generales</TabsTrigger>
                    <TabsTrigger value="catechesis" className="rounded-lg px-6 font-bold">Catequesis</TabsTrigger>
                    <TabsTrigger value="documents" className="rounded-lg px-6 font-bold">Documentos</TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</Label><Input name="fullName" defaultValue={selectedReg.fullName} required className="h-12 rounded-xl bg-white border-slate-200 uppercase font-bold" /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número de C.I.</Label><Input name="ciNumber" defaultValue={selectedReg.ciNumber} required className="h-12 rounded-xl bg-white border-slate-200 font-bold" /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono / Celular</Label><Input name="phone" defaultValue={selectedReg.phone} required className="h-12 rounded-xl bg-white border-slate-200 font-bold" /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Nacimiento</Label><div className="h-12 rounded-xl bg-white border flex items-center px-4 font-bold text-slate-700">{selectedReg.birthDate} ({selectedReg.age} años)</div></div>
                    </div>
                  </TabsContent>

                  <TabsContent value="catechesis" className="space-y-6">
                    <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Año de Catequesis</Label><Select name="catechesisYear" defaultValue={selectedReg.catechesisYear}><SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PRIMER_AÑO">PRIMER AÑO</SelectItem><SelectItem value="SEGUNDO_AÑO">SEGUNDO AÑO</SelectItem><SelectItem value="ADULTOS">ADULTOS</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asignar Grupo</Label><Select name="groupId" defaultValue={selectedReg.groupId || "none"}><SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue placeholder="Sin grupo asignado" /></SelectTrigger><SelectContent><SelectItem value="none">SIN GRUPO ASIGNADO</SelectItem>{allGroups?.filter(g => g.catechesisYear === selectedReg.catechesisYear).map(g => (<SelectItem key={g.id} value={g.id}>{g.name} ({g.attendanceDay})</SelectItem>))}</SelectContent></Select></div>
                      </div>
                      <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10"><Info className="h-5 w-5 text-primary shrink-0" /><p className="text-[10px] text-primary/70 leading-relaxed font-medium">Al cambiar el grupo, el confirmando aparecerá automáticamente en la lista del catequista responsable.</p></div>
                    </div>
                  </TabsContent>

                  <TabsContent value="documents" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 mb-2"><ImageIcon className="h-4 w-4 text-slate-400" /><h4 className="text-xs font-black uppercase text-slate-500">Certificado de Bautismo</h4></div>
                        {selectedReg.baptismCertificatePhotoUrl ? (
                          <div className="relative group aspect-[4/3] rounded-2xl overflow-hidden border shadow-inner"><img src={selectedReg.baptismCertificatePhotoUrl} className="w-full h-full object-cover" /></div>
                        ) : (<div className="aspect-[4/3] rounded-2xl bg-slate-50 border-2 border-dashed flex flex-col items-center justify-center text-slate-300"><X className="h-8 w-8 mb-2" /><span className="text-[10px] font-bold uppercase">No adjunto</span></div>)}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <DialogFooter className="p-8 bg-white border-t flex items-center justify-between">
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-black gap-2 h-12 rounded-xl" onClick={() => setIsWithdrawalOpen(true)}>
                    <UserMinus className="h-5 w-5" /> BAJA
                  </Button>
                  {selectedReg.status === "INSCRITO" && (
                    <Button type="button" variant="ghost" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 font-black gap-2 h-12 rounded-xl" onClick={() => { setSelectedReg(reg); setIsRevertDialogOpen(true); }}>
                      <RotateCcw className="h-5 w-5" /> ANULAR PAGO
                    </Button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="h-12 px-8 rounded-xl font-bold border-slate-200" onClick={() => setIsDetailsOpen(false)}>Cerrar</Button>
                  <Button type="submit" className="h-12 px-10 rounded-xl bg-primary hover:bg-primary/90 text-white font-black shadow-xl gap-2" disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />} GUARDAR CAMBIOS
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO ANULAR VALIDACIÓN */}
      <AlertDialog open={isRevertDialogOpen} onOpenChange={setIsRevertDialogOpen}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-amber-500 p-8 text-white"><RotateCcw className="h-12 w-12 mx-auto mb-4" /><AlertDialogTitle className="text-2xl font-black text-center uppercase">¿Anular Validación?</AlertDialogTitle></div>
          <div className="p-8"><AlertDialogDescription className="text-center font-medium">Se anulará el recibo de <strong className="text-slate-900">"{selectedReg?.fullName}"</strong>. El estado volverá a "Por Validar" y el monto pagado se reiniciará a cero. Esta acción se registrará en la auditoría.</AlertDialogDescription></div>
          <AlertDialogFooter className="p-8 bg-slate-50 gap-3 border-t"><AlertDialogCancel className="rounded-2xl h-14 font-black flex-1">CANCELAR</AlertDialogCancel><AlertDialogAction className="bg-amber-600 hover:bg-amber-700 text-white rounded-2xl h-14 font-black flex-1" onClick={handleRevertValidation} disabled={isProcessing}>ANULAR AHORA</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIÁLOGO DAR DE BAJA (JUSTIFICADO) */}
      <Dialog open={isWithdrawalOpen} onOpenChange={setIsWithdrawalOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-orange-600 text-white"><DialogTitle>Procesar Baja Definitiva</DialogTitle></DialogHeader>
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-600">Explica el motivo por el cual el alumno abandona la catequesis.</p>
            <div className="space-y-2"><Label className="font-bold">Motivo del Retiro</Label><Input value={withdrawalReason} onChange={(e) => setWithdrawalReason(e.target.value)} placeholder="Ej. Cambio de domicilio, decisión personal..." className="h-12 rounded-xl" /></div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t gap-3"><Button variant="outline" onClick={() => setIsWithdrawalOpen(false)}>Cancelar</Button><Button className="bg-orange-600 hover:bg-orange-700 font-bold" onClick={handleWithdrawal} disabled={!withdrawalReason || isProcessing}>Confirmar Baja</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-red-600 p-8 text-white"><AlertTriangle className="h-12 w-12 mx-auto mb-4" /><AlertDialogTitle className="text-2xl font-black text-center uppercase">¿Eliminar Registro?</AlertDialogTitle></div>
          <div className="p-8"><AlertDialogDescription className="text-center font-medium">Esta acción es irreversible. Se borrará permanentemente la ficha de <strong className="text-slate-900">"{selectedReg?.fullName}"</strong>.</AlertDialogDescription></div>
          <AlertDialogFooter className="p-8 bg-slate-50 gap-3 border-t"><AlertDialogCancel className="rounded-2xl h-14 font-black flex-1">CANCELAR</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white rounded-2xl h-14 font-black flex-1" onClick={handleDelete} disabled={isProcessing}>ELIMINAR AHORA</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
