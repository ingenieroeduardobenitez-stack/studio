
"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Wallet, 
  Settings, 
  Search, 
  Loader2, 
  CreditCard, 
  FileText, 
  User, 
  Church, 
  CheckCircle2, 
  Receipt, 
  FilterX,
  Banknote,
  ArrowRightLeft,
  Info,
  Building2,
  Save,
  Clock,
  Printer,
  TrendingDown,
  Plus,
  Trash2,
  Camera,
  ImageIcon,
  ArrowDownCircle,
  X,
  CalendarDays,
  Zap,
  Users
} from "lucide-react"
import { useFirestore, useCollection, useDoc, useMemoFirebase, useUser } from "@/firebase"
import { collection, doc, setDoc, serverTimestamp, addDoc, runTransaction, query, orderBy, limit, deleteDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { QRCodeCanvas } from "qrcode.react"
import Image from "next/image"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function TreasuryPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterYear, setFilterYear] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  
  const [isCostSaving, setIsCostSaving] = useState(false)
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false)
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false)
  
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentType, setPaymentType] = useState<"EFECTIVO" | "TRANSFERENCIA">("EFECTIVO")
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string>("ACCOUNT")

  // Estados para Egresos
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false)
  const [expenseProof, setExpenseProof] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null)
  
  // Estados para Eventos
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { user: currentUser } = useUser()
  const { toast } = useToast()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const treasuryRef = useMemoFirebase(() => db ? doc(db, "settings", "treasury") : null, [db])
  const { data: treasurySettings } = useDoc(treasuryRef)

  const regsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "confirmations"), orderBy("createdAt", "desc"), limit(150))
  }, [db])
  const { data: registrations, loading: loadingRegs } = useCollection(regsQuery)

  const expensesQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "expenses"), orderBy("date", "desc"), limit(100))
  }, [db])
  const { data: expenses, loading: loadingExpenses } = useCollection(expensesQuery)

  const eventsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "events"), orderBy("createdAt", "desc"))
  }, [db])
  const { data: events, loading: loadingEvents } = useCollection(eventsQuery)

  const userProfileRef = useMemoFirebase(() => db && currentUser?.uid ? doc(db, "users", currentUser.uid) : null, [db, currentUser?.uid])
  const { data: profile } = useDoc(userProfileRef)

  useEffect(() => {
    if (treasurySettings?.paymentMethod) {
      setPaymentMethod(treasurySettings.paymentMethod)
    }
  }, [treasurySettings])

  const filteredRegs = useMemo(() => {
    if (!registrations) return []
    return registrations.filter(reg => {
      if (reg.isArchived) return false
      const matchesSearch = !searchTerm || 
        reg.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        reg.ciNumber?.includes(searchTerm)
      const matchesYear = filterYear === "all" || reg.catechesisYear === filterYear
      const matchesStatus = filterStatus === "all" || reg.paymentStatus === filterStatus
      return matchesSearch && matchesYear && matchesStatus
    })
  }, [registrations, searchTerm, filterYear, filterStatus])

  const handleUpdateCosts = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !treasuryRef) return
    setIsCostSaving(true)

    const formData = new FormData(e.currentTarget)
    const data: any = {
      juvenileCost: Number(formData.get("juvenile")),
      adultCost: Number(formData.get("adult")),
      paymentMethod: paymentMethod,
      accountOwner: formData.get("accountOwner") as string || "",
      updatedAt: serverTimestamp()
    }

    if (paymentMethod === "ACCOUNT") {
      data.bankName = formData.get("bankName") as string || ""
      data.accountNumber = formData.get("accountNumber") as string || ""
      data.ownerCi = formData.get("ownerCi") as string || ""
      data.alias = formData.get("alias") as string || ""
    } else {
      data.bankName = formData.get("bankName") as string || ""
      data.alias = formData.get("alias") as string || ""
      data.accountNumber = ""
      data.ownerCi = ""
    }

    try {
      await setDoc(treasuryRef, data, { merge: true })
      
      await addDoc(collection(db, "audit_logs"), {
        userId: currentUser?.uid || "unknown",
        userName: profile ? `${profile.firstName} ${profile.lastName}` : "Administrador",
        action: "Ajuste de Tesorería",
        module: "tesoreria",
        details: `Se actualizaron los aranceles y datos de pago de la parroquia.`,
        timestamp: serverTimestamp()
      })

      toast({ title: "Configuración guardada", description: "Los cambios se aplicarán a las nuevas inscripciones." })
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar los ajustes." })
    } finally {
      setIsCostSaving(false)
    }
  }

  const handleOpenPayment = (reg: any) => {
    setSelectedReg(reg)
    const pending = (reg.registrationCost || 35000) - (reg.amountPaid || 0)
    setPaymentAmount(pending > 0 ? pending : 0)
    setPaymentType("EFECTIVO")
    setIsPaymentDialogOpen(true)
  }

  const handleViewReceipt = (reg: any) => {
    setSelectedReg(reg)
    setIsReceiptOpen(true)
  }

  const handleProcessPayment = async () => {
    if (!db || !selectedReg || !treasuryRef || isSubmittingPayment) return
    setIsSubmittingPayment(true)
    
    const regRef = doc(db, "confirmations", selectedReg.id)
    const catechistName = profile ? `${profile.firstName} ${profile.lastName}` : "Tesorero"

    try {
      await runTransaction(db, async (transaction) => {
        const treasurySnap = await transaction.get(treasuryRef);
        const regSnap = await transaction.get(regRef);
        
        if (!regSnap.exists()) throw new Error("Registro no encontrado");
        
        const regData = regSnap.data();
        const currentNext = treasurySnap.exists() ? (treasurySnap.data()?.nextReceiptNumber || 1) : 1;
        const formattedReceipt = `001-001-${String(currentNext).padStart(7, '0')}`;
        
        const newPaid = (regData.amountPaid || 0) + paymentAmount;
        const regCost = regData.registrationCost || (regData.catechesisYear === "ADULTOS" ? 50000 : 35000);
        
        const updatePayload = { 
          amountPaid: newPaid, 
          paymentStatus: newPaid >= regCost ? "PAGADO" : (newPaid > 0 ? "PARCIAL" : "PENDIENTE"), 
          status: "INSCRITO",
          validatedBy: catechistName,
          receiptNumber: formattedReceipt,
          lastPaymentDate: serverTimestamp(),
          lastPaymentMethod: paymentType
        };

        transaction.update(regRef, updatePayload);
        transaction.update(treasuryRef, { nextReceiptNumber: currentNext + 1 });
        
        transaction.set(doc(collection(db, "audit_logs")), {
          userId: currentUser?.uid || "unknown",
          userName: catechistName,
          action: `Cobro Tesorería (${paymentType})`,
          module: "tesoreria",
          details: `Cobro de ${paymentAmount.toLocaleString('es-PY')} Gs. a ${regData.fullName}. Recibo: ${formattedReceipt}`,
          timestamp: serverTimestamp()
        });

        setSelectedReg({ ...regData, ...updatePayload, id: regSnap.id });
      });

      toast({ title: "Pago procesado con éxito" })
      setIsPaymentDialogOpen(false)
      setIsReceiptOpen(true)
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error al procesar", description: "No se pudo completar la transacción." })
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  // Lógica de Egresos
  const handleSaveExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || isSubmittingExpense) return
    setIsSubmittingExpense(true)

    const formData = new FormData(e.currentTarget)
    const concept = formData.get("concept") as string
    const amount = Number(formData.get("amount"))
    const registeredByName = profile ? `${profile.firstName} ${profile.lastName}` : "Tesorero"

    try {
      const expenseData = {
        concept,
        amount,
        proofUrl: expenseProof,
        date: new Date().toISOString(),
        registeredBy: currentUser?.uid || "unknown",
        registeredByName,
        timestamp: serverTimestamp()
      }

      await addDoc(collection(db, "expenses"), expenseData)

      await addDoc(collection(db, "audit_logs"), {
        userId: currentUser?.uid || "unknown",
        userName: registeredByName,
        action: "Registro de Egreso",
        module: "tesoreria",
        details: `Se registró un egreso por ${amount.toLocaleString('es-PY')} Gs. Concepto: ${concept}`,
        timestamp: serverTimestamp()
      })

      toast({ title: "Egreso registrado" })
      setIsExpenseDialogOpen(false)
      setExpenseProof(null)
    } catch (error) {
      toast({ variant: "destructive", title: "Error al guardar egreso" })
    } finally {
      setIsSubmittingExpense(false)
    }
  }

  const handleDeleteExpense = async (id: string, concept: string) => {
    if (!db) return
    try {
      await deleteDoc(doc(db, "expenses", id))
      toast({ title: "Egreso eliminado" })
      
      await addDoc(collection(db, "audit_logs"), {
        userId: currentUser?.uid || "unknown",
        userName: profile ? `${profile.firstName} ${profile.lastName}` : "Tesorero",
        action: "Eliminar Egreso",
        module: "tesoreria",
        details: `Se eliminó el registro de egreso: ${concept}`,
        timestamp: serverTimestamp()
      })
    } catch (error) {
      toast({ variant: "destructive", title: "No se pudo eliminar" })
    }
  }

  // Lógica de Eventos
  const handleCreateEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || isSubmittingEvent) return
    setIsSubmittingEvent(true)

    const formData = new FormData(e.currentTarget)
    const category = formData.get("category") as string
    const cost = Number(formData.get("cost"))
    const appliesToConfirmands = formData.get("appliesToConfirmands") === "on"
    const appliesToCatechists = formData.get("appliesToCatechists") === "on"
    
    if (!appliesToConfirmands && !appliesToCatechists) {
      toast({ variant: "destructive", title: "Atención", description: "Selecciona al menos un destinatario (Confirmandos o Catequistas)." })
      setIsSubmittingEvent(false)
      return
    }

    const creatorName = profile ? `${profile.firstName} ${profile.lastName}` : "Tesorero"

    try {
      const eventId = `event_${Date.now()}`
      await setDoc(doc(db, "events", eventId), {
        category,
        cost,
        appliesToConfirmands,
        appliesToCatechists,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || "unknown"
      })

      await addDoc(collection(db, "audit_logs"), {
        userId: currentUser?.uid || "unknown",
        userName: creatorName,
        action: "Crear Evento Especial",
        module: "tesoreria",
        details: `Se creó el evento "${category}" (${cost.toLocaleString('es-PY')} Gs.) para: ${[appliesToConfirmands && "Confirmandos", appliesToCatechists && "Catequistas"].filter(Boolean).join(", ")}`,
        timestamp: serverTimestamp()
      })

      toast({ title: "Evento Creado", description: "El concepto de cobro ya está disponible." })
      setIsEventDialogOpen(false)
    } catch (error) {
      toast({ variant: "destructive", title: "Error al crear evento" })
    } finally {
      setIsSubmittingEvent(false)
    }
  }

  const handleDeleteEvent = async (id: string, category: string) => {
    if (!db) return
    try {
      await deleteDoc(doc(db, "events", id))
      toast({ title: "Evento eliminado" })
      
      await addDoc(collection(db, "audit_logs"), {
        userId: currentUser?.uid || "unknown",
        userName: profile ? `${profile.firstName} ${profile.lastName}` : "Tesorero",
        action: "Eliminar Evento",
        module: "tesoreria",
        details: `Se eliminó el evento especial: ${category}`,
        timestamp: serverTimestamp()
      })
    } catch (error) {
      toast({ variant: "destructive", title: "Error al eliminar" })
    }
  }

  const onVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node && currentStream) {
      if (node.srcObject !== currentStream) {
        node.srcObject = currentStream;
        node.play().catch(err => {
          if (err.name !== 'AbortError') console.error("Video play error:", err);
        });
      }
    }
    videoRef.current = node;
  }, [currentStream]);

  const startCamera = async (deviceId?: string) => {
    try {
      if (currentStream) currentStream.getTracks().forEach(track => track.stop());
      const constraints = {
        video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setCurrentStream(stream)
      const availableDevices = await navigator.mediaDevices.enumerateDevices()
      setDevices(availableDevices.filter(d => d.kind === 'videoinput'))
      setShowCamera(true)
    } catch (error) {
      toast({ variant: 'destructive', title: 'Acceso a cámara denegado' })
    }
  }

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')?.drawImage(video, 0, 0)
      setExpenseProof(canvas.toDataURL('image/jpeg', 0.8))
      if (currentStream) currentStream.getTracks().forEach(t => t.stop())
      setShowCamera(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setExpenseProof(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <Wallet className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Gestión de Tesorería</h1>
            <p className="text-muted-foreground font-medium">Control oficial de ingresos, egresos y aranceles.</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pagos" className="w-full">
        <TabsList className="mb-8 h-12 bg-white p-1 border rounded-xl shadow-sm gap-2">
          <TabsTrigger value="pagos" className="rounded-lg px-8 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
            <Banknote className="h-4 w-4 mr-2" /> Inscripciones
          </TabsTrigger>
          <TabsTrigger value="eventos" className="rounded-lg px-8 font-bold data-[state=active]:bg-accent data-[state=active]:text-white">
            <Zap className="h-4 w-4 mr-2" /> Eventos Especiales
          </TabsTrigger>
          <TabsTrigger value="egresos" className="rounded-lg px-8 font-bold data-[state=active]:bg-red-600 data-[state=active]:text-white">
            <TrendingDown className="h-4 w-4 mr-2" /> Egresos
          </TabsTrigger>
          <TabsTrigger value="config" className="rounded-lg px-8 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
            <Settings className="h-4 w-4 mr-2" /> Configuración
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pagos" className="space-y-6">
          <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por nombre o C.I..." 
                  className="pl-9 h-12 rounded-2xl bg-slate-50 border-none shadow-inner" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-xl border border-primary/10">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-primary">{filteredRegs.length} Registros</span>
              </div>
              <div className="flex gap-2">
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger className="w-[140px] h-12 rounded-2xl bg-white"><SelectValue placeholder="Nivel" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Niveles</SelectItem>
                    <SelectItem value="PRIMER_AÑO">1° Año</SelectItem>
                    <SelectItem value="SEGUNDO_AÑO">2° Año</SelectItem>
                    <SelectItem value="ADULTOS">Adultos</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px] h-12 rounded-2xl bg-white"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Pagos</SelectItem>
                    <SelectItem value="PAGADO">Pagado</SelectItem>
                    <SelectItem value="PARCIAL">Parcial</SelectItem>
                    <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" className="h-12 w-12 rounded-2xl p-0" onClick={() => { setSearchTerm(""); setFilterYear("all"); setFilterStatus("all"); }}>
                  <FilterX className="h-5 w-5 text-slate-400" />
                </Button>
              </div>
            </div>
          </div>

          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <CardContent className="p-0">
              {loadingRegs ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : filteredRegs.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground italic">No se encontraron confirmandos con estos filtros.</div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="pl-8 font-bold">Confirmando</TableHead>
                      <TableHead className="font-bold">Nivel</TableHead>
                      <TableHead className="text-center font-bold">Estado Pago</TableHead>
                      <TableHead className="text-right font-bold">Saldo Pendiente</TableHead>
                      <TableHead className="text-right pr-8 font-bold">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegs.map((reg) => {
                      const pending = (reg.registrationCost || 35000) - (reg.amountPaid || 0)
                      const isPaid = reg.paymentStatus === "PAGADO"
                      return (
                        <TableRow key={reg.id} className="h-20 hover:bg-slate-50/30 transition-colors">
                          <TableCell className="pl-8">
                            <div className="flex items-center gap-4">
                              <Avatar className="h-10 w-10 border shadow-sm"><AvatarImage src={reg.photoUrl} className="object-cover" /><AvatarFallback><User /></AvatarFallback></Avatar>
                              <div className="flex flex-col"><span className="font-bold text-sm text-slate-900 uppercase">{reg.fullName}</span><span className="text-[10px] text-slate-500 font-bold">{reg.ciNumber}</span></div>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="secondary" className="text-[9px] uppercase">{reg.catechesisYear?.replace("_", " ")}</Badge></TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn(isPaid ? "bg-green-50 text-green-600 border-green-200" : "bg-amber-50 text-amber-600 border-amber-200")}>
                              {reg.paymentStatus || "PENDIENTE"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-black text-sm">{pending > 0 ? pending.toLocaleString('es-PY') : "0"} Gs.</TableCell>
                          <TableCell className="text-right pr-8">
                            <div className="flex justify-end gap-2">
                              {reg.receiptNumber && (
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-9 w-9 rounded-xl text-amber-600 hover:bg-amber-50" 
                                  onClick={() => handleViewReceipt(reg)}
                                  title="Ver Recibo"
                                >
                                  <Receipt className="h-4 w-4" />
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-9 rounded-xl font-bold border-primary text-primary hover:bg-primary/5 gap-2" onClick={() => handleOpenPayment(reg)} disabled={isPaid}>
                                <Banknote className="h-4 w-4" /> Cobrar
                              </Button>
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
        </TabsContent>

        <TabsContent value="eventos" className="space-y-6">
          <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-2xl">
                <Zap className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Eventos Especiales</h3>
                <p className="text-xs text-slate-400 font-medium">Crea conceptos de cobro adicionales para la catequesis.</p>
              </div>
            </div>
            <Button className="bg-accent hover:bg-accent/90 h-12 rounded-xl font-bold gap-2 shadow-lg shadow-accent/20" onClick={() => setIsEventDialogOpen(true)}>
              <Plus className="h-5 w-5" /> Nuevo Evento
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {loadingEvents ? (
              <div className="col-span-full flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
            ) : !events || events.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                <CalendarDays className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500 font-medium italic">No hay eventos especiales creados.</p>
              </div>
            ) : (
              events.map((ev) => (
                <Card key={ev.id} className="border-none shadow-md bg-white rounded-3xl overflow-hidden group hover:shadow-xl transition-all">
                  <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-sm font-black uppercase text-slate-900">{ev.category}</CardTitle>
                      <div className="flex flex-wrap gap-1">
                        {ev.appliesToConfirmands && <Badge variant="secondary" className="text-[8px] bg-primary/5 text-primary border-primary/10">CONFIRMANDOS</Badge>}
                        {ev.appliesToCatechists && <Badge variant="secondary" className="text-[8px] bg-accent/5 text-accent border-accent/10">CATEQUISTAS</Badge>}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-full" onClick={() => handleDeleteEvent(ev.id, ev.category)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="p-8 text-center space-y-4">
                    <p className="text-3xl font-black text-accent tracking-tighter">{ev.cost.toLocaleString('es-PY')} Gs.</p>
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">Este monto será el que visualice el catequista al momento de cobrar.</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="egresos" className="space-y-6">
          <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-50 rounded-2xl">
                <ArrowDownCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Salidas de Caja</h3>
                <p className="text-xs text-slate-400 font-medium">Historial de gastos y egresos del Santuario.</p>
              </div>
            </div>
            <Button className="bg-red-600 hover:bg-red-700 h-12 rounded-xl font-bold gap-2 shadow-lg shadow-red-200" onClick={() => { setExpenseProof(null); setIsExpenseDialogOpen(true); }}>
              <Plus className="h-5 w-5" /> Registrar Gasto
            </Button>
          </div>

          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <CardContent className="p-0">
              {loadingExpenses ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-red-600" /></div>
              ) : !expenses || expenses.length === 0 ? (
                <div className="py-24 text-center">
                  <TrendingDown className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium italic">No hay egresos registrados aún.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="pl-8 font-bold">Fecha</TableHead>
                      <TableHead className="font-bold">Concepto / Descripción</TableHead>
                      <TableHead className="font-bold text-center">Comprobante</TableHead>
                      <TableHead className="text-right font-bold">Monto (Gs)</TableHead>
                      <TableHead className="text-right pr-8 font-bold">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((exp) => (
                      <TableRow key={exp.id} className="h-20 hover:bg-red-50/10 transition-colors">
                        <TableCell className="pl-8">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900">{new Date(exp.date).toLocaleDateString('es-PY')}</span>
                            <span className="text-[10px] text-slate-400 font-medium uppercase">{exp.registeredByName || 'Sistema'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <p className="text-sm font-medium text-slate-700 leading-tight">{exp.concept}</p>
                        </TableCell>
                        <TableCell className="text-center">
                          {exp.proofUrl ? (
                            <Avatar className="h-10 w-10 mx-auto rounded-lg border-2 border-slate-100 shadow-sm cursor-pointer hover:scale-110 transition-transform" onClick={() => {
                              window.open(exp.proofUrl, '_blank')
                            }}>
                              <AvatarImage src={exp.proofUrl} className="object-cover" />
                              <AvatarFallback><ImageIcon className="h-4 w-4" /></AvatarFallback>
                            </Avatar>
                          ) : (
                            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-black text-red-600 text-base">
                          -{exp.amount.toLocaleString('es-PY')} Gs.
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full text-slate-300 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteExpense(exp.id, exp.concept)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid gap-8 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-none shadow-xl bg-white overflow-hidden">
              <CardHeader className="bg-primary text-white p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg"><Settings className="h-5 w-5" /></div>
                  <div>
                    <CardTitle className="text-lg">Configuración de Pagos</CardTitle>
                    <CardDescription className="text-white/70">Define aranceles y datos para transferencias.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <form onSubmit={handleUpdateCosts}>
                <CardContent className="p-8 space-y-8">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="font-bold text-slate-700">Arancel Juvenil (Gs)</Label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input name="juvenile" type="number" defaultValue={treasurySettings?.juvenileCost || 35000} className="pl-10 h-12 rounded-xl bg-slate-50" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-slate-700">Arancel Adultos (Gs)</Label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input name="adult" type="number" defaultValue={treasurySettings?.adultCost || 50000} className="pl-10 h-12 rounded-xl bg-slate-50" required />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wider">
                        <Wallet className="h-4 w-4" /> Método de Pago Preferido
                      </h3>
                      <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="ACCOUNT" id="mode-account" />
                          <Label htmlFor="mode-account" className="text-xs font-bold cursor-pointer">Cuenta Completa</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="ALIAS" id="mode-alias" />
                          <Label htmlFor="mode-alias" className="text-xs font-bold cursor-pointer">Solo Alias</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 bg-slate-50/50 p-6 rounded-2xl border border-dashed border-slate-200">
                      {paymentMethod === "ACCOUNT" ? (
                        <>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500">Nombre del Banco</Label>
                            <Input name="bankName" defaultValue={treasurySettings?.bankName} placeholder="Ej. Banco Familiar" className="h-11 rounded-xl bg-white" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500">N° de Cuenta</Label>
                            <Input name="accountNumber" defaultValue={treasurySettings?.accountNumber} placeholder="00000000" className="h-11 rounded-xl font-mono bg-white" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500">Titular de la Cuenta</Label>
                            <Input name="accountOwner" defaultValue={treasurySettings?.accountOwner} placeholder="Nombre completo" className="h-11 rounded-xl bg-white" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500">C.I. o RUC del Titular</Label>
                            <Input name="ownerCi" defaultValue={treasurySettings?.ownerCi} placeholder="1.234.567-8" className="h-11 rounded-xl bg-white" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-xs font-bold text-slate-500">Alias (Opcional)</Label>
                            <Input name="alias" defaultValue={treasurySettings?.alias} placeholder="Ej. parroquia.ps" className="h-11 rounded-xl font-bold text-primary bg-white" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500">Nombre del Banco</Label>
                            <Input name="bankName" defaultValue={treasurySettings?.bankName} placeholder="Ej. ueno bank" className="h-12 rounded-xl bg-white" required />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500">Alias de Transferencia</Label>
                            <Input name="alias" defaultValue={treasurySettings?.alias} placeholder="Ej. parroquia.ps" className="h-12 rounded-xl font-bold text-primary bg-white text-lg" required />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-xs font-bold text-slate-500">Titular de la Cuenta</Label>
                            <Input name="accountOwner" defaultValue={treasurySettings?.accountOwner} placeholder="Nombre completo o Parroquia" className="h-12 rounded-xl bg-white" required />
                          </div>
                          <p className="text-[10px] text-muted-foreground italic md:col-span-2 mt-2">
                            * En este modo, el postulante solo verá el Banco, el Alias y el Nombre del Titular para realizar transferencias rápidas.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-slate-50 p-6 border-t flex justify-end">
                  <Button type="submit" disabled={isCostSaving} className="rounded-xl h-12 px-8 font-bold shadow-lg gap-2">
                    {isCostSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar Configuración
                  </Button>
                </CardFooter>
              </form>
            </Card>

            <div className="space-y-6">
              <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-6 opacity-10"><Receipt className="h-20 w-20" /></div>
                <CardHeader>
                  <CardTitle className="text-white text-base">Estado de Caja</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">Próximo Nro. Recibo:</p>
                    <p className="text-2xl font-black text-primary tracking-tighter">001-001-{String(treasurySettings?.nextReceiptNumber || 1).padStart(7, '0')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-green-400 uppercase">Sistema de cobro activo</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-xl bg-white">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase text-slate-500">Información</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-start gap-3">
                    <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-blue-700 leading-relaxed font-medium">
                      Los cambios en los aranceles se reflejarán instantáneamente en el formulario público de inscripción.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOGO DE PAGO (INGRESOS) */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-primary text-white">
            <DialogTitle>Registrar Cobro</DialogTitle>
            <DialogDescription className="text-white/70">Confirmando: {selectedReg?.fullName}</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="p-4 bg-slate-50 rounded-2xl border border-dashed flex justify-between items-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Saldo Pendiente:</p>
              <p className="text-lg font-black text-slate-900">
                {((selectedReg?.registrationCost || 35000) - (selectedReg?.amountPaid || 0)).toLocaleString('es-PY')} Gs.
              </p>
            </div>

            <div className="space-y-3">
              <Label className="font-bold text-slate-700">Monto a Recibir (Gs)</Label>
              <Input 
                type="number" 
                className="h-14 text-2xl font-black rounded-2xl bg-slate-50 border-primary/20 text-primary" 
                value={paymentAmount} 
                onChange={(e) => setPaymentAmount(Number(e.target.value))} 
              />
            </div>

            <div className="space-y-3">
              <Label className="font-bold text-slate-700">Forma de Pago</Label>
              <Select value={paymentType} onValueChange={(val: any) => setPaymentType(val)}>
                <SelectTrigger className="h-12 rounded-xl bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EFECTIVO">
                    <div className="flex items-center gap-2"><Banknote className="h-4 w-4" /> Efectivo</div>
                  </SelectItem>
                  <SelectItem value="TRANSFERENCIA">
                    <div className="flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Transferencia</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg" onClick={handleProcessPayment} disabled={isSubmittingPayment || paymentAmount <= 0}>
              {isSubmittingPayment ? <Loader2 className="animate-spin h-4 w-4" /> : "Confirmar Cobro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOGO DE NUEVO EVENTO */}
      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-accent text-white">
            <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5" /> Crear Nuevo Evento</DialogTitle>
            <DialogDescription className="text-white/70">Define el concepto y el costo que cobrarán los catequistas.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateEvent}>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <Label className="font-bold text-slate-700 uppercase text-[10px]">Nombre / Categoría del Evento</Label>
                <Input name="category" placeholder="Ej. Retiro Espiritual 2026" required className="h-12 rounded-xl bg-slate-50" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-slate-700 uppercase text-[10px]">Costo del Evento (Gs)</Label>
                <Input name="cost" type="number" placeholder="0" required className="h-14 text-2xl font-black rounded-2xl bg-slate-50 border-accent/20 text-accent" />
              </div>

              <div className="space-y-4">
                <Label className="font-bold text-slate-700 uppercase text-[10px]">Dirigido a:</Label>
                <div className="flex gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="confirmands" name="appliesToConfirmands" defaultChecked />
                    <Label htmlFor="confirmands" className="text-xs font-bold cursor-pointer">Confirmandos</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="catechists" name="appliesToCatechists" />
                    <Label htmlFor="catechists" className="text-xs font-bold cursor-pointer">Catequistas</Label>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-start gap-3">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-700 leading-relaxed font-medium">
                  Este evento aparecerá automáticamente en el módulo de cobros correspondiente para que puedan registrar los aportes.
                </p>
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
              <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsEventDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1 h-12 rounded-xl bg-accent hover:bg-accent/90 text-white font-bold shadow-lg" disabled={isSubmittingEvent}>
                {isSubmittingEvent ? <Loader2 className="animate-spin h-4 w-4" /> : "Crear Evento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOGO DE NUEVO EGRESO */}
      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl h-[90vh] flex flex-col">
          <DialogHeader className="p-6 bg-red-600 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5" /> Registrar Nuevo Egreso</DialogTitle>
            <DialogDescription className="text-white/70">Ingresa los detalles del gasto para descontar de caja.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveExpense} className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700 uppercase text-[10px]">Concepto / Detalle del Gasto</Label>
                  <Input name="concept" placeholder="Ej. Compra de focos para el salón" required className="h-12 rounded-xl bg-slate-50" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700 uppercase text-[10px]">Monto del Egreso (Gs)</Label>
                  <Input name="amount" type="number" placeholder="0" required className="h-14 text-2xl font-black rounded-2xl bg-slate-50 border-red-100 text-red-600" />
                </div>
                
                <div className="space-y-3">
                  <Label className="font-bold text-slate-700 uppercase text-[10px]">Comprobante de Gasto (Opcional)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button type="button" variant="outline" className="h-12 rounded-xl font-bold gap-2" onClick={() => startCamera()}>
                      <Camera className="h-4 w-4" /> Cámara
                    </Button>
                    <Button type="button" variant="outline" className="h-12 rounded-xl font-bold gap-2" onClick={() => fileInputRef.current?.click()}>
                      <ImageIcon className="h-4 w-4" /> Galería
                    </Button>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                  
                  <div className="h-48 w-full border-2 border-dashed rounded-3xl bg-slate-50 flex items-center justify-center overflow-hidden relative group">
                    {expenseProof ? (
                      <>
                        <img src={expenseProof} className="h-full w-full object-cover" />
                        <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setExpenseProof(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <div className="text-center space-y-1">
                        <ImageIcon className="h-8 w-8 text-slate-200 mx-auto" />
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Sin imagen adjunta</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3 shrink-0">
              <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsExpenseDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg" disabled={isSubmittingExpense}>
                {isSubmittingExpense ? <Loader2 className="animate-spin h-4 w-4" /> : "Guardar Egreso"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOGO DE CÁMARA PARA EGRESOS */}
      <Dialog open={showCamera} onOpenChange={(open) => !open && setShowCamera(false)}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2.5rem] flex flex-col max-h-[90vh] border-none shadow-2xl">
          <DialogHeader className="p-4 bg-red-600 text-white shrink-0">
            <DialogTitle className="text-sm font-black uppercase tracking-widest text-center">Capturar Comprobante</DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden min-h-0">
            <video ref={onVideoRef} autoPlay muted playsInline className="max-h-full w-full object-contain" />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <DialogFooter className="p-6 bg-slate-50 flex flex-col gap-4 shrink-0 border-t">
            {devices.length > 1 && (
              <Select value={selectedDeviceId} onValueChange={(val) => { setSelectedDeviceId(val); startCamera(val); }}>
                <SelectTrigger className="h-10 rounded-xl bg-white text-xs border-slate-200"><SelectValue placeholder="Cambiar Cámara" /></SelectTrigger>
                <SelectContent>{devices.map((d) => (<SelectItem key={d.deviceId} value={d.deviceId} className="text-xs">{d.label || `Cámara ${d.deviceId.slice(0,5)}`}</SelectItem>))}</SelectContent>
              </Select>
            )}
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1 h-14 rounded-2xl font-black text-xs uppercase" onClick={() => { if(currentStream) currentStream.getTracks().forEach(t=>t.stop()); setShowCamera(false); }}>CANCELAR</Button>
              <Button type="button" className="flex-1 h-14 bg-red-600 text-white font-black text-xs uppercase shadow-xl" onClick={takePhoto}>CAPTURAR FOTO</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RECIBO OFICIAL (INGRESOS) */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden bg-white rounded-3xl h-[90vh] flex flex-col border-none shadow-2xl">
          <DialogHeader className="p-4 bg-slate-50 border-b no-print shrink-0">
            <DialogTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Recibo Oficial Generado</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 bg-slate-100 no-print flex justify-center">
            <div className="bg-white shadow-xl origin-top scale-[0.75] sm:scale-[0.85] mb-[-15%]">
              <ReceiptContent reg={selectedReg} />
            </div>
          </div>
          <div className="hidden print:block">
            <ReceiptContent reg={selectedReg} />
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3 no-print shrink-0">
            <Button variant="outline" className="flex-1 rounded-xl font-bold h-12" onClick={() => setIsReceiptOpen(false)}>Cerrar</Button>
            <Button className="flex-1 bg-primary text-white rounded-xl font-bold gap-2 shadow-lg h-12" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir Recibo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReceiptContent({ reg }: { reg: any }) {
  if (!reg) return null;
  const date = reg.lastPaymentDate?.toDate ? reg.lastPaymentDate.toDate() : new Date();
  const dateStr = date.toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' });
  
  return (
    <div className="p-10 bg-white text-black font-serif border-[4px] border-black w-[800px] h-auto min-h-[1000px] mx-auto">
      <div className="flex gap-4 mb-8">
        <div className="flex-1 border-[2px] border-black p-4 flex items-center justify-between">
          <div className="relative h-16 w-16">
            <Image src="/logo.png" fill alt="Logo" className="object-contain" />
          </div>
          <div className="text-right">
            <p className="text-[11px] font-black tracking-tight leading-none">SANTUARIO NACIONAL</p>
            <p className="text-[9px] font-bold leading-tight uppercase">NUESTRA SEÑORA DEL PERPETUO SOCORRO</p>
          </div>
        </div>
        <div className="w-[220px] flex flex-col gap-2">
          <div className="border-[2px] border-black p-2 text-center h-[60%] flex flex-col justify-center">
            <p className="text-[10px] font-black uppercase">GS.</p>
            <p className="text-2xl font-black">{(reg.amountPaid || 0).toLocaleString('es-PY')}</p>
          </div>
          <div className="border-[2px] border-black p-1 text-center flex-1">
            <p className="text-[8px] font-bold uppercase leading-none">RECIBO N°</p>
            <p className="text-xs font-black font-mono leading-none mt-1">{reg.receiptNumber || '---'}</p>
          </div>
        </div>
      </div>

      <div className="text-center mb-10">
        <h2 className="text-4xl font-black italic tracking-[0.2em] border-b-[3px] border-black inline-block px-16 pb-1">RECIBO</h2>
      </div>

      <div className="space-y-8 text-[15px]">
        <div className="flex items-baseline gap-2">
          <span className="font-bold whitespace-nowrap">Recibí(mos) de:</span>
          <span className="flex-1 border-b border-dotted border-black px-2 uppercase font-black tracking-wide">{reg.fullName}</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="font-bold whitespace-nowrap">la cantidad de:</span>
          <span className="flex-1 border-b border-dotted border-black px-2 italic font-medium">{(reg.amountPaid || 0).toLocaleString('es-PY')} Guaraníes</span>
        </div>

        <div className="space-y-3">
          <span className="font-bold">en concepto de:</span>
          <div className="border-[2px] border-black p-5 text-center font-black uppercase text-base tracking-wider">
            INSCRIPCIÓN CATEQUESIS DE CONFIRMACIÓN - {reg.catechesisYear?.replace('_', ' ')}
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="font-bold whitespace-nowrap">Observación:</span>
          <span className="flex-1 border-b border-dotted border-black px-2 italic font-medium">
            Pago realizado vía {reg.lastPaymentMethod || 'CAJA'}.
          </span>
        </div>
      </div>

      <div className="mt-16 space-y-12">
        <div>
          <p className="italic border-b border-black inline-block pr-16 text-sm">
            Asunción, {dateStr}
          </p>
          <p className="text-[9px] font-black mt-1 uppercase tracking-widest">(FIRMA Y ACLARACIÓN)</p>
        </div>

        <div className="flex flex-col items-center">
          <div className="p-1 border border-slate-100 rounded-lg shadow-sm">
            <QRCodeCanvas value={`NSPS-RECIBO-${reg.receiptNumber}`} size={90} level="M" />
          </div>
          <div className="mt-3 text-center">
            <p className="text-[9px] font-black text-blue-700 uppercase tracking-[0.2em] leading-none mb-1">Firma Digitalizada</p>
            <p className="text-base font-black uppercase leading-tight">LILIANA MUÑOZ</p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">ADMINISTRADOR</p>
          </div>
        </div>
      </div>
    </div>
  )
}
