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
import { collection, query, where, doc, updateDoc, serverTimestamp, addDoc, runTransaction } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { QRCodeCanvas } from "qrcode.react"

export default function PaymentsManagementPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [selectedEventId, setSelectedEventId] = useState<string>("inscripcion")
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
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

  // Obtener grupos del catequista
  const myGroupsQuery = useMemoFirebase(() => {
    if (!db || !user?.uid) return null
    return query(collection(db, "groups"), where("catequistaIds", "array-contains", user.uid))
  }, [db, user?.uid])

  const { data: myGroups, loading: loadingGroups } = useCollection(myGroupsQuery)

  // Lógica de consulta: Si tiene grupos -> filtrar. Si no -> mostrar general.
  const confirmandsQuery = useMemoFirebase(() => {
    if (!db || loadingGroups) return null
    
    if (myGroups && myGroups.length > 0) {
      // Vista filtrada por sus grupos
      const groupIds = myGroups.map(g => g.id)
      return query(
        collection(db, "confirmations"), 
        where("groupId", "in", groupIds.slice(0, 10))
      )
    } else {
      // Vista general (para catequistas sin grupo aún)
      return collection(db, "confirmations")
    }
  }, [db, myGroups, loadingGroups])

  const { data: confirmands, loading: loadingRegs } = useCollection(confirmandsQuery)

  const eventsQuery = useMemoFirebase(() => db ? collection(db, "events") : null, [db])
  const { data: events } = useCollection(eventsQuery)

  const filteredConfirmands = useMemo(() => {
    if (!confirmands) return []
    return confirmands.filter(r => 
      !r.isArchived && (
        r.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.ciNumber?.includes(searchTerm)
      )
    )
  }, [confirmands, searchTerm])

  const handleOpenPayment = (reg: any) => {
    setSelectedReg(reg)
    const pending = (reg.registrationCost || 0) - (reg.amountPaid || 0)
    setPaymentAmount(pending > 0 ? pending : 0)
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

  const handleProcessPayment = async () => {
    if (!db || !selectedReg || !treasurySettingsRef || isSubmitting) return
    
    setIsSubmitting(true)
    const regRef = doc(db, "confirmations", selectedReg.id)
    const catechistName = profile ? `${profile.firstName} ${profile.lastName}` : "Catequista"
    
    try {
      await runTransaction(db, async (transaction) => {
        const treasurySnap = await transaction.get(treasurySettingsRef);
        if (!treasurySnap.exists()) throw "Settings not found";
        
        const currentNext = treasurySnap.data()?.nextReceiptNumber || 1;
        const formattedReceipt = `001-001-${String(currentNext).padStart(7, '0')}`;
        
        if (selectedEventId === "inscripcion") {
          const newPaid = (selectedReg.amountPaid || 0) + paymentAmount
          const status = newPaid >= (selectedReg.registrationCost || 0) ? "PAGADO" : "PARCIAL"
          transaction.update(regRef, { 
            amountPaid: newPaid, 
            paymentStatus: status, 
            status: "INSCRITO",
            lastPaymentDate: serverTimestamp(),
            validatedBy: catechistName,
            receiptNumber: formattedReceipt
          })
        } else {
          const currentPaid = (selectedReg.eventPayments?.[selectedEventId]?.paid || 0) + paymentAmount
          transaction.update(regRef, {
            [`eventPayments.${selectedEventId}`]: {
              name: selectedEvent?.category || "Evento",
              paid: currentPaid,
              total: selectedEvent?.cost || 0,
              date: new Date().toISOString()
            },
            validatedBy: catechistName,
            receiptNumber: formattedReceipt
          })
        }

        transaction.update(treasurySettingsRef, { nextReceiptNumber: currentNext + 1 });

        const logRef = doc(collection(db, "audit_logs"));
        transaction.set(logRef, {
          userId: user?.uid || "unknown",
          userName: catechistName,
          action: "Cobro de Inscripción",
          module: "pagos",
          details: `Cobro de ${paymentAmount.toLocaleString('es-PY')} Gs. a ${selectedReg.fullName}. Recibo: ${formattedReceipt}`,
          timestamp: serverTimestamp()
        })
      });
      
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
          <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Control de Cobros de Inscripción</h1>
          <p className="text-muted-foreground font-medium">Valida los pagos y genera recibos oficiales del Santuario.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Buscar confirmando..." 
            className="pl-9 bg-white border-slate-200 h-11 rounded-xl shadow-sm" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      <Card className="border-none shadow-xl overflow-hidden bg-white">
        <CardContent className="p-0">
          {loadingRegs || loadingGroups ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-transparent">
                  <TableHead className="font-bold py-5 pl-8">Confirmando</TableHead>
                  <TableHead className="font-bold text-center">Nivel</TableHead>
                  <TableHead className="font-bold text-center">Estado</TableHead>
                  <TableHead className="font-bold text-center">Saldo Pendiente</TableHead>
                  <TableHead className="text-right font-bold pr-8">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConfirmands.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-20 text-center text-slate-400 italic">
                      No se encontraron inscripciones para mostrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredConfirmands.map((reg) => {
                    const pending = (reg.registrationCost || 0) - (reg.amountPaid || 0)
                    const isSettled = pending <= 0 && reg.paymentStatus === "PAGADO"
                    
                    return (
                      <TableRow key={reg.id} className="hover:bg-slate-50/30 h-20 transition-colors">
                        <TableCell className="pl-8">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-10 w-10 border shadow-sm"><AvatarImage src={reg.photoUrl} className="object-cover"/><AvatarFallback><User className="h-5 w-5" /></AvatarFallback></Avatar>
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-slate-900 uppercase tracking-tight leading-none mb-1">{reg.fullName}</span>
                              <span className="text-[10px] text-slate-500 font-bold">{reg.ciNumber}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-[9px] uppercase font-black px-3 h-6 bg-slate-100 text-slate-600 border-none">
                            {formatYear(reg.catechesisYear)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn("text-[9px] uppercase font-black px-3 h-6 border-slate-200", isSettled ? "bg-green-50 text-green-600 border-green-100" : "bg-white text-slate-400")}>
                            {reg.paymentStatus || "PENDIENTE"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center">
                            <span className={cn("font-black text-sm", pending > 0 ? "text-red-500" : "text-green-600")}>
                              {pending > 0 ? pending.toLocaleString('es-PY') : "0"}
                            </span>
                            <span className={cn("text-[10px] font-bold", pending > 0 ? "text-red-500" : "text-green-600")}>Gs.</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          <div className="flex justify-end items-center gap-3">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-10 px-5 rounded-xl font-bold gap-2 border-primary text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                              onClick={() => handleOpenPayment(reg)}
                              disabled={isSettled}
                            >
                              <CheckCircle2 className="h-4 w-4" /> Confirmar Pago
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-10 w-10 text-slate-300 hover:text-primary rounded-xl"
                              onClick={() => { setSelectedReg(reg); setPaymentAmount(reg.amountPaid || 0); setIsReceiptOpen(true); }}
                            >
                              <FileText className="h-5 w-5" />
                            </Button>
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

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <DialogTitle className="font-headline text-xl">Confirmar Cobro</DialogTitle>
            <DialogDescription className="text-white/80">Recibiendo pago de {selectedReg?.fullName}</DialogDescription>
          </DialogHeader>
          
          <div className="p-6 space-y-6">
            <div className="space-y-3">
              <Label className="font-bold text-slate-700 text-xs uppercase tracking-widest">Concepto del Pago</Label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inscripcion">Inscripción Catequesis 2026</SelectItem>
                  {events?.map((ev) => <SelectItem key={ev.id} value={ev.id}>{ev.category} ({ev.cost.toLocaleString('es-PY')} Gs.)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Saldo Pendiente:</p>
              <p className="text-xl font-black text-slate-900">{pendingBalance.toLocaleString('es-PY')} Gs.</p>
            </div>

            <div className="space-y-3">
              <Label className="font-bold text-slate-700 text-xs uppercase tracking-widest">Monto a Registrar (Gs)</Label>
              <Input 
                type="number" 
                className="h-14 text-2xl font-black rounded-2xl bg-white border-primary/20 text-primary shadow-inner"
                value={paymentAmount} 
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 space-y-2">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2"><Info className="h-3 w-3" /> Datos del Santuario</p>
              <div className="flex justify-between items-center text-xs">
                <span className="text-blue-800 font-bold uppercase">{treasurySettings?.paymentMethod === "ALIAS" ? "Alias:" : "N° Cuenta:"}</span>
                <span className="font-black text-primary">{treasurySettings?.paymentMethod === "ALIAS" ? treasurySettings?.alias : treasurySettings?.accountNumber}</span>
              </div>
              <p className="text-[10px] text-blue-500 font-medium truncate">{treasurySettings?.accountOwner}</p>
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button 
              className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 font-bold shadow-lg gap-2" 
              onClick={handleProcessPayment} 
              disabled={paymentAmount <= 0 || isSubmitting}
            >
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <><CheckCircle2 className="h-4 w-4" /> Confirmar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden border-none shadow-2xl bg-white rounded-xl">
          <DialogHeader className="sr-only"><DialogTitle>Recibo de Pago</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[85vh]">
            <div className="p-6 bg-white flex justify-center">
              <div 
                className="w-full max-w-[700px] bg-white text-slate-900 font-serif border-2 border-slate-900 p-8 space-y-10 shadow-sm" 
                id="receipt-content-official"
              >
                <div className="grid grid-cols-3 gap-4 items-center mb-6">
                  <div className="col-span-2 border-2 border-slate-900 p-4 min-h-[120px] flex items-center justify-center relative bg-white">
                    <img src="/logo.png" alt="Logo Santuario" className="max-h-24 object-contain" />
                    <div className="absolute top-1 right-2 text-[7px] font-black uppercase tracking-tighter text-slate-400 text-right leading-tight">Santuario Nacional<br/>Nuestra Señora del Perpetuo Socorro</div>
                  </div>
                  <div className="flex flex-col gap-2 h-full justify-between">
                    <div className="border-2 border-slate-900 p-2 text-center bg-slate-50">
                      <p className="text-[10px] font-black uppercase tracking-tighter">Gs.</p>
                      <p className="text-xl font-black">{paymentAmount.toLocaleString('es-PY')}</p>
                    </div>
                    <div className="border-2 border-slate-900 p-2 text-center bg-white">
                      <p className="text-[8px] font-bold uppercase">Recibo N°</p>
                      <p className="text-xs font-black">{selectedReg?.receiptNumber || `001-001-${selectedReg?.id?.slice(-7).padStart(7, '0')}`}</p>
                    </div>
                  </div>
                </div>

                <div className="text-center border-b-2 border-slate-900 pb-2 mb-4">
                  <h1 className="text-3xl font-black italic tracking-tighter uppercase">RECIBO</h1>
                </div>

                <div className="space-y-10 text-base">
                  <div className="flex items-baseline gap-2 py-1">
                    <span className="whitespace-nowrap font-bold shrink-0 tracking-wide">Recibí(mos) de:</span>
                    <div className="flex-1 border-b border-dotted border-slate-400 font-bold uppercase pb-1 px-2 leading-relaxed truncate">
                      {selectedReg?.fullName}
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2 py-1">
                    <span className="whitespace-nowrap font-bold shrink-0 tracking-wide">la cantidad de:</span>
                    <div className="flex-1 border-b border-dotted border-slate-400 pb-1 px-2 italic leading-relaxed">
                      {paymentAmount.toLocaleString('es-PY')} Guaraníes
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-baseline gap-2 py-1">
                      <span className="whitespace-nowrap font-bold shrink-0 tracking-wide">en concepto de:</span>
                      <div className="flex-1 border-2 border-slate-900 px-4 py-2 font-bold text-xs bg-slate-50 uppercase leading-relaxed">
                        {selectedEventId === 'inscripcion' ? 'Inscripción Catequesis de Confirmación' : (selectedEvent?.category || 'Evento Parroquial')} - {formatYear(selectedReg?.catechesisYear)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2 py-1">
                    <span className="whitespace-nowrap font-bold shrink-0 tracking-wide">en concepto de:</span>
                    <div className="flex-1 border-b border-dotted border-slate-400 pb-1 px-2 text-sm text-slate-700 font-medium italic leading-relaxed">
                      Saldo Pendiente: {((selectedReg?.registrationCost || 0) - (selectedReg?.amountPaid || 0)).toLocaleString('es-PY')} Gs.
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-10">
                  <div className="flex flex-col justify-end space-y-3">
                    <p className="text-sm italic font-medium">
                      Asunción, {new Date().getDate()} de {new Date().toLocaleString('es-PY', { month: 'long' })} de {new Date().getFullYear()}
                    </p>
                    <div className="flex flex-col items-start pt-4">
                      <div className="w-48 border-t border-slate-900"></div>
                      <p className="text-[8px] font-bold uppercase mt-1 tracking-widest">(Firma y aclaración)</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center md:items-end gap-3">
                    <div className="p-1.5 border border-slate-900 rounded-lg bg-white shadow-sm">
                      <QRCodeCanvas 
                        value={`RECIBO-NSPS-${selectedReg?.id}-${paymentAmount}-${selectedReg?.receiptNumber}`}
                        size={80}
                        level="H"
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black uppercase text-primary tracking-widest leading-none">Firma Digitalizada</p>
                      <p className="text-xs font-bold text-slate-900 uppercase mt-1">{selectedReg?.validatedBy || (profile ? `${profile.firstName} ${profile.lastName}` : 'Secretaría del Santuario')}</p>
                      <p className="text-[8px] text-slate-500 font-bold uppercase">{profile?.role || 'Personal Institucional'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-4 bg-slate-100 border-t flex flex-row gap-2">
            <Button variant="outline" className="flex-1 rounded-xl h-12 font-bold" onClick={() => setIsReceiptOpen(false)}>Cerrar</Button>
            <Button className="flex-1 gap-2 rounded-xl bg-green-600 hover:bg-green-700 text-white h-12 font-bold shadow-lg" onClick={() => window.open(`https://wa.me/${selectedReg?.phone?.replace(/[^0-9]/g, '')}`, '_blank')}>
              <MessageCircle className="h-4 w-4" /> WHATSAPP
            </Button>
            <Button className="flex-1 gap-2 rounded-xl bg-slate-900 text-white h-12 font-bold shadow-lg" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> IMPRIMIR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
