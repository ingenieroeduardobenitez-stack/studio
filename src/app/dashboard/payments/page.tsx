
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Wallet, Search, Loader2, Printer, FileText, User, Church, AlertTriangle, CreditCard, CheckCircle2, QrCode, Info, Copy } from "lucide-react"
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc, updateDoc, serverTimestamp, addDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { QRCodeCanvas } from "qrcode.react"
import { cn } from "@/lib/utils"

/**
 * UTILIDAD DE GENERACIÓN PY-QR (ESTÁNDAR EMVCO)
 */
const computeCRC = (str: string) => {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
};

const formatTag = (tag: string, value: string) => {
  return tag.padStart(2, '0') + value.length.toString().padStart(2, '0') + value;
};

const generatePyQr = ({ alias, bankName, accountNumber, accountOwner, amount, concept }: any) => {
  try {
    let payload = "";
    payload += formatTag("00", "01"); // Payload Format Indicator
    payload += formatTag("01", "12"); // Point of Initiation (12 = Dynamic)
    
    // Tag 26: Merchant Account Information (SPI BCP)
    let merchantInfo = formatTag("00", "py.gov.bcp.spi");
    if (alias) {
      merchantInfo += formatTag("01", alias.trim());
    } else {
      merchantInfo += formatTag("01", (accountNumber || "").replace(/[^0-9]/g, ''));
      merchantInfo += formatTag("02", (bankName || "SPI").substring(0, 10));
    }
    payload += formatTag("26", merchantInfo);
    
    payload += formatTag("52", "0000"); // Merchant Category Code
    payload += formatTag("53", "600");  // Transaction Currency (600 = PYG)
    payload += formatTag("54", Math.floor(amount).toString()); // Amount
    payload += formatTag("58", "PY");   // Country Code
    payload += formatTag("59", accountOwner.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 25).toUpperCase()); 
    payload += formatTag("60", "ASUNCION"); 
    
    // Concepto
    const cleanConcept = concept.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 20);
    payload += formatTag("62", formatTag("05", cleanConcept));
    
    payload += "6304"; // Tag CRC
    payload += computeCRC(payload);
    
    return payload;
  } catch (e) {
    console.error("QR Error", e);
    return "";
  }
};

