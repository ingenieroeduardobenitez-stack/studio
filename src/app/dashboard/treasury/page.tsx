
"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Wallet, 
  Settings, 
  Search, 
  Loader2, 
  CreditCard, 
  FileText, 
  User, 
  Church, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Receipt, 
  Eye,
  X,
  MessageCircle,
  FilterX,
  Globe,
  Download,
  CalendarDays,
  ImageIcon,
  Share2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Calendar,
  Phone,
  ShieldCheck,
  BookOpen,
  Book,
  UserCircle,
  Users,
  AlertCircle,
  Banknote,
  ArrowRightLeft
} from "lucide-react"
import { useFirestore, useCollection, useDoc, useMemoFirebase, useUser } from "@/firebase"
import { collection, doc, setDoc, updateDoc, serverTimestamp, deleteDoc, addDoc, runTransaction, query, orderBy, limit } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export default function TreasuryPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  const [filterYear, setFilterYear] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  const [isCostSaving, setIsCostSaving] = useState(false)
  const [isEventSubmitting, setIsEventSubmitting] = useState(false)
  const [isExpenseSubmitting, setIsExpenseSubmitting] = useState(false)
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)
  
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false)
  const [isProofViewOpen, setIsProofViewOpen] = useState(false)
  const [selectedProof, setSelectedProof] = useState<string | null>(null)
  const [zoomScale, setZoomScale] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState<string>("ACCOUNT")
  const [expenseProof, setExpenseProof] = useState<string | null>(null)

  const expenseProofRef = useRef<HTMLInputElement>(null)
  const { user: currentUser } = useUser()
  const { toast } = useToast()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const treasuryRef = useMemoFirebase(() => db ? doc(db, "settings", "treasury") : null, [db])
  const { data: costs } = useDoc(treasuryRef)

  const eventsQuery = useMemoFirebase(() => db ? query(collection(db, "events"), orderBy("createdAt", "desc")) : null, [db])
  const { data: events, loading: loadingEvents } = useCollection(eventsQuery)

  const expensesQuery = useMemoFirebase(() => db ? query(collection(db, "expenses"), orderBy("date", "desc")) : null, [db])
  const { data: expenses, loading: loadingExpenses } = useCollection(expensesQuery)

  const regsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "confirmations"), orderBy("createdAt", "desc"), limit(200))
  }, [db])
  const { data: registrations, loading: loadingRegs } = useCollection(regsQuery)

  const userProfileRef = useMemoFirebase(() => db && currentUser?.uid ? doc(db, "users", currentUser.uid) : null, [db, currentUser?.uid])
  const { data: profile } = useDoc(userProfileRef)

  useEffect(() => {
    if (costs?.paymentMethod) {
      setPaymentMethod(costs.paymentMethod)
    }
  }, [costs])

  const filteredRegs = useMemo(() => {
    if (!registrations) return []
    return registrations.filter(reg => {
      if (reg.isArchived) return false
      const matchesSearch = !searchTerm || 
        reg.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        reg.ciNumber?.includes(searchTerm)
      const matchesYear = filterYear === "all" || reg.catechesisYear === filterYear
      const matchesStatus = filterStatus === "all" || reg.status === filterStatus
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
      bankName: formData.get("bankName") as string || "",
      accountNumber: formData.get("accountNumber") as string || "",
      ownerCi: formData.get("ownerCi") as string || "",
      alias: formData.get("alias") as string || "",
      updatedAt: serverTimestamp()
    }
    try {
      await setDoc(treasuryRef, data, { merge: true })
      toast({ title: "Configuración guardada" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setIsCostSaving(false)
    }
  }

  const handleCreateEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db) return
    setIsEventSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const eventId = `event_${Date.now()}`
    try {
      await setDoc(doc(db, "events", eventId), {
        category: formData.get("category"),
        cost: Number(formData.get("cost")),
        createdAt: serverTimestamp()
      })
      toast({ title: "Evento creado" })
      setIsEventDialogOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setIsEventSubmitting(false)
    }
  }

  const handleCreateExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db) return
    setIsExpenseSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const expenseId = `exp_${Date.now()}`
    try {
      await setDoc(doc(db, "expenses", expenseId), {
        concept: formData.get("concept"),
        amount: Number(formData.get("amount")),
        proofUrl: expenseProof,
        date: serverTimestamp(),
        registeredBy: profile ? `${profile.firstName} ${profile.lastName}` : "Tesorero"
      })
      toast({ title: "Gasto registrado" })
      setIsExpenseDialogOpen(false)
      setExpenseProof(null)
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setIsExpenseSubmitting(false)
    }
  }

  const handleProcessPayment = async () => {
    if (!db || !selectedReg || isSubmittingPayment || !treasuryRef) return
    setIsSubmittingPayment(true)
    const regRef = doc(db, "confirmations", selectedReg.id)
    const catechistName = profile ? `${profile.firstName} ${profile.lastName}` : "Tesorero"
    try {
      await runTransaction(db, async (transaction) => {
        const treasurySnap = await transaction.get(treasuryRef);
        const regSnap = await transaction.get(regRef);
        if (!regSnap.exists()) throw "Error";
        
        const currentNext = treasurySnap.exists() ? (treasurySnap.data()?.nextReceiptNumber || 1) : 1;
        const formattedReceipt = `001-001-${String(currentNext).padStart(7, '0')}`;
        
        const newPaid = (regSnap.data().amountPaid || 0) + paymentAmount;
        const regCost = regSnap.data().registrationCost || (regSnap.data().catechesisYear === "ADULTOS" ? 50000 : 35000);
        
        transaction.update(regRef, { 
          amountPaid: newPaid, 
          paymentStatus: newPaid >= regCost ? "PAGADO" : "PARCIAL", 
          status: "INSCRITO",
          receiptNumber: formattedReceipt,
          validatedBy: catechistName,
          lastPaymentDate: serverTimestamp()
        });
        
        transaction.update(treasuryRef, { nextReceiptNumber: currentNext + 1 });
        
        const logRef = doc(collection(db, "audit_logs"));
        transaction.set(logRef, {
          userId: currentUser?.uid || "unknown",
          userName: catechistName,
          action: "Cobro Manual",
          module: "tesoreria",
          details: `Cobro de ${paymentAmount.toLocaleString('es-PY')} Gs. a ${regSnap.data().fullName}. Recibo: ${formattedReceipt}`,
          timestamp: serverTimestamp()
        });
      });
      toast({ title: "Pago confirmado" })
      setIsPaymentDialogOpen(false)
      setIsReceiptOpen(true)
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "Error al procesar" })
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setExpenseProof(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  if (!mounted) return null
  const isActuallyLoading = loadingRegs || !registrations;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-2xl">
            <Church className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Tesorería Institucional</h1>
            <p className="text-muted-foreground font-medium">Control centralizado de ingresos y egresos del Santuario.</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pagos" className="w-full">
        <TabsList className="grid grid-cols-4 max-w-[800px] mb-6 h-12 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="pagos" className="gap-2 rounded-lg data-[state=active]:bg-white shadow-none"><CreditCard className="h-4 w-4" /> Inscripciones</TabsTrigger>
          <TabsTrigger value="eventos" className="gap-2 rounded-lg data-[state=active]:bg-white shadow-none"><CalendarDays className="h-4 w-4" /> Eventos</TabsTrigger>
          <TabsTrigger value="egresos" className="gap-2 rounded-lg data-[state=active]:bg-white shadow-none"><Receipt className="h-4 w-4" /> Egresos</TabsTrigger>
          <TabsTrigger value="config" className="gap-2 rounded-lg data-[state=active]:bg-white shadow-none"><Settings className="h-4 w-4" /> Ajustes</TabsTrigger>
        </TabsList>

        {/* TAB: INSCRIPCIONES */}
        <TabsContent value="pagos" className="space-y-6">
          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por nombre o C.I..." 
                    className="pl-9 h-11 bg-white border-slate-200 rounded-xl" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={filterYear} onValueChange={setFilterYear}>
                    <SelectTrigger className="w-[130px] h-11 rounded-xl bg-white"><SelectValue placeholder="Nivel" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los niveles</SelectItem>
                      <SelectItem value="PRIMER_AÑO">1° Año</SelectItem>
                      <SelectItem value="SEGUNDO_AÑO">2° Año</SelectItem>
                      <SelectItem value="ADULTOS">Adultos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[130px] h-11 rounded-xl bg-white"><SelectValue placeholder="Estado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="POR_VALIDAR">Por Validar</SelectItem>
                      <SelectItem value="INSCRITO">Inscrito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isActuallyLoading ? (
                <div className="flex justify-center py-24"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
              ) : filteredRegs.length === 0 ? (
                <div className="py-24 text-center text-slate-400 italic">No hay registros que coincidan.</div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/30">
                    <TableRow>
                      <TableHead className="pl-8 font-bold">Confirmando</TableHead>
                      <TableHead className="text-center font-bold">Nivel</TableHead>
                      <TableHead className="text-center font-bold">Estado</TableHead>
                      <TableHead className="text-center font-bold">Saldo</TableHead>
                      <TableHead className="text-right pr-8 font-bold">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegs.map((reg) => {
                      const pending = (reg.registrationCost || 35000) - (reg.amountPaid || 0)
                      return (
                        <TableRow key={reg.id} className="h-16 hover:bg-slate-50/50">
                          <TableCell className="pl-8">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border cursor-pointer hover:scale-105 transition-transform" onClick={() => { if(reg.photoUrl) { setSelectedProof(reg.photoUrl); setIsProofViewOpen(true); } }}>
                                <AvatarImage src={reg.photoUrl} className="object-cover" /><AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col"><span className="font-bold text-sm text-slate-900">{reg.fullName}</span><span className="text-[10px] text-slate-500">{reg.ciNumber}</span></div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center"><Badge variant="secondary" className="text-[9px] uppercase">{formatYear(reg.catechesisYear)}</Badge></TableCell>
                          <TableCell className="text-center"><Badge variant={reg.paymentStatus === "PAGADO" ? "default" : "outline"} className={cn(reg.paymentStatus === "PAGADO" && "bg-green-500 hover:bg-green-600")}>{reg.paymentStatus || "PENDIENTE"}</Badge></TableCell>
                          <TableCell className="text-center font-bold text-sm">{pending > 0 ? pending.toLocaleString('es-PY') : "0"} Gs.</TableCell>
                          <TableCell className="text-right pr-8">
                            <div className="flex justify-end gap-2">
                              {reg.paymentProofUrl && (<Button size="icon" variant="ghost" className="h-8 w-8 text-orange-500 rounded-full bg-orange-50 hover:bg-orange-100" onClick={() => { setSelectedProof(reg.paymentProofUrl); setIsProofViewOpen(true); }}><ImageIcon className="h-4 w-4" /></Button>)}
                              <Button size="sm" variant="outline" className="h-8 rounded-xl font-bold border-primary text-primary" onClick={() => { setSelectedReg(reg); setPaymentAmount(pending); setIsPaymentDialogOpen(true); }} disabled={pending <= 0}>Cobrar</Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-primary rounded-full hover:bg-primary/5" onClick={() => { setSelectedReg(reg); setIsDetailsDialogOpen(true); }}><Eye className="h-4 w-4" /></Button>
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

        {/* TAB: EVENTOS */}
        <TabsContent value="eventos" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => setIsEventDialogOpen(true)} className="bg-primary rounded-xl font-bold gap-2 h-11 px-6 shadow-lg"><Plus className="h-4 w-4" /> Nuevo Evento</Button>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {loadingEvents ? (
              <div className="col-span-full flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
            ) : events?.length === 0 ? (
              <div className="col-span-full py-20 text-center text-slate-400 italic bg-white rounded-3xl border shadow-sm">No hay eventos con costo registrados.</div>
            ) : (
              events?.map((ev) => (
                <Card key={ev.id} className="border-none shadow-lg bg-white overflow-hidden group hover:shadow-xl transition-shadow">
                  <CardHeader className="bg-slate-50 border-b p-6">
                    <div className="flex justify-between items-start">
                      <div className="p-2 bg-white rounded-xl border shadow-sm text-primary"><CalendarDays className="h-5 w-5" /></div>
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">ACTIVO</Badge>
                    </div>
                    <CardTitle className="text-xl font-headline mt-4">{ev.category}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Costo Personal</span>
                      <span className="text-2xl font-black text-slate-900">{ev.cost?.toLocaleString('es-PY')} Gs.</span>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-slate-50/50 p-4 border-t flex justify-between">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{ev.createdAt?.toDate ? ev.createdAt.toDate().toLocaleDateString() : 'Reciente'}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:bg-red-50" onClick={async () => { if(confirm('¿Eliminar evento?')) await deleteDoc(doc(db!, "events", ev.id)) }}><Trash2 className="h-4 w-4" /></Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* TAB: EGRESOS */}
        <TabsContent value="egresos" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => setIsExpenseDialogOpen(true)} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold gap-2 h-11 px-6"><Receipt className="h-4 w-4" /> Registrar Gasto</Button>
          </div>
          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <CardContent className="p-0">
              {loadingExpenses ? (
                <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
              ) : expenses?.length === 0 ? (
                <div className="py-24 text-center text-slate-400 italic">No hay registros de egresos.</div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/30">
                    <TableRow>
                      <TableHead className="pl-8 font-bold">Fecha</TableHead>
                      <TableHead className="font-bold">Concepto / Descripción</TableHead>
                      <TableHead className="font-bold">Responsable</TableHead>
                      <TableHead className="text-center font-bold">Comprobante</TableHead>
                      <TableHead className="text-right pr-8 font-bold">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses?.map((exp) => (
                      <TableRow key={exp.id} className="h-16 hover:bg-red-50/10">
                        <TableCell className="pl-8 text-xs font-bold text-slate-500">{exp.date?.toDate ? exp.date.toDate().toLocaleDateString('es-PY') : 'Reciente'}</TableCell>
                        <TableCell className="font-bold text-sm text-slate-900">{exp.concept}</TableCell>
                        <TableCell className="text-xs text-slate-500">{exp.registeredBy}</TableCell>
                        <TableCell className="text-center">
                          {exp.proofUrl ? (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary rounded-full bg-slate-50" onClick={() => { setSelectedProof(exp.proofUrl); setIsProofViewOpen(true); }}><ImageIcon className="h-4 w-4" /></Button>
                          ) : <span className="text-[10px] text-slate-300 italic">Sin foto</span>}
                        </TableCell>
                        <TableCell className="text-right pr-8 font-black text-red-600">-{exp.amount?.toLocaleString('es-PY')} Gs.</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: AJUSTES */}
        <TabsContent value="config">
          <Card className="border-none shadow-xl bg-white overflow-hidden max-w-3xl">
            <CardHeader className="bg-primary text-white p-8">
              <CardTitle className="text-xl">Configuración de Tesorería</CardTitle>
              <CardDescription className="text-white/70">Define costos institucionales y datos para transferencias.</CardDescription>
            </CardHeader>
            <form onSubmit={handleUpdateCosts}>
              <CardContent className="p-8 space-y-8">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">Arancel Juvenil (Gs)</Label>
                    <Input name="juvenile" type="number" defaultValue={costs?.juvenileCost || 35000} className="h-12 rounded-xl bg-slate-50 font-bold" required />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">Arancel Adultos (Gs)</Label>
                    <Input name="adult" type="number" defaultValue={costs?.adultCost || 50000} className="h-12 rounded-xl bg-slate-50 font-bold" required />
                  </div>
                </div>

                <Separator />

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wider">Método de Cobro (Público)</h3>
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

                  <div className="grid gap-4 md:grid-cols-2 bg-slate-50/50 p-6 rounded-2xl border border-dashed">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500">Titular de la Cuenta</Label>
                      <Input name="accountOwner" defaultValue={costs?.accountOwner} placeholder="Nombre Parroquia o Tesorero" className="h-11 rounded-xl bg-white" />
                    </div>
                    {paymentMethod === "ACCOUNT" ? (
                      <>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-500">Banco</Label>
                          <Input name="bankName" defaultValue={costs?.bankName} placeholder="Ej. Banco Familiar" className="h-11 rounded-xl bg-white" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-500">N° de Cuenta</Label>
                          <Input name="accountNumber" defaultValue={costs?.accountNumber} className="h-11 rounded-xl bg-white font-mono" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-500">C.I. / RUC del Titular</Label>
                          <Input name="ownerCi" defaultValue={costs?.ownerCi} className="h-11 rounded-xl bg-white" />
                        </div>
                      </>
                    ) : null}
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-xs font-bold text-slate-500">Alias de Transferencia</Label>
                      <Input name="alias" defaultValue={costs?.alias} placeholder="Ej. parroquia.nsps" className="h-11 rounded-xl bg-white font-bold text-primary" />
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 p-6 border-t flex justify-end">
                <Button type="submit" disabled={isCostSaving} className="rounded-xl h-12 px-8 font-bold shadow-lg gap-2">
                  {isCostSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Guardar Ajustes
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: COBRAR INSCRIPCIÓN */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-[2rem]">
          <DialogHeader className="p-8 bg-primary text-white">
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Confirmar Cobro</DialogTitle>
            <DialogDescription className="text-white/70">Registra el ingreso para {selectedReg?.fullName}.</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex justify-between items-center">
              <span className="text-[10px] font-black text-blue-600 uppercase">Monto Sugerido:</span>
              <span className="text-lg font-black text-blue-700">{paymentAmount.toLocaleString('es-PY')} Gs.</span>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Monto Recibido (Gs)</Label>
              <Input 
                type="number" 
                className="h-14 text-2xl font-black rounded-2xl bg-slate-50 text-primary" 
                value={paymentAmount} 
                onChange={(e) => setPaymentAmount(Number(e.target.value))} 
              />
            </div>
          </div>
          <DialogFooter className="p-8 bg-slate-50 border-t flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 font-bold" onClick={handleProcessPayment} disabled={isSubmittingPayment}>Confirmar Pago</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: NUEVO EVENTO */}
      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-primary text-white">
            <DialogTitle>Crear Nuevo Evento</DialogTitle>
            <DialogDescription className="text-white/70">Asigna un costo para cobrar al personal.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateEvent}>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>Nombre / Categoría</Label>
                <Input name="category" placeholder="Ej. Retiro de Confirmación" required />
              </div>
              <div className="space-y-2">
                <Label>Costo por Persona (Gs)</Label>
                <Input name="cost" type="number" placeholder="0" required />
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t"><Button type="submit" disabled={isEventSubmitting} className="w-full h-12 rounded-xl font-bold">Crear Evento</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: NUEVO GASTO */}
      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-red-600 text-white">
            <DialogTitle>Registrar Gasto Parroquial</DialogTitle>
            <DialogDescription className="text-white/70">Ingresa los datos del egreso de fondos.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateExpense}>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>Concepto / Detalle</Label>
                <Input name="concept" placeholder="Ej. Compra de hostias y vino" required />
              </div>
              <div className="space-y-2">
                <Label>Monto Pagado (Gs)</Label>
                <Input name="amount" type="number" placeholder="0" required />
              </div>
              <div className="space-y-2">
                <Label>Foto del Comprobante (Opcional)</Label>
                <div 
                  className={cn("h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center bg-slate-50 cursor-pointer overflow-hidden", expenseProof ? "border-green-500" : "border-slate-300")}
                  onClick={() => expenseProofRef.current?.click()}
                >
                  {expenseProof ? <img src={expenseProof} className="w-full h-full object-cover" /> : <><ImageIcon className="h-8 w-8 text-slate-300 mb-2" /><span className="text-[10px] font-bold text-slate-400 uppercase">Capturar Foto</span></>}
                </div>
                <input type="file" ref={expenseProofRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t"><Button type="submit" disabled={isExpenseSubmitting} className="w-full h-12 rounded-xl bg-red-600 font-bold">Registrar Egreso</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE VISTA DE COMPROBANTES (ZOOM) */}
      <Dialog open={isProofViewOpen} onOpenChange={(open) => { setIsProofViewOpen(open); if(!open) setZoomScale(1); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl p-0 bg-transparent border-none shadow-none flex items-center justify-center overflow-visible">
          <DialogHeader className="sr-only">
            <DialogTitle>Vista de Documento</DialogTitle>
            <DialogDescription>Previsualización ampliada del comprobante seleccionado.</DialogDescription>
          </DialogHeader>
          <div className="relative flex flex-col items-center w-full">
            <Button variant="secondary" size="icon" className="absolute -top-14 right-0 rounded-full text-white bg-white/20 hover:bg-white/40 border border-white/10 z-50" onClick={() => setIsProofViewOpen(false)}>
              <X className="h-6 w-6" />
            </Button>
            <div className="absolute -bottom-16 flex items-center gap-3 bg-slate-900/90 backdrop-blur-xl p-2 px-4 rounded-2xl border border-white/10 shadow-2xl z-50">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/10" onClick={() => setZoomScale(prev => Math.max(0.25, prev - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
              <span className="text-[10px] font-black text-white uppercase w-14 text-center">{Math.round(zoomScale * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/10" onClick={() => setZoomScale(prev => Math.min(4, prev + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
              <Separator orientation="vertical" className="h-4 bg-white/20 mx-1" />
              <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/10" onClick={() => setZoomScale(1)}><Maximize2 className="h-4 w-4" /></Button>
            </div>
            <div className="w-full bg-slate-950/20 backdrop-blur-sm rounded-3xl p-2 border border-white/10 shadow-2xl overflow-hidden">
              <ScrollArea className="max-h-[75vh] w-full rounded-2xl">
                <div className="flex items-center justify-center p-4 md:p-10 min-h-[400px]">
                  <img src={selectedProof || ""} className="rounded-xl shadow-2xl transition-all duration-300 select-none h-auto" style={{ width: zoomScale === 1 ? 'auto' : `${zoomScale * 100}%`, maxWidth: zoomScale === 1 ? '100%' : 'none', maxHeight: zoomScale === 1 ? '75vh' : 'none', objectFit: 'contain' }} alt="Comprobante" />
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatYear(year: string) {
  switch (year) {
    case "PRIMER_AÑO": return "1° Año"; case "SEGUNDO_AÑO": return "2° Año"; case "ADULTOS": return "Adultos"; default: return year;
  }
}
