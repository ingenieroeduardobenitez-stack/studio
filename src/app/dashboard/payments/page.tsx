
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Wallet, Search, Loader2, Printer, FileText, User, Church, AlertTriangle, CreditCard, CheckCircle2 } from "lucide-react"
import { useFirestore, useCollection, useUser, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export default function PaymentsManagementPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [selectedEventId, setSelectedEventId] = useState<string>("inscripcion")
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [lastPaymentType, setLastPaymentType] = useState<string>("")

  const { user } = useUser()
  const { toast } = useToast()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  // 1. Obtener grupos del catequista
  const myGroupsQuery = useMemoFirebase(() => {
    if (!db || !user?.uid) return null
    return query(collection(db, "groups"), where("catequistaIds", "array-contains", user.uid))
  }, [db, user?.uid])

  const { data: myGroups, loading: loadingGroups } = useCollection(myGroupsQuery)

  // 2. Parámetros para filtrar confirmandos
  const groupFilters = useMemo(() => {
    if (!myGroups || myGroups.length === 0) return null
    return myGroups.map(g => ({ day: g.attendanceDay, year: g.catechesisYear }))
  }, [myGroups])

  // 3. Obtener confirmandos (limitado por ahora a los del primer grupo encontrado para simplicidad MVP)
  const myConfirmandsQuery = useMemoFirebase(() => {
    if (!db || !groupFilters || groupFilters.length === 0) return null
    // Nota: Firestore no permite múltiples OR complejos fácilmente, así que filtramos en memoria o por el primer grupo
    return query(
      collection(db, "confirmations"), 
      where("attendanceDay", "==", groupFilters[0].day),
      where("catechesisYear", "==", groupFilters[0].year)
    )
  }, [db, groupFilters])

  const { data: myConfirmands, loading: loadingRegs } = useCollection(myConfirmandsQuery)

  // 4. Obtener eventos configurados
  const eventsQuery = useMemoFirebase(() => db ? collection(db, "events") : null, [db])
  const { data: events } = useCollection(eventsQuery)

  const filteredConfirmands = useMemo(() => {
    if (!myConfirmands) return []
    return myConfirmands.filter(r => 
      r.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.ciNumber?.includes(searchTerm)
    )
  }, [myConfirmands, searchTerm])

  const handleOpenPayment = (reg: any) => {
    setSelectedReg(reg)
    setPaymentAmount(0)
    setSelectedEventId("inscripcion")
    setIsPaymentDialogOpen(true)
  }

  const selectedEvent = useMemo(() => {
    if (selectedEventId === "inscripcion") return null
    return events?.find(e => e.id === selectedEventId)
  }, [selectedEventId, events])

  const calculatePending = (reg: any) => {
    if (selectedEventId === "inscripcion") {
      return (reg.registrationCost || 0) - (reg.amountPaid || 0)
    }
    // Para eventos, verificamos si ya tiene pagos registrados en el objeto eventPayments
    const eventPaid = reg.eventPayments?.[selectedEventId]?.paid || 0
    const eventTotal = selectedEvent?.cost || 0
    return eventTotal - eventPaid
  }

  const pendingBalance = selectedReg ? calculatePending(selectedReg) : 0
  const isOverpaid = paymentAmount > pendingBalance

  const handleProcessPayment = async () => {
    if (!db || !selectedReg) return
    if (isOverpaid) {
      toast({
        variant: "destructive",
        title: "Monto excedido",
        description: `No puedes cobrar más del saldo pendiente.`
      })
      return
    }

    const regRef = doc(db, "confirmations", selectedReg.id)
    
    if (selectedEventId === "inscripcion") {
      const newPaid = (selectedReg.amountPaid || 0) + paymentAmount
      const total = selectedReg.registrationCost || 0
      const status = newPaid >= total ? "PAGADO" : "PARCIAL"

      updateDoc(regRef, {
        amountPaid: newPaid,
        paymentStatus: status,
        lastPaymentDate: serverTimestamp()
      }).then(() => {
        setLastPaymentType("Inscripción")
        finishPayment()
      })
    } else {
      // Cobro de evento
      const currentEventPayments = selectedReg.eventPayments || {}
      const currentPaid = currentEventPayments[selectedEventId]?.paid || 0
      const newPaid = currentPaid + paymentAmount
      
      updateDoc(regRef, {
        [`eventPayments.${selectedEventId}`]: {
          name: selectedEvent?.category,
          paid: newPaid,
          total: selectedEvent?.cost,
          date: new Date().toISOString()
        }
      }).then(() => {
        setLastPaymentType(selectedEvent?.category || "Evento")
        finishPayment()
      })
    }
  }

  const finishPayment = () => {
    toast({ title: "Pago registrado", description: `Se procesó el cobro de ${paymentAmount.toLocaleString()} Gs.` })
    setIsPaymentDialogOpen(false)
    setIsReceiptOpen(true)
  }

  if (!mounted) return null

  if (!myGroups || myGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-3xl border shadow-sm">
        <Wallet className="h-16 w-16 text-slate-200 mb-4" />
        <h2 className="text-xl font-headline font-bold text-slate-900">Módulo de Cobros</h2>
        <p className="text-muted-foreground mt-2 max-w-md">No tienes grupos asignados para gestionar cobros. Contacta al administrador.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Gestión de Cobros</h1>
          <p className="text-muted-foreground">Control de aranceles y eventos para tus alumnos de {myGroups[0].name}.</p>
        </div>
      </div>

      <Card className="border-none shadow-xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Lista de Confirmandos</CardTitle>
              <CardDescription>Visualiza saldos pendientes y registra nuevos cobros.</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nombre o C.I." 
                className="pl-9 bg-white border-slate-200" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingRegs ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredConfirmands.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">No hay alumnos registrados en tu grupo.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-bold">Alumno</TableHead>
                  <TableHead className="font-bold text-center">Inscripción</TableHead>
                  <TableHead className="font-bold text-center">Saldo Pendiente</TableHead>
                  <TableHead className="text-right font-bold pr-8">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConfirmands.map((reg) => {
                  const pendingIns = (reg.registrationCost || 0) - (reg.amountPaid || 0)
                  return (
                    <TableRow key={reg.id} className="hover:bg-slate-50/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border"><AvatarImage src={reg.photoUrl} /><AvatarFallback><User className="h-4 w-4" /></AvatarFallback></Avatar>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-slate-900">{reg.fullName}</span>
                            <span className="text-[10px] text-slate-500 uppercase font-bold">{reg.ciNumber}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={reg.paymentStatus === "PAGADO" ? "default" : "outline"} className={cn(reg.paymentStatus === "PAGADO" ? "bg-green-500" : "")}>
                          {reg.paymentStatus || "PENDIENTE"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn("font-bold text-sm", pendingIns > 0 ? "text-red-500" : "text-green-600")}>
                          {pendingIns > 0 ? `${pendingIns.toLocaleString()} Gs.` : "Saldado"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="h-8 gap-2 border-primary text-primary hover:bg-primary/5" onClick={() => handleOpenPayment(reg)}>
                            <Wallet className="h-3 w-3" /> Cobrar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setSelectedReg(reg); setLastPaymentType("Inscripción"); setIsReceiptOpen(true); }}>
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

      {/* DIALOGO DE COBRO */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <DialogTitle>Registrar Cobro</DialogTitle>
            <DialogDescription className="text-white/80">Gestión de pagos para {selectedReg?.fullName}</DialogDescription>
          </DialogHeader>
          
          <div className="p-6 space-y-6">
            <div className="space-y-3">
              <Label className="font-bold text-slate-700">Seleccionar Concepto</Label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger className="h-12 rounded-xl bg-slate-50">
                  <SelectValue placeholder="¿Qué estás cobrando?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inscripcion">Inscripción Base</SelectItem>
                  {events?.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>{ev.category} ({ev.cost.toLocaleString()} Gs.)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Saldo Pendiente</span>
                <span className="text-red-500">Adeudado</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold text-slate-900">{pendingBalance.toLocaleString()} Gs.</span>
                <Badge variant="outline" className="text-[10px] bg-white">MÁXIMO</Badge>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="font-bold text-slate-700">Monto a abonar ahora (Gs)</Label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input 
                  type="number" 
                  className={cn(
                    "h-14 text-2xl font-bold rounded-xl pl-12 border-2 transition-all focus:ring-primary",
                    isOverpaid ? "border-red-500 bg-red-50 text-red-900" : "border-slate-200 bg-slate-50"
                  )}
                  value={paymentAmount} 
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  max={pendingBalance}
                  autoFocus
                />
              </div>
              {isOverpaid && (
                <p className="text-[11px] text-red-500 font-bold flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="h-3 w-3" /> El monto no puede superar el saldo pendiente.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 font-bold shadow-lg" onClick={handleProcessPayment} disabled={paymentAmount <= 0 || isOverpaid}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar Cobro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOGO DE RECIBO */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none">
          <div className="p-10 bg-white space-y-8" id="receipt-print">
            <div className="flex items-center justify-between border-b pb-6">
              <div className="flex items-center gap-2">
                <Church className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-headline font-bold text-lg leading-none">PARROQUIA</h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Perpetuo Socorro</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase text-primary">Recibo de Pago</p>
                <p className="text-[9px] text-muted-foreground mt-1">FECHA: {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Concepto de Pago</p>
                  <p className="text-sm font-bold text-slate-900">{lastPaymentType}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Monto Cobrado</p>
                  <p className="text-lg font-bold text-green-600">{paymentAmount.toLocaleString()} Gs.</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">A nombre de</p>
                <p className="text-base font-bold text-slate-900">{selectedReg?.fullName}</p>
                <p className="text-xs text-slate-500">Documento: {selectedReg?.ciNumber}</p>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-300 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Monto del Arancel/Evento</span>
                  <span className="font-bold">{ (selectedEventId === "inscripcion" ? selectedReg?.registrationCost : selectedEvent?.cost)?.toLocaleString() } Gs.</span>
                </div>
                <div className="flex justify-between text-xs text-green-600">
                  <span className="font-medium">Total Abonado a la fecha</span>
                  <span className="font-bold">
                    { (selectedEventId === "inscripcion" ? selectedReg?.amountPaid : (selectedReg?.eventPayments?.[selectedEventId]?.paid || 0))?.toLocaleString() } Gs.
                  </span>
                </div>
                <Separator className="bg-slate-200" />
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-900 uppercase tracking-tighter">Saldo Pendiente</span>
                  <span className="text-red-500">{ pendingBalance.toLocaleString() } Gs.</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 pt-8 border-t border-dashed border-slate-200">
              <div className="h-px w-40 bg-slate-300"></div>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Sello y Firma - Catequesis</p>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsReceiptOpen(false)}>Cerrar</Button>
            <Button className="flex-1 gap-2 rounded-xl shadow-lg" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir Recibo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
