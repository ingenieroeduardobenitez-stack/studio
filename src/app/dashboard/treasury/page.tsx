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
  ImageIcon
} from "lucide-react"
import { useFirestore, useCollection, useDoc, useMemoFirebase, useUser } from "@/firebase"
import { collection, doc, setDoc, updateDoc, serverTimestamp, deleteDoc, addDoc, runTransaction, query, orderBy, limit } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { QRCodeCanvas } from "qrcode.react"

export default function TreasuryPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  const [filterSex, setFilterSex] = useState<string>("all")
  const [filterOrigin, setFilterOrigin] = useState<string>("all")
  const [filterYear, setFilterYear] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  const [isCostSaving, setIsCostSaving] = useState(false)
  const [isEventSubmitting, setIsEventSubmitting] = useState(false)
  const [isExpenseSubmitting, setIsEventSubmittingExpense] = useState(false)
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isResettingCounter, setIsResettingCounter] = useState(false)
  
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false)
  const [isProofViewOpen, setIsProofViewOpen] = useState(false)
  const [selectedProof, setSelectedProof] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<string>("ACCOUNT")
  const [expenseProof, setExpenseProof] = useState<string | null>(null)
  const [localDate, setLocalDate] = useState({ day: "", month: "", year: "" })

  const expenseProofRef = useRef<HTMLInputElement>(null)
  const { user: currentUser } = useUser()
  const { toast } = useToast()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
    const today = new Date()
    const options: Intl.DateTimeFormatOptions = { timeZone: 'America/Asuncion' }
    setLocalDate({
      day: today.toLocaleString('es-PY', { ...options, day: 'numeric' }),
      month: today.toLocaleString('es-PY', { ...options, month: 'long' }),
      year: today.toLocaleString('es-PY', { ...options, year: 'numeric' })
    })
  }, [])

  const treasuryRef = useMemoFirebase(() => db ? doc(db, "settings", "treasury") : null, [db])
  const { data: costs } = useDoc(treasuryRef)

  const eventsQuery = useMemoFirebase(() => db ? collection(db, "events") : null, [db])
  const { data: events, loading: loadingEvents } = useCollection(eventsQuery)

  const expensesQuery = useMemoFirebase(() => db ? collection(db, "expenses") : null, [db])
  const { data: expenses, loading: loadingExpenses } = useCollection(expensesQuery)

  // Optimización: Consulta con ordenamiento y límite
  const regsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "confirmations"), orderBy("createdAt", "desc"), limit(300))
  }, [db])
  const { data: registrations, isLoading: loadingRegs } = useCollection(regsQuery)

  const userProfileRef = useMemoFirebase(() => db && currentUser?.uid ? doc(db, "users", currentUser.uid) : null, [db, currentUser?.uid])
  const { data: profile } = useDoc(userProfileRef)

  useEffect(() => {
    if (costs?.paymentMethod) {
      setPaymentMethod(costs.paymentMethod)
    }
  }, [costs])

  const resetFilters = () => {
    setSearchTerm("");
    setFilterSex("all");
    setFilterOrigin("all");
    setFilterYear("all");
    setFilterStatus("all");
  }

  const filteredRegs = useMemo(() => {
    if (!registrations) return []
    return registrations.filter(reg => {
      if (reg.isArchived) return false
      
      const matchesSearch = !searchTerm || 
        reg.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        reg.ciNumber?.includes(searchTerm)
      
      const matchesSex = filterSex === "all" || reg.sexo === filterSex
      const matchesOrigin = filterOrigin === "all" || (filterOrigin === "PUBLIC" ? reg.userId === "public_registration" : reg.userId !== "public_registration")
      const matchesYear = filterYear === "all" || reg.catechesisYear === filterYear
      const matchesStatus = filterStatus === "all" || reg.status === filterStatus

      return matchesSearch && matchesSex && matchesOrigin && matchesYear && matchesStatus
    })
  }, [registrations, searchTerm, filterSex, filterOrigin, filterYear, filterStatus])

  const pendingBalance = useMemo(() => {
    if (!selectedReg) return 0;
    const cost = selectedReg.registrationCost || (selectedReg.catechesisYear === "ADULTOS" ? (costs?.adultCost || 50000) : (costs?.juvenileCost || 35000));
    return Math.max(0, cost - (selectedReg.amountPaid || 0));
  }, [selectedReg, costs]);

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
      data.alias = formData.get("alias") as string || ""
      data.bankName = ""
      data.accountNumber = ""
      data.ownerCi = ""
    }
    try {
      await setDoc(treasuryRef, data, { merge: true })
      toast({ title: "Configuración de pagos actualizada" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" })
    } finally {
      setIsCostSaving(false)
    }
  }

  const handleResetCounter = async () => {
    if (!db || !treasuryRef) return
    setIsResettingCounter(true)
    try {
      await updateDoc(treasuryRef, { nextReceiptNumber: 1 })
      toast({ title: "Contador reiniciado" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error al reiniciar" })
    } finally {
      setIsResettingCounter(false)
    }
  }

  const handleOpenPayment = (reg: any) => {
    setSelectedReg(reg)
    const pending = (reg.registrationCost || 0) - (reg.amountPaid || 0)
    setPaymentAmount(pending > 0 ? pending : 0)
    setIsPaymentDialogOpen(true)
  }

  const openDetailsDialog = (reg: any) => {
    setSelectedReg(reg)
    setIsDetailsDialogOpen(true)
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
        if (!regSnap.exists()) throw "Registro no encontrado";
        const regData = regSnap.data();
        const currentNext = treasurySnap.exists() ? (treasurySnap.data()?.nextReceiptNumber || 1) : 1;
        const formattedReceipt = `001-001-${String(currentNext).padStart(7, '0')}`;
        const currentPaid = regData.amountPaid || 0;
        const newPaid = currentPaid + paymentAmount;
        const regCost = regData.registrationCost || (regData.catechesisYear === "ADULTOS" ? 50000 : 35000);
        const status = newPaid >= regCost ? "PAGADO" : "PARCIAL";
        transaction.update(regRef, { 
          amountPaid: newPaid, 
          paymentStatus: status, 
          status: "INSCRITO",
          lastPaymentDate: serverTimestamp(),
          validatedBy: catechistName,
          receiptNumber: formattedReceipt
        });
        if (!treasurySnap.exists()) {
          transaction.set(treasuryRef, { nextReceiptNumber: currentNext + 1 }, { merge: true });
        } else {
          transaction.update(treasuryRef, { nextReceiptNumber: currentNext + 1 });
        }
        const logRef = doc(collection(db, "audit_logs"));
        transaction.set(logRef, {
          userId: currentUser?.uid || "unknown",
          userName: catechistName,
          action: "Confirmación de Pago",
          module: "tesoreria",
          details: `Cobro confirmado de ${paymentAmount.toLocaleString('es-PY')} Gs. a ${regData.fullName}. Recibo: ${formattedReceipt}`,
          timestamp: serverTimestamp()
        });
        const updatedReg = { ...regData, id: regSnap.id, receiptNumber: formattedReceipt, amountPaid: newPaid, validatedBy: catechistName };
        setSelectedReg(updatedReg);
      });
      toast({ title: "Pago confirmado exitosamente" })
      setIsPaymentDialogOpen(false)
      setIsReceiptOpen(true)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al procesar pago" })
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  const handleShareReceipt = () => {
    if (!selectedReg) return
    const receiptNum = selectedReg.receiptNumber || `001-001-${selectedReg.id?.slice(-7).padStart(7, '0')}`;
    const message = encodeURIComponent(`⛪ *SANTUARIO NACIONAL NSPS*\n\n¡Hola ${selectedReg.fullName}! Tu pago de *${paymentAmount.toLocaleString('es-PY')} Gs.* ha sido registrado.\n\nRecibo Oficial N°: ${receiptNum}`)
    window.open(`https://wa.me/${selectedReg.phone?.replace(/[^0-9]/g, '')}?text=${message}`, '_blank')
  }

  const handleDownloadPDF = async () => {
    const element = document.getElementById("receipt-content-official");
    if (!element) return;
    setIsGeneratingPDF(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff", width: 800, windowWidth: 800 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Recibo-Tesorería-NSPS.pdf`);
      toast({ title: "PDF Generado" });
    } catch (err) {
      toast({ variant: "destructive", title: "Error al generar PDF" });
    } finally {
      setIsGeneratingPDF(false);
    }
  }

  const handleDownloadImage = async () => {
    const element = document.getElementById("receipt-content-official");
    if (!element) return;
    setIsGeneratingPDF(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff", width: 800, windowWidth: 800 });
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `Recibo-Tesorería-NSPS.png`;
      link.href = url;
      link.click();
      toast({ title: "Imagen generada" });
    } catch (err) {
      toast({ variant: "destructive", title: "Error al generar imagen" });
    } finally {
      setIsGeneratingPDF(false);
    }
  }

  const handleCreateEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db) return
    setIsEventSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const category = formData.get("category") as string
    const cost = Number(formData.get("cost"))
    try {
      await addDoc(collection(db, "events"), { category, cost, createdAt: serverTimestamp() })
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
    if (!db || !expenseProof) return
    setIsEventSubmittingExpense(true)
    const formData = new FormData(e.currentTarget)
    try {
      await addDoc(collection(db, "expenses"), {
        concept: formData.get("concept") as string,
        amount: Number(formData.get("amount")),
        proofUrl: expenseProof,
        date: serverTimestamp(),
        registeredBy: profile ? `${profile.firstName} ${profile.lastName}` : "Tesorero"
      })
      toast({ title: "Gasto registrado" })
      setIsExpenseDialogOpen(false)
      setExpenseProof(null)
    } catch (e) {
      toast({ variant: "destructive", title: "Error al registrar" })
    } finally {
      setIsEventSubmittingExpense(false)
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

  const formatYear = (year: string) => {
    switch (year) {
      case "PRIMER_AÑO": return "1° Año"
      case "SEGUNDO_AÑO": return "2° Año"
      case "ADULTOS": return "Adultos"
      default: return year?.replace("_", " ")
    }
  }

  const getSourceBadge = (userId: string) => {
    if (userId === "public_registration") {
      return <div className="flex items-center gap-1 text-[9px] font-bold text-green-600 uppercase bg-green-50 px-2 py-0.5 rounded-full border border-green-100"><Globe className="h-2.5 w-2.5" /> Público</div>;
    }
    return <div className="flex items-center gap-1 text-[9px] font-bold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100"><User className="h-2.5 w-2.5" /> Manual</div>;
  };

  const getGenderBadge = (sexo: string) => {
    if (sexo === "M") return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 text-[10px] font-black h-5 w-5 p-0 flex items-center justify-center rounded-sm">M</Badge>;
    if (sexo === "F") return <Badge className="bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-100 text-[10px] font-black h-5 w-5 p-0 flex items-center justify-center rounded-sm">F</Badge>;
    return <Badge variant="outline" className="text-[10px] font-black h-5 w-5 p-0 flex items-center justify-center rounded-sm text-slate-300">?</Badge>;
  };

  if (!mounted) return null

  const isActuallyLoading = loadingRegs || !registrations;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4"><div className="bg-primary/10 p-3 rounded-2xl"><Church className="h-8 w-8 text-primary" /></div><div><h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Tesorería Institucional</h1><p className="text-muted-foreground font-medium">Santuario Nacional NSPS • 2026</p></div></div>
      </div>

      <Tabs defaultValue="pagos" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-[800px] mb-6 h-12 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="pagos" className="gap-2 rounded-lg data-[state=active]:bg-white shadow-none"><CreditCard className="h-4 w-4" /> Inscripciones</TabsTrigger>
          <TabsTrigger value="eventos" className="gap-2 rounded-lg data-[state=active]:bg-white shadow-none"><CalendarDays className="h-4 w-4" /> Eventos</TabsTrigger>
          <TabsTrigger value="egresos" className="gap-2 rounded-lg data-[state=active]:bg-white shadow-none"><Receipt className="h-4 w-4" /> Egresos</TabsTrigger>
          <TabsTrigger value="config" className="gap-2 rounded-lg data-[state=active]:bg-white shadow-none"><Settings className="h-4 w-4" /> Ajustes</TabsTrigger>
        </TabsList>

        <TabsContent value="pagos">
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por nombre o C.I..." 
                    className="pl-9 bg-slate-50 border-none h-12 rounded-2xl focus:ring-primary shadow-inner" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                  />
                </div>
                <Button variant="ghost" className="h-12 rounded-2xl gap-2 font-bold text-slate-400 hover:text-primary" onClick={resetFilters}>
                  <FilterX className="h-4 w-4" /> Limpiar Filtros
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sexo</Label>
                  <Select value={filterSex} onValueChange={setFilterSex}>
                    <SelectTrigger className="h-11 rounded-xl bg-slate-50/50 border-slate-100 font-medium">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los sexos</SelectItem>
                      <SelectItem value="M">Masculino (M)</SelectItem>
                      <SelectItem value="F">Femenino (F)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Origen</Label>
                  <Select value={filterOrigin} onValueChange={setFilterOrigin}>
                    <SelectTrigger className="h-11 rounded-xl bg-slate-50/50 border-slate-100 font-medium">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los orígenes</SelectItem>
                      <SelectItem value="PUBLIC">Inscripción Pública (QR)</SelectItem>
                      <SelectItem value="MANUAL">Registro Manual (Catequista)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nivel / Año</Label>
                  <Select value={filterYear} onValueChange={setFilterYear}>
                    <SelectTrigger className="h-11 rounded-xl bg-slate-50/50 border-slate-100 font-medium">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los niveles</SelectItem>
                      <SelectItem value="PRIMER_AÑO">1° Año</SelectItem>
                      <SelectItem value="SEGUNDO_AÑO">2° Año</SelectItem>
                      <SelectItem value="ADULTOS">Adultos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-11 rounded-xl bg-slate-50/50 border-slate-100 font-medium">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="INSCRITO">Inscrito (Oficial)</SelectItem>
                      <SelectItem value="POR_VALIDAR">Por Validar Pago</SelectItem>
                      <SelectItem value="PENDIENTE_PAGO">Pendiente Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Card className="border-none shadow-xl overflow-hidden bg-white">
              <CardContent className="p-0">
                {isActuallyLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sincronizando con el Santuario...</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50 hover:bg-transparent">
                        <TableHead className="font-bold py-5 pl-8">Confirmando</TableHead>
                        <TableHead className="font-bold text-center">Sexo</TableHead>
                        <TableHead className="font-bold text-center">Origen</TableHead>
                        <TableHead className="font-bold text-center">Nivel</TableHead>
                        <TableHead className="font-bold text-center">Estado</TableHead>
                        <TableHead className="font-bold text-center">Saldo Pendiente</TableHead>
                        <TableHead className="text-right pr-8 font-bold">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRegs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-20 text-center text-slate-400 italic">No se encontraron inscripciones con los filtros actuales.</TableCell>
                        </TableRow>
                      ) : (
                        filteredRegs.map((reg) => {
                          const pending = (reg.registrationCost || 0) - (reg.amountPaid || 0)
                          const isSettled = pending <= 0 || reg.paymentStatus === "PAGADO"
                          return (
                            <TableRow key={reg.id} className="hover:bg-slate-50/30 h-16">
                              <TableCell className="pl-8">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-9 w-9 border cursor-pointer" onClick={() => { if(reg.photoUrl) { setSelectedProof(reg.photoUrl); setIsProofViewOpen(true); } }}>
                                    <AvatarImage src={reg.photoUrl} className="object-cover" />
                                    <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-sm text-slate-900">{reg.fullName}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">{reg.ciNumber}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center"><div className="flex justify-center">{getGenderBadge(reg.sexo)}</div></TableCell>
                              <TableCell className="text-center"><div className="flex justify-center">{getSourceBadge(reg.userId)}</div></TableCell>
                              <TableCell className="text-center"><Badge variant="secondary" className="text-[9px] uppercase">{formatYear(reg.catechesisYear)}</Badge></TableCell>
                              <TableCell className="text-center"><Badge variant={reg.paymentStatus === "PAGADO" ? "default" : "outline"} className={cn(reg.paymentStatus === "PAGADO" && "bg-green-500")}>{reg.paymentStatus || "PENDIENTE"}</Badge></TableCell>
                              <TableCell className="text-center"><span className={cn("font-bold text-sm", pending > 0 ? "text-red-500" : "text-green-600")}>{pending > 0 ? `${pending.toLocaleString('es-PY')} Gs.` : "Saldado"}</span></TableCell>
                              <TableCell className="text-right pr-8">
                                <div className="flex justify-end gap-2">
                                  {!isSettled && (<Button size="sm" variant="outline" className="h-8 rounded-xl font-bold gap-2 border-primary text-primary" onClick={() => handleOpenPayment(reg)}><CheckCircle2 className="h-3.5 w-3.5" /> Cobrar</Button>)}
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 bg-primary/5 text-primary rounded-lg" onClick={() => openDetailsDialog(reg)}><Eye className="h-4 w-4" /></Button>
                                  {isSettled && (<Button size="sm" variant="ghost" className="h-8 w-8 p-0 bg-green-50 text-green-600 rounded-lg" onClick={() => { setSelectedReg(reg); setPaymentAmount(reg.amountPaid || 0); setIsReceiptOpen(true); }}><FileText className="h-4 w-4" /></Button>)}
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="eventos">
          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between"><div><CardTitle>Eventos Especiales</CardTitle><CardDescription>Conceptos de cobro adicionales.</CardDescription></div><Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}><DialogTrigger asChild><Button className="bg-primary rounded-xl"><Plus className="h-4 w-4 mr-2" /> Nuevo Evento</Button></DialogTrigger><DialogContent className="rounded-3xl"><form onSubmit={handleCreateEvent}><DialogHeader><DialogTitle>Añadir Concepto</DialogTitle></DialogHeader><div className="py-6 space-y-4"><div><Label>Nombre del Evento</Label><Input name="category" required className="h-12 rounded-xl" /></div><div><Label>Costo (Gs)</Label><Input name="cost" type="number" required className="h-12 rounded-xl" /></div></div><DialogFooter><Button type="submit" className="w-full h-12 rounded-xl" disabled={isEventSubmitting}>Crear Evento</Button></DialogFooter></form></DialogContent></Dialog></CardHeader>
            <CardContent className="p-0">{loadingEvents ? (<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) : (<Table><TableHeader><TableRow className="bg-slate-50/50"><TableHead className="font-bold pl-8">Concepto</TableHead><TableHead className="font-bold text-center">Arancel</TableHead><TableHead className="text-right pr-8 font-bold">Acciones</TableHead></TableRow></TableHeader><TableBody>{events?.map((ev: any) => (<TableRow key={ev.id} className="hover:bg-slate-50/30 h-16"><TableCell className="pl-8 font-bold">{ev.category}</TableCell><TableCell className="text-center font-bold">{ev.cost?.toLocaleString('es-PY')} Gs.</TableCell><TableCell className="text-right pr-8"><Button variant="ghost" size="icon" className="text-red-400" onClick={() => deleteDoc(doc(db!, "events", ev.id))}><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>))}</TableBody></Table>)}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="egresos">
          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between"><div><CardTitle>Gestión de Egresos</CardTitle></div><Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}><DialogTrigger asChild><Button className="bg-orange-500 hover:bg-orange-600 rounded-xl"><Plus className="h-4 w-4 mr-2" /> Registrar Gasto</Button></DialogTrigger><DialogContent className="sm:max-w-[500px] rounded-3xl"><form onSubmit={handleCreateExpense} className="space-y-6"><DialogHeader><DialogTitle>Nuevo Comprobante</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Concepto</Label><Input name="concept" required className="h-12 rounded-xl" /></div><div><Label>Monto Pagado</Label><Input name="amount" type="number" required className="h-12 rounded-xl" /></div><div className="space-y-2"><Label>Foto Comprobante</Label><div className={cn("border-2 border-dashed rounded-3xl h-40 flex flex-col items-center justify-center bg-slate-50", expenseProof && "border-green-500 bg-green-50")} onClick={() => expenseProofRef.current?.click()}>{expenseProof ? <img src={expenseProof} className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold">Subir Foto</span>}</div><input type="file" ref={expenseProofRef} className="hidden" accept="image/*" onChange={handleFileChange} /></div></div><DialogFooter><Button type="submit" className="w-full h-12 rounded-xl" disabled={isExpenseSubmitting}>Guardar Registro</Button></DialogFooter></form></DialogContent></Dialog></CardHeader>
            <CardContent className="p-0">{loadingExpenses ? (<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) : (<Table><TableHeader><TableRow className="bg-slate-50/50"><TableHead className="font-bold pl-8">Fecha</TableHead><TableHead className="font-bold">Concepto</TableHead><TableHead className="font-bold text-center">Monto</TableHead><TableHead className="text-right pr-8 font-bold">Ver</TableHead></TableRow></TableHeader><TableBody>{expenses?.map((ex: any) => (<TableRow key={ex.id} className="hover:bg-slate-50/30 h-16"><TableCell className="pl-8 text-xs">{ex.date?.toDate ? ex.date.toDate().toLocaleDateString('es-PY', { timeZone: 'America/Asuncion' }) : '---'}</TableCell><TableCell className="font-bold">{ex.concept}</TableCell><TableCell className="text-center font-bold text-red-500">-{ex.amount?.toLocaleString('es-PY')} Gs.</TableCell><TableCell className="text-right pr-8"><Button variant="outline" size="sm" onClick={() => { setSelectedProof(ex.proofUrl); setIsProofViewOpen(true); }}><Eye className="h-3 w-3" /></Button></TableCell></TableRow>))}</TableBody></Table>)}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <div className="grid gap-8 lg:grid-cols-2">
            <Card className="border-none shadow-xl bg-white overflow-hidden">
              <CardHeader className="bg-primary text-white"><CardTitle>Parámetros</CardTitle></CardHeader>
              <form onSubmit={handleUpdateCosts}>
                <CardContent className="p-8 space-y-6">
                  <div className="grid gap-4 md:grid-cols-2"><div><Label>Juvenil (Gs)</Label><Input name="juvenile" type="number" defaultValue={costs?.juvenileCost} className="h-12 rounded-xl" /></div><div><Label>Adultos (Gs)</Label><Input name="adult" type="number" defaultValue={costs?.adultCost} className="h-12 rounded-xl" /></div></div>
                  <Separator />
                  <div className="flex items-center justify-between p-4 bg-orange-50 rounded-2xl border border-orange-100"><div><p className="text-sm font-bold">Contador Recibos</p></div><Button type="button" variant="outline" size="sm" onClick={handleResetCounter} disabled={isResettingCounter} className="rounded-xl">Reiniciar a 1</Button></div>
                  <Separator />
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="flex gap-6 p-4 bg-slate-50 rounded-2xl border"><div className="flex items-center space-x-2"><RadioGroupItem value="ACCOUNT" id="m-acc" /><Label htmlFor="m-acc">Cuenta</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="ALIAS" id="m-ali" /><Label htmlFor="m-ali">Alias</Label></div></RadioGroup>
                </CardContent>
                <CardFooter className="bg-slate-50 p-6 border-t flex justify-end"><Button type="submit" disabled={isCostSaving} className="h-12 px-8 rounded-xl font-bold">Guardar Cambios</Button></CardFooter>
              </form>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-primary text-white shrink-0"><DialogTitle>Confirmar Cobro</DialogTitle></DialogHeader>
          <div className="p-6 space-y-6"><div className="p-4 bg-slate-50 rounded-2xl border flex justify-between"><span>Saldo:</span><span className="font-black">{(pendingBalance).toLocaleString('es-PY')} Gs.</span></div><div className="space-y-3"><Label>Monto Recibido</Label><Input type="number" className="h-14 text-2xl font-black rounded-2xl" value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} /></div></div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button><Button className="flex-1 bg-green-600" onClick={handleProcessPayment} disabled={paymentAmount <= 0 || isSubmittingPayment}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-[800px] p-0 bg-white rounded-xl shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Recibo</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[85vh]"><div className="p-6 flex justify-center"><div className="w-full max-w-[700px] bg-white text-slate-900 border-2 border-slate-900 p-8 space-y-10" id="receipt-content-official">
            <div className="grid grid-cols-3 gap-4"><div className="col-span-2 border-2 border-slate-900 p-4 min-h-[120px] flex items-center justify-center"><img src="/logo.png" className="max-h-24" /></div><div className="flex flex-col gap-2 h-full justify-between"><div className="border-2 border-slate-900 p-2 text-center bg-slate-50"><p className="text-xl font-black">{paymentAmount.toLocaleString('es-PY')}</p></div><div className="border-2 border-slate-900 p-2 text-center"><p className="text-xs font-black">{selectedReg?.receiptNumber}</p></div></div></div>
            <div className="text-center border-b-2 border-slate-900 pb-2"><h1 className="text-3xl font-black">RECIBO</h1></div>
            <div className="space-y-10"><div>Recibí de: <span className="font-bold uppercase">{selectedReg?.fullName}</span></div><div>La cantidad de: <span className="italic">{paymentAmount.toLocaleString('es-PY')} Guaraníes</span></div><div>En concepto de: <span className="font-bold">Inscripción Catequesis 2026</span></div></div>
            <div className="grid grid-cols-2 gap-6 pt-10"><div>Asunción, {localDate.day} de {localDate.month} de {localDate.year}</div><div className="flex flex-col items-end gap-3"><QRCodeCanvas value={`RECIBO-NSPS-${selectedReg?.receiptNumber}`} size={80} /><p className="text-xs font-bold">{selectedReg?.validatedBy}</p></div></div>
          </div></div></ScrollArea>
          <DialogFooter className="p-4 bg-slate-100 border-t flex flex-row gap-2"><Button variant="outline" className="flex-1" onClick={() => setIsReceiptOpen(false)}>Cerrar</Button><Button className="flex-1 bg-green-600" onClick={handleShareReceipt}>WhatsApp</Button><Button className="flex-1 bg-slate-900" onClick={handleDownloadPDF} disabled={isGeneratingPDF}>PDF</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProofViewOpen} onOpenChange={setIsProofViewOpen}>
        <DialogContent className="max-w-3xl p-0 bg-transparent shadow-none border-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Vista de Documento</DialogTitle>
            <DialogDescription>Previsualización ampliada.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Button variant="secondary" size="icon" className="absolute -top-12 -right-12 rounded-full text-white bg-white/20" onClick={() => setIsProofViewOpen(false)}><X /></Button>
            <img src={selectedProof || ""} className="max-h-[90vh] rounded-xl shadow-2xl" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}