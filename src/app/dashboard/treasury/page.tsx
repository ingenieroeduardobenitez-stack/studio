
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
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
  Clock
} from "lucide-react"
import { useFirestore, useCollection, useDoc, useMemoFirebase, useUser } from "@/firebase"
import { collection, doc, setDoc, serverTimestamp, addDoc, runTransaction, query, orderBy, limit } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { QRCodeCanvas } from "qrcode.react"
import Image from "next/image"

export default function TreasuryPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterYear, setFilterYear] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  
  const [isCostSaving, setIsCostSaving] = useState(false)
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)
  
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentType, setPaymentType] = useState<"EFECTIVO" | "TRANSFERENCIA">("EFECTIVO")
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string>("ACCOUNT")

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
      data.alias = formData.get("alias") as string || ""
      data.bankName = ""
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
            <p className="text-muted-foreground font-medium">Control oficial de ingresos y configuración de aranceles.</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pagos" className="w-full">
        <TabsList className="mb-8 h-12 bg-white p-1 border rounded-xl shadow-sm gap-2">
          <TabsTrigger value="pagos" className="rounded-lg px-8 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
            <Banknote className="h-4 w-4 mr-2" /> Inscripciones
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
                            <Button size="sm" variant="outline" className="h-9 rounded-xl font-bold border-primary text-primary hover:bg-primary/5 gap-2" onClick={() => handleOpenPayment(reg)} disabled={isPaid}>
                              <Banknote className="h-4 w-4" /> Cobrar
                            </Button>
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
                            <Label className="text-xs font-bold text-slate-500">Alias de Transferencia</Label>
                            <Input name="alias" defaultValue={treasurySettings?.alias} placeholder="Ej. parroquia.ps" className="h-12 rounded-xl font-bold text-primary bg-white text-lg" required />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500">Titular de la Cuenta</Label>
                            <Input name="accountOwner" defaultValue={treasurySettings?.accountOwner} placeholder="Nombre completo o Parroquia" className="h-12 rounded-xl bg-white" required />
                          </div>
                          <p className="text-[10px] text-muted-foreground italic md:col-span-2 mt-2">
                            * En este modo, el postulante solo verá el Alias y el Nombre del Titular para realizar transferencias rápidas.
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

      {/* DIALOGO DE PAGO */}
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

      {/* RECIBO OFICIAL */}
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