export default function PaymentsManagementPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [selectedEventId, setSelectedEventId] = useState<string>("inscripcion")
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [showPaymentQr, setShowPaymentQr] = useState(false)
  const [lastPaymentType, setLastPaymentType] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { user } = useUser()
  const { toast } = useToast()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const userProfileRef = useMemo(() => db && user?.uid ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc(userProfileRef)

  const treasurySettingsRef = useMemo(() => db ? doc(db, "settings", "treasury") : null, [db])
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
    setShowPaymentQr(false)
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

  const qrPaymentData = useMemo(() => {
    if (!treasurySettings || !selectedReg || paymentAmount <= 0) return ""
    return generatePyQr({
      alias: treasurySettings.paymentMethod === "ALIAS" ? treasurySettings.alias : null,
      bankName: treasurySettings.bankName,
      accountNumber: treasurySettings.accountNumber,
      accountOwner: treasurySettings.accountOwner,
      amount: paymentAmount,
      concept: `${selectedEventId === 'inscripcion' ? 'INS' : 'EV'} ${selectedReg.fullName}`
    });
  }, [treasurySettings, selectedReg, paymentAmount, selectedEventId])

  const handleProcessPayment = async () => {
    if (!db || !selectedReg || isSubmitting) return
    if (isOverpaid) {
      toast({
        variant: "destructive",
        title: "Monto excedido",
        description: `No puedes cobrar más del saldo pendiente.`
      })
      return
    }

    setIsSubmitting(true)
    const regRef = doc(db, "confirmations", selectedReg.id)
    
    try {
      if (selectedEventId === "inscripcion") {
        const newPaid = (selectedReg.amountPaid || 0) + paymentAmount
        const total = selectedReg.registrationCost || 0
        const status = newPaid >= total ? "PAGADO" : "PARCIAL"

        await updateDoc(regRef, {
          amountPaid: newPaid,
          paymentStatus: status,
          lastPaymentDate: serverTimestamp()
        })
        setLastPaymentType("Inscripción")
      } else {
        const currentEventPayments = selectedReg.eventPayments || {}
        const currentPaid = currentEventPayments[selectedEventId]?.paid || 0
        const newPaid = currentPaid + paymentAmount
        
        await updateDoc(regRef, {
          [`eventPayments.${selectedEventId}`]: {
            name: selectedEvent?.category || "Evento",
            paid: newPaid,
            total: selectedEvent?.cost || 0,
            date: new Date().toISOString()
          }
        })
        setLastPaymentType(selectedEvent?.category || "Evento")
      }

      await addDoc(collection(db, "audit_logs"), {
        userId: user?.uid || "unknown",
        userName: profile ? `${profile.firstName} ${profile.lastName}` : "Catequista",
        action: "Cobro de Arancel",
        module: "pagos",
        details: `Cobro de ${paymentAmount.toLocaleString()} Gs. a ${selectedReg.fullName} por concepto de ${selectedEventId === 'inscripcion' ? 'Inscripción' : selectedEvent?.category}`,
        timestamp: serverTimestamp()
      })
      
      toast({ title: "Pago registrado", description: `Se procesó el cobro de ${paymentAmount.toLocaleString()} Gs.` })
      setIsPaymentDialogOpen(false)
      setIsReceiptOpen(true)
    } catch (error) {
      console.error("Error processing payment:", error)
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar el pago." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado", description: "Dato copiado al portapapeles." });
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

      <Card className="border-none shadow-xl overflow-hidden bg-white">
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

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <DialogTitle>Registrar Cobro</DialogTitle>
            <DialogDescription className="text-white/80">Gestión de pagos para {selectedReg?.fullName}</DialogDescription>
          </DialogHeader>
          
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="space-y-3">
              <Label className="font-bold text-slate-700">Seleccionar Concepto</Label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId} disabled={isSubmitting}>
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
                  disabled={isSubmitting}
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

            {paymentAmount > 0 && (
              <div className="pt-2 space-y-4">
                {!showPaymentQr ? (
                  <Button 
                    variant="outline" 
                    className="w-full h-12 rounded-xl gap-2 border-dashed border-primary/40 text-primary"
                    onClick={() => setShowPaymentQr(true)}
                  >
                    <QrCode className="h-4 w-4" /> Generar PY-QR Estándar
                  </Button>
                ) : (
                  <div className="flex flex-col items-center bg-slate-50 p-6 rounded-2xl border border-primary/10 animate-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-primary text-white text-[8px] font-black px-1.5 py-0.5 rounded">PY-QR</div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Estándar BCP / SPI</span>
                    </div>
                    
                    <div className="p-3 bg-white rounded-2xl shadow-sm border-4 border-slate-100">
                      <QRCodeCanvas value={qrPaymentData} size={180} level="M" />
                    </div>
                    
                    <div className="mt-4 w-full space-y-2">
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
                        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-blue-700 leading-tight">
                          Este código incluye firma CRC16 y cumple con el estándar de interoperabilidad de bancos locales.
                        </p>
                      </div>
                      
                      <div className="space-y-1 pt-2">
                        {treasurySettings?.paymentMethod === "ALIAS" ? (
                          <div className="flex justify-between items-center text-[11px] p-2 bg-white rounded-lg border">
                            <span className="font-bold text-slate-500 uppercase">Alias:</span>
                            <span className="font-black text-primary flex items-center gap-2">
                              {treasurySettings.alias}
                              <Copy className="h-3 w-3 cursor-pointer" onClick={() => copyToClipboard(treasurySettings.alias)} />
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-center text-[11px] p-2 bg-white rounded-lg border">
                              <span className="font-bold text-slate-500 uppercase">Cuenta:</span>
                              <span className="font-mono font-bold text-slate-900 flex items-center gap-2">
                                {treasurySettings?.accountNumber}
                                <Copy className="h-3 w-3 cursor-pointer" onClick={() => copyToClipboard(treasurySettings?.accountNumber)} />
                              </span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between items-center text-[11px] p-2 bg-white rounded-lg border">
                          <span className="font-bold text-slate-500 uppercase">Monto:</span>
                          <span className="font-bold text-green-600">{paymentAmount.toLocaleString()} Gs.</span>
                        </div>
                      </div>
                    </div>
                    
                    <Button variant="ghost" size="sm" className="mt-4 text-[10px] h-6" onClick={() => setShowPaymentQr(false)}>Ocultar QR</Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
            <Button variant="outline" disabled={isSubmitting} className="flex-1 h-12 rounded-xl font-bold" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 font-bold shadow-lg" onClick={handleProcessPayment} disabled={paymentAmount <= 0 || isOverpaid || isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar Cobro</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-10 bg-white space-y-8 print:p-8" id="receipt-print">
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
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3 print:hidden">
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
