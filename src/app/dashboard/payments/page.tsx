
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Wallet, Search, Loader2, Printer, FileText, User, Church, AlertTriangle, CreditCard, CheckCircle2, Info, Copy } from "lucide-react"
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc, updateDoc, serverTimestamp, addDoc } from "firebase/firestore"
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
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { user } = useUser()
  const { toast } = useToast()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const userProfileRef = useMemoFirebase(() => db && user?.uid ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc(userProfileRef)

  const treasurySettingsRef = useMemoFirebase(() => db ? doc(db, "settings", "treasury") : null, [db])
  const { data: treasurySettings } = useDoc(treasurySettingsRef)

  const myGroupsQuery = useMemoFirebase(() => {
    if (!db || !user?.uid) return null
    return query(collection(db, "groups"), where("catequistaIds", "array-contains", user.uid))
  }, [db, user?.uid])

  const { data: myGroups, loading: loadingGroups } = useCollection(myGroupsQuery)

  const groupFilters = useMemo(() => {
    if (!myGroups || myGroups.length === 0) return null
    return myGroups.map(g => ({ day: g.attendanceDay, year: g.catechesisYear }))
  }, [myGroups])

  const myConfirmandsQuery = useMemoFirebase(() => {
    if (!db || !groupFilters || groupFilters.length === 0) return null
    return query(
      collection(db, "confirmations"), 
      where("attendanceDay", "==", groupFilters[0].day),
      where("catechesisYear", "==", groupFilters[0].year)
    )
  }, [db, groupFilters])

  const { data: myConfirmands, loading: loadingRegs } = useCollection(myConfirmandsQuery)

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
    const eventPaid = reg.eventPayments?.[selectedEventId]?.paid || 0
    const eventTotal = selectedEvent?.cost || 0
    return eventTotal - eventPaid
  }

  const pendingBalance = selectedReg ? calculatePending(selectedReg) : 0
  const isOverpaid = paymentAmount > pendingBalance

  const handleProcessPayment = async () => {
    if (!db || !selectedReg || isSubmitting) return
    if (isOverpaid) {
      toast({ variant: "destructive", title: "Monto excedido" })
      return
    }

    setIsSubmitting(true)
    const regRef = doc(db, "confirmations", selectedReg.id)
    
    try {
      if (selectedEventId === "inscripcion") {
        const newPaid = (selectedReg.amountPaid || 0) + paymentAmount
        const status = newPaid >= (selectedReg.registrationCost || 0) ? "PAGADO" : "PARCIAL"
        await updateDoc(regRef, { 
          amountPaid: newPaid, 
          paymentStatus: status, 
          status: "INSCRITO",
          lastPaymentDate: serverTimestamp() 
        })
        setLastPaymentType("Inscripción")
      } else {
        const currentPaid = (selectedReg.eventPayments?.[selectedEventId]?.paid || 0) + paymentAmount
        await updateDoc(regRef, {
          [`eventPayments.${selectedEventId}`]: {
            name: selectedEvent?.category || "Evento",
            paid: currentPaid,
            total: selectedEvent?.cost || 0,
            date: new Date().toISOString()
          }
        })
        setLastPaymentType(selectedEvent?.category || "Evento")
      }

      await addDoc(collection(db, "audit_logs"), {
        userId: user?.uid || "unknown",
        userName: profile ? `${profile.firstName} ${profile.lastName}` : "Catequista",
        action: "Cobro Directo",
        module: "pagos",
        details: `Cobro manual de ${paymentAmount.toLocaleString()} Gs. a ${selectedReg.fullName}`,
        timestamp: serverTimestamp()
      })
      
      toast({ title: "Pago registrado con éxito" })
      setIsPaymentDialogOpen(false)
      setIsReceiptOpen(true)
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error al procesar" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado" });
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Gestión de Cobros</h1>
          <p className="text-muted-foreground">Registra pagos manuales o transferencias de alumnos.</p>
        </div>
      </div>

      <Card className="border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Confirmandos Asignados</CardTitle>
              <CardDescription>Visualiza saldos y registra nuevos ingresos.</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar alumno..." className="pl-9 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                  <TableHead className="font-bold">Alumno</TableHead>
                  <TableHead className="font-bold text-center">Estado Pago</TableHead>
                  <TableHead className="font-bold text-center">Saldo Restante</TableHead>
                  <TableHead className="text-right font-bold pr-8">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConfirmands.map((reg) => {
                  const pendingIns = (reg.registrationCost || 0) - (reg.amountPaid || 0)
                  return (
                    <TableRow key={reg.id} className="hover:bg-slate-50/30 h-16">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border"><AvatarImage src={reg.photoUrl} /><AvatarFallback><User className="h-4 w-4" /></AvatarFallback></Avatar>
                          <div className="flex flex-col"><span className="font-bold text-sm">{reg.fullName}</span><span className="text-[10px] text-slate-500">{reg.ciNumber}</span></div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={reg.paymentStatus === "PAGADO" ? "default" : "outline"} className={cn(reg.paymentStatus === "PAGADO" && "bg-green-500")}>
                          {reg.paymentStatus || "PENDIENTE"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn("font-bold text-sm", pendingIns > 0 ? "text-red-500" : "text-green-600")}>
                          {pendingIns > 0 ? `${pendingIns.toLocaleString()} Gs.` : "Al día"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <Button size="sm" variant="outline" className="h-8 gap-2 border-primary text-primary hover:bg-primary/5" onClick={() => handleOpenPayment(reg)}>
                          <Wallet className="h-3 w-3" /> Registrar Cobro
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

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <DialogTitle>Registrar Cobro Manual</DialogTitle>
            <DialogDescription className="text-white/80">Recibiendo pago de {selectedReg?.fullName}</DialogDescription>
          </DialogHeader>
          
          <div className="p-6 space-y-6">
            <div className="space-y-3">
              <Label className="font-bold text-slate-700">Concepto del Pago</Label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger className="h-12 rounded-xl bg-slate-50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inscripcion">Inscripción Base</SelectItem>
                  {events?.map((ev) => <SelectItem key={ev.id} value={ev.id}>{ev.category} ({ev.cost.toLocaleString()} Gs.)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
              <p className="text-xs font-bold text-slate-400 uppercase">Saldo Pendiente:</p>
              <p className="text-xl font-bold text-slate-900">{pendingBalance.toLocaleString()} Gs.</p>
            </div>

            <div className="space-y-3">
              <Label className="font-bold text-slate-700">Monto a registrar (Gs)</Label>
              <Input 
                type="number" 
                className={cn("h-14 text-2xl font-bold rounded-xl", isOverpaid ? "border-red-500 bg-red-50" : "bg-slate-50")}
                value={paymentAmount} 
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                max={pendingBalance}
              />
              {isOverpaid && <p className="text-[11px] text-red-500 font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> El monto excede el saldo pendiente.</p>}
            </div>

            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 space-y-2">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2"><Info className="h-3 w-3" /> Datos para transferencia</p>
              <div className="flex justify-between items-center text-sm">
                <span className="text-blue-800 font-bold">{treasurySettings?.paymentMethod === "ALIAS" ? "Alias:" : "N° Cuenta:"}</span>
                <span className="font-black text-primary">{treasurySettings?.paymentMethod === "ALIAS" ? treasurySettings?.alias : treasurySettings?.accountNumber}</span>
              </div>
              <p className="text-[10px] text-blue-500">{treasurySettings?.accountOwner}</p>
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 font-bold shadow-lg" onClick={handleProcessPayment} disabled={paymentAmount <= 0 || isOverpaid || isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Confirmar Cobro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-50 border-b">
            <DialogTitle>Recibo de Cobro</DialogTitle>
            <DialogDescription>Comprobante de pago para el confirmando.</DialogDescription>
          </DialogHeader>
          <div className="p-10 bg-white space-y-8" id="receipt-print">
            <div className="flex items-center justify-between border-b pb-6">
              <Church className="h-10 w-10 text-primary" />
              <div className="text-right">
                <p className="text-[10px] font-bold text-primary uppercase">Recibo Oficial</p>
                <p className="text-[10px] text-slate-400">FECHA: {new Date().toLocaleDateString()}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div><p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">A nombre de</p><p className="text-lg font-bold text-slate-900">{selectedReg?.fullName}</p></div>
              <div className="bg-slate-50 p-6 rounded-2xl border border-dashed space-y-2">
                <div className="flex justify-between text-sm"><span>Monto Cobrado</span><span className="font-bold text-green-600">{paymentAmount.toLocaleString()} Gs.</span></div>
                <Separator />
                <div className="flex justify-between text-xs"><span>Saldo Pendiente</span><span className="font-bold text-red-500">{(pendingBalance - paymentAmount).toLocaleString()} Gs.</span></div>
              </div>
              <p className="text-[9px] text-slate-400 text-center italic">Este es un comprobante interno de la Catequesis de Confirmación.</p>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
            <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setIsReceiptOpen(false)}>Cerrar</Button>
            <Button className="flex-1 gap-2 rounded-xl bg-primary text-white h-11 font-bold shadow-lg" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir Recibo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
