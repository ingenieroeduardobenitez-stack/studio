
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Wallet, Search, Loader2, Printer, FileText, User, Church, AlertTriangle, CreditCard, CheckCircle2, Info, Contact } from "lucide-react"
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, updateDoc, serverTimestamp, addDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export default function CatechistPaymentsPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [selectedEventId, setSelectedEventId] = useState<string>("")
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { user: currentUser } = useUser()
  const { toast } = useToast()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const userProfileRef = useMemoFirebase(() => db && currentUser?.uid ? doc(db, "users", currentUser.uid) : null, [db, currentUser?.uid])
  const { data: profile } = useDoc(userProfileRef)

  const usersQuery = useMemoFirebase(() => db ? collection(db, "users") : null, [db])
  const { data: catechists, loading: loadingUsers } = useCollection(usersQuery)

  const eventsQuery = useMemoFirebase(() => db ? collection(db, "events") : null, [db])
  const { data: events, loading: loadingEvents } = useCollection(eventsQuery)

  const filteredCatechists = useMemo(() => {
    if (!catechists) return []
    return catechists.filter(u => 
      `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [catechists, searchTerm])

  const selectedEvent = useMemo(() => {
    return events?.find(e => e.id === selectedEventId)
  }, [selectedEventId, events])

  const calculatePending = (u: any) => {
    if (!selectedEventId || !selectedEvent) return 0
    const eventPaid = u.eventPayments?.[selectedEventId]?.paid || 0
    const eventTotal = selectedEvent.cost || 0
    return eventTotal - eventPaid
  }

  const handleOpenPayment = (u: any) => {
    setSelectedUser(u)
    setPaymentAmount(0)
    setSelectedEventId(events?.[0]?.id || "")
    setIsPaymentDialogOpen(true)
  }

  const handleProcessPayment = async () => {
    if (!db || !selectedUser || !selectedEventId || isSubmitting) return
    
    setIsSubmitting(true)
    const userRef = doc(db, "users", selectedUser.id)
    
    const currentPaid = (selectedUser.eventPayments?.[selectedEventId]?.paid || 0) + paymentAmount
    const eventData = {
      name: selectedEvent?.category || "Evento",
      paid: currentPaid,
      total: selectedEvent?.cost || 0,
      date: new Date().toISOString()
    }

    try {
      await updateDoc(userRef, {
        [`eventPayments.${selectedEventId}`]: eventData
      })

      await addDoc(collection(db, "audit_logs"), {
        userId: currentUser?.uid || "unknown",
        userName: profile ? `${profile.firstName} ${profile.lastName}` : "Tesorero",
        action: "Cobro a Catequista",
        module: "pagos",
        details: `Cobro de ${paymentAmount.toLocaleString('es-PY')} Gs. a ${selectedUser.firstName} ${selectedUser.lastName} por ${selectedEvent?.category}`,
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

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Cobro a Catequistas</h1>
          <p className="text-muted-foreground">Registra los pagos del personal del Santuario Nacional.</p>
        </div>
      </div>

      <Card className="border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar catequista por nombre..." 
                className="pl-9 bg-white border-slate-200" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <Contact className="h-4 w-4" />
              {filteredCatechists.length} Personal registrado
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingUsers || loadingEvents ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-bold pl-8">Catequista / Personal</TableHead>
                  <TableHead className="font-bold">Rol</TableHead>
                  <TableHead className="font-bold">Email</TableHead>
                  <TableHead className="text-right font-bold pr-8">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCatechists.map((u) => (
                  <TableRow key={u.id} className="hover:bg-slate-50/30 h-16">
                    <TableCell className="pl-8">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                          <AvatarImage src={u.photoUrl} />
                          <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                        <span className="font-bold text-sm">{u.firstName} {u.lastName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase">{u.role}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{u.email}</TableCell>
                    <TableCell className="text-right pr-8">
                      <Button size="sm" variant="outline" className="h-8 gap-2 border-primary text-primary hover:bg-primary/5" onClick={() => handleOpenPayment(u)}>
                        <Wallet className="h-3 w-3" /> Registrar Cobro
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <DialogTitle>Cobro a Personal</DialogTitle>
            <DialogDescription className="text-white/80">Catequista: {selectedUser?.firstName} {selectedUser?.lastName}</DialogDescription>
          </DialogHeader>
          
          <div className="p-6 space-y-6">
            <div className="space-y-3">
              <Label className="font-bold text-slate-700">Seleccionar Evento</Label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger className="h-12 rounded-xl bg-slate-50"><SelectValue placeholder="Elige un evento..." /></SelectTrigger>
                <SelectContent>
                  {events?.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>{ev.category} ({ev.cost.toLocaleString('es-PY')} Gs.)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEvent && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
                <p className="text-xs font-bold text-slate-400 uppercase">Saldo Pendiente:</p>
                <p className="text-xl font-bold text-slate-900">{calculatePending(selectedUser).toLocaleString('es-PY')} Gs.</p>
              </div>
            )}

            <div className="space-y-3">
              <Label className="font-bold text-slate-700">Monto a Cobrar (Gs)</Label>
              <Input 
                type="number" 
                className="h-14 text-2xl font-bold rounded-xl bg-slate-50"
                value={paymentAmount} 
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
              />
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button 
              className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 font-bold shadow-lg" 
              onClick={handleProcessPayment} 
              disabled={paymentAmount <= 0 || !selectedEventId || isSubmitting}
            >
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Confirmar Cobro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl bg-white">
          <DialogHeader className="sr-only">
            <DialogTitle>Recibo de Pago</DialogTitle>
            <DialogDescription>Comprobante de pago para el catequista.</DialogDescription>
          </DialogHeader>
          <div className="p-10 bg-white space-y-8" id="receipt-content-catechist">
            <div className="flex items-center justify-between border-b pb-6">
              <Church className="h-10 w-10 text-primary" />
              <div className="text-right">
                <p className="text-xs font-bold text-primary uppercase tracking-widest">Recibo de Personal</p>
                <p className="text-[10px] text-slate-400">EMITIDO EL {new Date().toLocaleDateString()}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Pagado por</p>
                <p className="text-lg font-bold text-slate-900">{selectedUser?.firstName} {selectedUser?.lastName}</p>
                <p className="text-[10px] text-slate-400 font-medium">{selectedUser?.role}</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border border-dashed space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                  <span>Concepto</span>
                  <span>Monto</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{selectedEvent?.category}</span>
                  <span className="font-bold text-green-600">{paymentAmount.toLocaleString('es-PY')} Gs.</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-xs italic text-slate-400">
                  <span>Saldo Pendiente</span>
                  <span>{(calculatePending(selectedUser) - paymentAmount).toLocaleString('es-PY')} Gs.</span>
                </div>
              </div>
              <p className="text-[9px] text-slate-400 text-center italic pt-4">
                Comprobante interno del Santuario Nacional Nuestra Señora del Perpetuo Socorro.
              </p>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
            <Button variant="outline" className="flex-1 rounded-xl h-11 font-bold" onClick={() => setIsReceiptOpen(false)}>Cerrar</Button>
            <Button className="flex-1 gap-2 rounded-xl bg-primary text-white h-11 font-bold shadow-lg" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
