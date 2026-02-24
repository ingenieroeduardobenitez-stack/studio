
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
import { Wallet, Settings, Search, Loader2, CreditCard, FileText, User, Church, Plus, Trash2, CalendarDays, CheckCircle2, Info, Printer, ImageIcon, Receipt, Eye } from "lucide-react"
import { useFirestore, useCollection, useDoc, useMemoFirebase, useUser } from "@/firebase"
import { collection, doc, setDoc, updateDoc, serverTimestamp, deleteDoc, addDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

export default function TreasuryPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isCostSaving, setIsCostSaving] = useState(false)
  const [isEventSubmitting, setIsEventSubmitting] = useState(false)
  const [isExpenseSubmitting, setIsEventSubmittingExpense] = useState(false)
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false)
  const [isProofViewOpen, setIsProofViewOpen] = useState(false)
  const [selectedProof, setSelectedProof] = useState<string | null>(null)
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

  const eventsQuery = useMemoFirebase(() => db ? collection(db, "events") : null, [db])
  const { data: events, loading: loadingEvents } = useCollection(eventsQuery)

  const expensesQuery = useMemoFirebase(() => db ? collection(db, "expenses") : null, [db])
  const { data: expenses, loading: loadingExpenses } = useCollection(expensesQuery)

  const regsQuery = useMemoFirebase(() => db ? collection(db, "confirmations") : null, [db])
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
    return registrations.filter(r => 
      r.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.ciNumber?.includes(searchTerm)
    )
  }, [registrations, searchTerm])

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

  const handleCreateEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db) return
    setIsEventSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const category = formData.get("category") as string
    const cost = Number(formData.get("cost"))

    try {
      await addDoc(collection(db, "events"), {
        category,
        cost,
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
    if (!expenseProof) {
      toast({ variant: "destructive", title: "Comprobante requerido", description: "Debes adjuntar la foto de la factura o ticket." })
      return
    }

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

      await addDoc(collection(db, "audit_logs"), {
        userId: currentUser?.uid || "unknown",
        userName: profile ? `${profile.firstName} ${profile.lastName}` : "Tesorero",
        action: "Registro de Egreso",
        module: "tesoreria",
        details: `Gasto registrado por ${formData.get("concept")} de ${(Number(formData.get("amount"))).toLocaleString()} Gs.`,
        timestamp: serverTimestamp()
      })

      toast({ title: "Gasto registrado", description: "Se ha añadido el comprobante a la base de datos." })
      setIsExpenseDialogOpen(false)
      setExpenseProof(null)
    } catch (e) {
      toast({ variant: "destructive", title: "Error al registrar gasto" })
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

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Tesorería Parroquial</h1>
          <p className="text-muted-foreground">Administración integral de ingresos, egresos y configuración.</p>
        </div>
      </div>

      <Tabs defaultValue="pagos" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-[800px] mb-6 h-12 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="pagos" className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"><CreditCard className="h-4 w-4" /> Inscripciones</TabsTrigger>
          <TabsTrigger value="eventos" className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"><CalendarDays className="h-4 w-4" /> Eventos</TabsTrigger>
          <TabsTrigger value="egresos" className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"><Receipt className="h-4 w-4" /> Egresos</TabsTrigger>
          <TabsTrigger value="config" className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"><Settings className="h-4 w-4" /> Ajustes</TabsTrigger>
        </TabsList>

        <TabsContent value="pagos">
          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Control de Cobros de Inscripción</CardTitle>
                  <CardDescription>Saldos de la etapa de registro para confirmandos.</CardDescription>
                </div>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar confirmando..." className="pl-9 bg-white border-slate-200" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingRegs ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="font-bold">Confirmando</TableHead>
                      <TableHead className="font-bold text-center">Nivel</TableHead>
                      <TableHead className="font-bold text-center">Estado</TableHead>
                      <TableHead className="font-bold text-center">Saldo Pendiente</TableHead>
                      <TableHead className="text-right font-bold pr-8">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegs.map((reg) => {
                      const pending = (reg.registrationCost || 0) - (reg.amountPaid || 0)
                      return (
                        <TableRow key={reg.id} className="hover:bg-slate-50/30 h-16">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border"><AvatarImage src={reg.photoUrl} /><AvatarFallback><User className="h-4 w-4" /></AvatarFallback></Avatar>
                              <div className="flex flex-col"><span className="font-bold text-sm text-slate-900">{reg.fullName}</span><span className="text-[10px] text-muted-foreground">{reg.ciNumber}</span></div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center"><Badge variant="secondary" className="text-[10px] uppercase tracking-tighter">{formatYear(reg.catechesisYear)}</Badge></TableCell>
                          <TableCell className="text-center"><Badge variant={reg.paymentStatus === "PAGADO" ? "default" : "outline"} className={cn(reg.paymentStatus === "PAGADO" && "bg-green-500")}>{reg.paymentStatus || "PENDIENTE"}</Badge></TableCell>
                          <TableCell className="text-center"><span className={cn("font-bold text-sm", pending > 0 ? "text-red-500" : "text-slate-400")}>{pending > 0 ? `${pending.toLocaleString()} Gs.` : "Saldado"}</span></TableCell>
                          <TableCell className="text-right pr-8">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setSelectedReg(reg); setIsReceiptOpen(true); }}><FileText className="h-4 w-4 text-slate-400" /></Button>
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

        <TabsContent value="eventos">
          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle>Eventos Especiales</CardTitle>
                <CardDescription>Crea conceptos de cobro para retiros o encuentros.</CardDescription>
              </div>
              <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
                <DialogTrigger asChild><Button className="bg-primary hover:bg-primary/90 font-bold gap-2"><Plus className="h-4 w-4" /> Nuevo Evento</Button></DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCreateEvent}>
                    <DialogHeader><DialogTitle>Añadir Concepto de Cobro</DialogTitle></DialogHeader>
                    <div className="py-6 space-y-4">
                      <div className="space-y-2"><Label>Nombre del Evento</Label><Input name="category" placeholder="Ej. Retiro de 1er Año" required /></div>
                      <div className="space-y-2"><Label>Costo (Gs)</Label><Input name="cost" type="number" placeholder="30000" required /></div>
                    </div>
                    <DialogFooter><Button type="submit" disabled={isEventSubmitting}>{isEventSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Crear Evento"}</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              {loadingEvents ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (
                <Table>
                  <TableHeader><TableRow className="bg-slate-50/50"><TableHead className="font-bold pl-8">Concepto</TableHead><TableHead className="font-bold text-center">Arancel</TableHead><TableHead className="text-right pr-8">Acciones</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {events?.map((ev: any) => (
                      <TableRow key={ev.id} className="hover:bg-slate-50/30 h-16">
                        <TableCell className="pl-8 font-bold text-slate-900">{ev.category}</TableCell>
                        <TableCell className="text-center font-bold text-primary">{ev.cost?.toLocaleString()} Gs.</TableCell>
                        <TableCell className="text-right pr-8"><Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600" onClick={() => deleteDoc(doc(db!, "events", ev.id))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="egresos">
          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestión de Egresos</CardTitle>
                <CardDescription>Registro de compras, insumos y gastos generales.</CardDescription>
              </div>
              <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                <DialogTrigger asChild><Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold gap-2"><Plus className="h-4 w-4" /> Registrar Gasto</Button></DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <form onSubmit={handleCreateExpense} className="space-y-6">
                    <DialogHeader><DialogTitle>Nuevo Comprobante de Egreso</DialogTitle><DialogDescription>Ingresa los detalles de la compra y adjunta el comprobante legal.</DialogDescription></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2"><Label>Concepto / Detalle de Compra</Label><Input name="concept" placeholder="Ej. Compra de Merienda para Retiro" required /></div>
                      <div className="space-y-2"><Label>Monto Pagado (Gs)</Label><Input name="amount" type="number" placeholder="50000" required className="text-xl font-bold" /></div>
                      <div className="space-y-2">
                        <Label>Foto de Comprobante / Factura</Label>
                        <div className={cn("border-2 border-dashed rounded-2xl h-40 flex flex-col items-center justify-center cursor-pointer overflow-hidden bg-slate-50 hover:bg-slate-100 transition-all", expenseProof && "border-green-500 bg-green-50")} onClick={() => expenseProofRef.current?.click()}>
                          {expenseProof ? <img src={expenseProof} className="w-full h-full object-cover" /> : <><ImageIcon className="h-8 w-8 text-slate-300 mb-2" /><span className="text-[10px] font-bold text-slate-400 uppercase">Subir Foto de Ticket/Factura</span></>}
                        </div>
                        <input type="file" ref={expenseProofRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                      </div>
                    </div>
                    <DialogFooter><Button type="submit" className="w-full h-12" disabled={isExpenseSubmitting}>{isExpenseSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Guardar Registro"}</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              {loadingExpenses ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : expenses?.length === 0 ? (
                <div className="py-20 text-center text-slate-400 italic">No hay egresos registrados recientemente.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="font-bold pl-8">Fecha</TableHead>
                      <TableHead className="font-bold">Concepto</TableHead>
                      <TableHead className="font-bold text-center">Monto</TableHead>
                      <TableHead className="font-bold">Registrado por</TableHead>
                      <TableHead className="text-right pr-8">Comprobante</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses?.map((ex: any) => (
                      <TableRow key={ex.id} className="hover:bg-slate-50/30 h-16">
                        <TableCell className="pl-8 text-xs font-medium text-slate-500">{ex.date?.toDate ? ex.date.toDate().toLocaleDateString() : '---'}</TableCell>
                        <TableCell className="font-bold text-slate-900">{ex.concept}</TableCell>
                        <TableCell className="text-center font-bold text-red-500">{ex.amount?.toLocaleString()} Gs.</TableCell>
                        <TableCell className="text-xs text-slate-500">{ex.registeredBy}</TableCell>
                        <TableCell className="text-right pr-8">
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => { setSelectedProof(ex.proofUrl); setIsProofViewOpen(true); }}><Eye className="h-3 w-3" /> Ver</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <div className="grid gap-8 lg:grid-cols-2">
            <Card className="border-none shadow-xl bg-white overflow-hidden">
              <CardHeader className="bg-primary text-white"><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Parámetros de Cobro</CardTitle></CardHeader>
              <form onSubmit={handleUpdateCosts}>
                <CardContent className="p-8 space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label className="font-bold">Juvenil (Gs)</Label><Input name="juvenile" type="number" defaultValue={costs?.juvenileCost || 35000} className="h-11 rounded-xl" required /></div>
                    <div className="space-y-2"><Label className="font-bold">Adultos (Gs)</Label><Input name="adult" type="number" defaultValue={costs?.adultCost || 50000} className="h-11 rounded-xl" required /></div>
                  </div>
                  <Separator />
                  <div className="space-y-6">
                    <Label className="text-primary font-bold uppercase text-xs">Método de Pago Predeterminado</Label>
                    <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="flex gap-6 p-4 bg-slate-50 rounded-2xl border">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="ACCOUNT" id="mode-acc" /><Label htmlFor="mode-acc" className="font-bold cursor-pointer">Cuenta Completa</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="ALIAS" id="mode-ali" /><Label htmlFor="mode-ali" className="font-bold cursor-pointer">Solo Alias</Label></div>
                    </RadioGroup>
                    <div className="grid gap-4 p-6 border rounded-2xl bg-white shadow-sm">
                      {paymentMethod === "ALIAS" ? (
                        <>
                          <div className="space-y-2"><Label className="font-bold">Alias de Transferencia</Label><Input name="alias" defaultValue={costs?.alias} placeholder="Ej. 0981123456" className="h-12 rounded-xl font-bold text-primary" required /></div>
                          <div className="space-y-2"><Label className="font-bold">Titular de la Cuenta</Label><Input name="accountOwner" defaultValue={costs?.accountOwner} placeholder="Nombre completo" className="h-12 rounded-xl" required /></div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-2"><Label>Nombre del Banco</Label><Input name="bankName" defaultValue={costs?.bankName} className="h-10 rounded-lg" /></div>
                          <div className="space-y-2"><Label>N° de Cuenta</Label><Input name="accountNumber" defaultValue={costs?.accountNumber} className="h-10 rounded-lg" /></div>
                          <div className="space-y-2"><Label>Titular de Cuenta</Label><Input name="accountOwner" defaultValue={costs?.accountOwner} className="h-10 rounded-lg" /></div>
                          <div className="space-y-2"><Label>C.I. del Titular</Label><Input name="ownerCi" defaultValue={costs?.ownerCi} className="h-10 rounded-lg" /></div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-slate-50 p-6 border-t flex justify-end"><Button type="submit" disabled={isCostSaving} className="h-12 px-8 rounded-xl font-bold shadow-lg">{isCostSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Guardar Cambios"}</Button></CardFooter>
              </form>
            </Card>
            <Card className="border-none shadow-xl bg-slate-50 p-8 flex flex-col items-center justify-center space-y-6">
              <div className="bg-white p-10 rounded-3xl border shadow-md w-full max-w-[350px] space-y-6 text-center">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-inner"><Wallet className="h-8 w-8 text-green-600" /></div>
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Vista Previa para Postulantes</p>
                  <p className="text-2xl font-black text-primary uppercase break-all">{paymentMethod === "ALIAS" ? (costs?.alias || "---") : (costs?.accountNumber || "---")}</p>
                  <p className="text-xs text-slate-500 font-bold">{costs?.accountOwner || "---"}</p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* VISTA AMPLIADA DE COMPROBANTE DE GASTO */}
      <Dialog open={isProofViewOpen} onOpenChange={setIsProofViewOpen}>
        <DialogContent className="max-w-3xl p-0 bg-transparent border-none shadow-none">
          <DialogHeader className="sr-only"><DialogTitle>Comprobante de Egreso</DialogTitle></DialogHeader>
          <div className="relative flex items-center justify-center">
            <Button variant="secondary" size="icon" className="absolute -top-12 -right-12 rounded-full h-10 w-10 bg-white/20 text-white" onClick={() => setIsProofViewOpen(false)}><X className="h-6 w-6" /></Button>
            <img src={selectedProof || ""} className="max-h-[90vh] rounded-xl shadow-2xl" />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b"><DialogTitle>Recibo de Pago</DialogTitle><DialogDescription>Comprobante de cobro de inscripción parroquial.</DialogDescription></DialogHeader>
          <div className="p-10 bg-white space-y-8" id="receipt-content">
            <div className="flex items-center justify-between border-b pb-6"><Church className="h-10 w-10 text-primary" /><div className="text-right"><p className="text-xs font-bold text-primary uppercase">Recibo de Pago</p><p className="text-[10px] text-slate-400">EMITIDO EL {new Date().toLocaleDateString()}</p></div></div>
            <div className="space-y-4"><div><p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Inscripción a nombre de</p><p className="text-lg font-bold text-slate-900">{selectedReg?.fullName}</p></div><div className="bg-slate-50 p-6 rounded-2xl border border-dashed space-y-2"><div className="flex justify-between text-sm"><span>Monto Abonado</span><span className="font-bold text-green-600">{reg?.amountPaid?.toLocaleString()} Gs.</span></div><Separator /><div className="flex justify-between text-xs"><span>Saldo Pendiente</span><span className="font-bold text-red-500">0 Gs.</span></div></div></div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3"><Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setIsReceiptOpen(false)}>Cerrar</Button><Button className="flex-1 gap-2 rounded-xl bg-primary text-white h-11 font-bold shadow-lg" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
