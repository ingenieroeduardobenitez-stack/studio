
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
import { Wallet, Settings, Search, Loader2, CreditCard, Printer, FileText, CheckCircle2, User, Church, AlertTriangle, Calendar, Plus, Trash2, Building2 } from "lucide-react"
import { useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase"
import { collection, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export default function TreasuryPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isCostSaving, setIsCostSaving] = useState(false)
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false)

  const { toast } = useToast()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const treasuryRef = useMemo(() => db ? doc(db, "settings", "treasury") : null, [db])
  const { data: costs, loading: loadingCosts } = useDoc(treasuryRef)

  const regsQuery = useMemoFirebase(() => db ? collection(db, "confirmations") : null, [db])
  const { data: registrations, loading: loadingRegs } = useCollection(regsQuery)

  const eventsQuery = useMemoFirebase(() => db ? collection(db, "events") : null, [db])
  const { data: events, loading: loadingEvents } = useCollection(eventsQuery)

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
    const data = {
      juvenileCost: Number(formData.get("juvenile")),
      adultCost: Number(formData.get("adult")),
      bankName: formData.get("bankName") as string || "",
      accountNumber: formData.get("accountNumber") as string || "",
      accountOwner: formData.get("accountOwner") as string || "",
      ownerCi: formData.get("ownerCi") as string || "",
      alias: formData.get("alias") as string || "",
      updatedAt: serverTimestamp()
    }

    setDoc(treasuryRef, data, { merge: true })
      .then(() => {
        toast({ title: "Configuración actualizada", description: "Los costos y datos bancarios se han guardado." })
      })
      .catch(() => toast({ variant: "destructive", title: "Error", description: "No se pudo guardar." }))
      .finally(() => setIsCostSaving(false))
  }

  const handleCreateEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db) return
    setIsSubmittingEvent(true)

    const formData = new FormData(e.currentTarget)
    const eventCost = Number(formData.get("eventCost"))
    const eventCategory = formData.get("eventCategory") as string

    const eventId = `event_${Date.now()}`
    const eventRef = doc(db, "events", eventId)
    
    const eventData = {
      name: eventCategory,
      category: eventCategory,
      cost: eventCost,
      createdAt: serverTimestamp(),
    }

    setDoc(eventRef, eventData)
      .then(() => {
        toast({ title: "Evento creado", description: `El evento "${eventCategory}" se configuró correctamente.` })
        setIsEventDialogOpen(false)
      })
      .catch(() => toast({ variant: "destructive", title: "Error", description: "No se pudo crear el evento." }))
      .finally(() => setIsSubmittingEvent(false))
  }

  const handleDeleteEvent = async (id: string) => {
    if (!db) return
    const eventRef = doc(db, "events", id)
    deleteDoc(eventRef)
      .then(() => toast({ title: "Evento eliminado" }))
      .catch(() => toast({ variant: "destructive", title: "Error" }))
  }

  const handleOpenPayment = (reg: any) => {
    setSelectedReg(reg)
    setPaymentAmount(0)
    setIsPaymentDialogOpen(true)
  }

  const pendingBalance = selectedReg ? (selectedReg.registrationCost || 0) - (selectedReg.amountPaid || 0) : 0
  const isOverpaid = paymentAmount > pendingBalance

  const handleProcessPayment = async () => {
    if (!db || !selectedReg) return
    if (isOverpaid) {
      toast({
        variant: "destructive",
        title: "Monto excedido",
        description: `No puedes cobrar más del saldo pendiente (${pendingBalance.toLocaleString()} Gs).`
      })
      return
    }

    const newPaid = (selectedReg.amountPaid || 0) + paymentAmount
    const total = selectedReg.registrationCost || 0
    const status = newPaid >= total ? "PAGADO" : "PARCIAL"

    const regRef = doc(db, "confirmations", selectedReg.id)
    updateDoc(regRef, {
      amountPaid: newPaid,
      paymentStatus: status,
      lastPaymentDate: serverTimestamp()
    })
      .then(() => {
        toast({ title: "Pago registrado", description: `Se abonó ${paymentAmount.toLocaleString()} Gs.` })
        setIsPaymentDialogOpen(false)
        setIsReceiptOpen(true)
      })
      .catch(() => toast({ variant: "destructive", title: "Error", description: "No se pudo procesar." }))
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Tesorería Parroquial</h1>
          <p className="text-muted-foreground">Control de aranceles, cobros y configuración de pagos bancarios.</p>
        </div>
      </div>

      <Tabs defaultValue="pagos" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[600px] mb-6">
          <TabsTrigger value="pagos" className="gap-2"><CreditCard className="h-4 w-4" /> Pagos</TabsTrigger>
          <TabsTrigger value="eventos" className="gap-2"><Calendar className="h-4 w-4" /> Eventos</TabsTrigger>
          <TabsTrigger value="config" className="gap-2"><Settings className="h-4 w-4" /> Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="pagos">
          <Card className="border-none shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Control de Inscripciones</CardTitle>
                  <CardDescription>Lista de confirmandos y estado de sus cuentas.</CardDescription>
                </div>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por nombre o C.I." 
                    className="pl-9 bg-white" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingRegs ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : filteredRegs.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">No se encontraron registros.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-transparent">
                      <TableHead className="font-bold">Confirmando</TableHead>
                      <TableHead className="font-bold">Categoría</TableHead>
                      <TableHead className="font-bold">Total</TableHead>
                      <TableHead className="font-bold">Abonado</TableHead>
                      <TableHead className="font-bold">Saldo</TableHead>
                      <TableHead className="font-bold">Estado</TableHead>
                      <TableHead className="text-right font-bold">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegs.map((reg) => {
                      const pending = (reg.registrationCost || 0) - (reg.amountPaid || 0)
                      return (
                        <TableRow key={reg.id} className="hover:bg-slate-50/30">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8"><AvatarImage src={reg.photoUrl} /><AvatarFallback><User className="h-4 w-4" /></AvatarFallback></Avatar>
                              <div className="flex flex-col"><span className="font-bold text-sm">{reg.fullName}</span><span className="text-[10px] text-muted-foreground">{reg.ciNumber}</span></div>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px] uppercase">{reg.catechesisYear?.replace("_", " ")}</Badge></TableCell>
                          <TableCell className="font-medium">{reg.registrationCost?.toLocaleString()} Gs.</TableCell>
                          <TableCell className="text-green-600 font-bold">{reg.amountPaid?.toLocaleString()} Gs.</TableCell>
                          <TableCell className={cn("font-bold", pending > 0 ? "text-red-500" : "text-slate-400")}>
                            {pending > 0 ? `${pending.toLocaleString()} Gs.` : "Saldado"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={reg.paymentStatus === "PAGADO" ? "default" : reg.paymentStatus === "PARCIAL" ? "secondary" : "outline"} className={cn(reg.paymentStatus === "PAGADO" ? "bg-green-500" : "")}>
                              {reg.paymentStatus || "PENDIENTE"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {pending > 0 && (
                                <Button size="sm" variant="outline" className="h-8 gap-2" onClick={() => handleOpenPayment(reg)}>
                                  <Wallet className="h-3 w-3" /> Cobrar
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setSelectedReg(reg); setIsReceiptOpen(true); }}>
                                <FileText className="h-4 w-4 text-slate-400" />
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

        <TabsContent value="eventos">
          <div className="space-y-6">
            <div className="flex justify-end">
              <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-primary"><Plus className="h-4 w-4" /> Crear Nuevo Evento</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nuevo Evento o Actividad</DialogTitle>
                    <DialogDescription>Configura el nombre y costo de la jornada o retiro.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateEvent} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="eventCategory">Descripción del Evento</Label>
                      <Input id="eventCategory" name="eventCategory" placeholder="Ej. Retiro 2026, Jornada, Libro, etc." required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eventCost">Monto Sugerido (Gs)</Label>
                      <Input id="eventCost" name="eventCost" type="number" required />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsEventDialogOpen(false)}>Cancelar</Button>
                      <Button type="submit" disabled={isSubmittingEvent}>
                        {isSubmittingEvent ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Guardar Evento"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="border-none shadow-xl overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b">
                <CardTitle>Eventos Configurados</CardTitle>
                <CardDescription>Lista de actividades con costos fijados para tesorería.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingEvents ? (
                  <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : events?.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground italic">No hay eventos configurados.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50">
                        <TableHead className="font-bold">Descripción / Evento</TableHead>
                        <TableHead className="font-bold">Costo Fijado</TableHead>
                        <TableHead className="text-right font-bold">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events?.map((ev) => (
                        <TableRow key={ev.id}>
                          <TableCell className="font-bold">{ev.category}</TableCell>
                          <TableCell className="font-bold text-primary">{ev.cost?.toLocaleString()} Gs.</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-red-50" onClick={() => handleDeleteEvent(ev.id)}>
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
          </div>
        </TabsContent>

        <TabsContent value="config">
          <div className="grid gap-8 lg:grid-cols-2">
            <Card className="border-none shadow-xl">
              <CardHeader className="bg-primary text-white">
                <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Aranceles Base</CardTitle>
                <CardDescription className="text-white/80">Define los costos que verán los postulantes al inscribirse.</CardDescription>
              </CardHeader>
              <form onSubmit={handleUpdateCosts}>
                <CardContent className="p-8 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="juvenile" className="font-bold">Confirmación Juvenil (Gs)</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="juvenile" name="juvenile" type="number" defaultValue={costs?.juvenileCost || 35000} className="pl-10 h-12 rounded-xl" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adult" className="font-bold">Catequesis Adultos (Gs)</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="adult" name="adult" type="number" defaultValue={costs?.adultCost || 50000} className="pl-10 h-12 rounded-xl" required />
                    </div>
                  </div>

                  <Separator className="my-6" />
                  
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2"><Building2 className="h-4 w-4" /> Datos de Cuenta Bancaria</h3>
                    <p className="text-xs text-muted-foreground italic">Estos datos se mostrarán a los postulantes que se inscriban vía web para que realicen sus transferencias.</p>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Nombre del Banco</Label>
                      <Input name="bankName" defaultValue={costs?.bankName} placeholder="Ej. Banco Itau, Sudameris, etc." className="h-10 rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">N° de Cuenta</Label>
                      <Input name="accountNumber" defaultValue={costs?.accountNumber} placeholder="000000000" className="h-10 rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Titular de la Cuenta</Label>
                      <Input name="accountOwner" defaultValue={costs?.accountOwner} placeholder="Nombre completo o Parroquia" className="h-10 rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">C.I. o RUC del Titular</Label>
                      <Input name="ownerCi" defaultValue={costs?.ownerCi} placeholder="1.234.567-8" className="h-10 rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Alias (Transferencias Rápidas)</Label>
                      <Input name="alias" defaultValue={costs?.alias} placeholder="Ej. parroquia.ps" className="h-10 rounded-lg font-bold text-primary" />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-slate-50 p-6 border-t flex justify-end">
                  <Button type="submit" disabled={isCostSaving} className="h-11 px-8 rounded-xl font-bold shadow-lg">
                    {isCostSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
                    Guardar Configuración
                  </Button>
                </CardFooter>
              </form>
            </Card>

            <Card className="border-none shadow-xl bg-slate-50">
              <CardHeader>
                <CardTitle className="text-lg">Vista Previa para el Postulante</CardTitle>
                <CardDescription>Así verá el usuario los datos de pago al inscribirse públicamente.</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="bg-white p-8 rounded-3xl border shadow-md space-y-8">
                  <div className="flex items-center gap-4 border-b pb-6">
                    <div className="h-12 w-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shadow-sm"><Wallet className="h-6 w-6" /></div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Información de Pago</p>
                      <p className="font-bold text-lg text-slate-900">Transferencia Bancaria</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4 px-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Banco:</span>
                      <span className="font-bold text-slate-900">{costs?.bankName || "---"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Cuenta N°:</span>
                      <span className="font-bold font-mono text-slate-900">{costs?.accountNumber || "---"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Titular:</span>
                      <span className="font-bold text-slate-900">{costs?.accountOwner || "---"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Documento:</span>
                      <span className="font-bold text-slate-900">{costs?.ownerCi || "---"}</span>
                    </div>
                    {costs?.alias && (
                      <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                        <span className="text-primary font-bold">Alias:</span>
                        <span className="font-black text-primary uppercase tracking-tighter">{costs.alias}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 p-6 rounded-2xl border border-dashed flex flex-col items-center gap-4">
                    <div className="h-28 w-28 bg-slate-200 rounded-xl flex items-center justify-center text-[10px] text-slate-400 text-center font-bold px-2 shadow-inner">CÓDIGO QR GENERADO</div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em]">Escanear para transferir</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOGO DE COBRO */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Registrar Cobro</DialogTitle>
            <DialogDescription>Abono para {selectedReg?.fullName}</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border space-y-2">
              <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase"><span>Total Deuda</span><span>Pendiente</span></div>
              <div className="flex justify-between text-lg font-bold">
                <span>{selectedReg?.registrationCost?.toLocaleString()} Gs.</span>
                <span className="text-red-500">{pendingBalance.toLocaleString()} Gs.</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Monto a cobrar ahora</Label>
              <Input 
                type="number" 
                className={cn(
                  "h-12 text-xl font-bold rounded-xl",
                  isOverpaid ? "border-red-500 bg-red-50" : ""
                )}
                value={paymentAmount} 
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                max={pendingBalance}
                autoFocus
              />
              {isOverpaid && (
                <p className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> No puede superar el saldo pendiente.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleProcessPayment} disabled={paymentAmount <= 0 || isOverpaid}>Confirmar Cobro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOGO DE RECIBO */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Recibo de Pago</DialogTitle>
            <DialogDescription>Comprobante oficial de pago para impresión.</DialogDescription>
          </DialogHeader>
          <div className="p-10 bg-white space-y-8" id="receipt-content">
            <div className="flex items-center justify-between border-b pb-6">
              <div className="flex items-center gap-2">
                <Church className="h-8 w-8 text-primary" />
                <div><h3 className="font-headline font-bold text-lg leading-none">PARROQUIA</h3><p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Perpetuo Socorro</p></div>
              </div>
              <div className="text-right"><p className="text-xs font-bold uppercase text-primary">Recibo de Pago</p><p className="text-[10px] text-muted-foreground mt-1">ID: {selectedReg?.id?.slice(-8)}</p></div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Concepto</p><p className="text-sm font-bold text-slate-900">Inscripción {selectedReg?.catechesisYear?.replace("_", " ")}</p></div>
                <div><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Fecha</p><p className="text-sm font-bold text-slate-900">{new Date().toLocaleDateString()}</p></div>
              </div>
              <div><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Confirmando</p><p className="text-base font-bold text-primary">{selectedReg?.fullName}</p><p className="text-xs text-slate-500">C.I. {selectedReg?.ciNumber}</p></div>
              
              <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-300 space-y-4">
                <div className="flex justify-between text-xs border-b pb-2"><span>Monto Total Arancel</span><span className="font-bold">{selectedReg?.registrationCost?.toLocaleString()} Gs.</span></div>
                <div className="flex justify-between text-xs border-b pb-2"><span>Monto Abonado</span><span className="font-bold text-green-600">{selectedReg?.amountPaid?.toLocaleString()} Gs.</span></div>
                <Separator className="bg-slate-200" />
                <div className="flex justify-between text-sm pt-2 font-bold"><span>Saldo Pendiente</span><span className="text-red-500">{((selectedReg?.registrationCost || 0) - (selectedReg?.amountPaid || 0)).toLocaleString()} Gs.</span></div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 pt-8 border-t border-dashed border-slate-200">
              <div className="h-px w-40 bg-slate-300"></div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Sello y Firma Tesorería</p>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3 print:hidden">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsReceiptOpen(false)}>Cerrar</Button>
            <Button className="flex-1 gap-2 rounded-xl shadow-lg" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir Recibo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
