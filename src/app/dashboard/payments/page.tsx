
"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { 
  Wallet, 
  Search, 
  Loader2, 
  Printer, 
  FileText, 
  User, 
  Church, 
  CheckCircle2, 
  Info, 
  Copy,
  Banknote,
  ArrowRightLeft,
  Image as ImageIcon,
  Download,
  MessageCircle,
  X,
  Camera,
  FlipHorizontal
} from "lucide-react"
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc, updateDoc, serverTimestamp, addDoc, runTransaction } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { QRCodeCanvas } from "qrcode.react"

export default function PaymentsManagementPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [selectedEventId, setSelectedEventId] = useState<string>("inscripcion")
  const [paymentType, setPaymentType] = useState<"EFECTIVO" | "TRANSFERENCIA">("EFECTIVO")
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null)
  const [localDate, setLocalDate] = useState({ day: "", month: "", year: "" })

  // Estados de Cámara
  const [showCamera, setShowCamera] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null)
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null)

  const proofInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { user } = useUser()
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

  const userProfileRef = useMemoFirebase(() => db && user?.uid ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc(userProfileRef)

  const treasurySettingsRef = useMemoFirebase(() => db ? doc(db, "settings", "treasury") : null, [db])
  const { data: treasurySettings } = useDoc(treasurySettingsRef)

  const myGroupsQuery = useMemoFirebase(() => {
    if (!db || !user?.uid) return null
    return query(collection(db, "groups"), where("catequistaIds", "array-contains", user.uid))
  }, [db, user?.uid])

  const { data: myGroups } = useCollection(myGroupsQuery)

  const confirmandsQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "confirmations")
  }, [db])

  const { data: allConfirmands, loading: loadingRegs } = useCollection(confirmandsQuery)

  const eventsQuery = useMemoFirebase(() => db ? collection(db, "events") : null, [db])
  const { data: events } = useCollection(eventsQuery)

  const filteredConfirmands = useMemo(() => {
    if (!allConfirmands) return []
    
    return allConfirmands.filter(r => {
      if (r.isArchived) return false
      const matchesSearch = !searchTerm || 
        r.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.ciNumber?.includes(searchTerm)
      
      if (!matchesSearch) return false

      if (profile?.role === "Administrador" || profile?.role === "Tesorero") return true

      if (myGroups && myGroups.length > 0) {
        const myGroupIds = myGroups.map(g => g.id)
        const isInMyGroup = r.groupId && myGroupIds.includes(r.groupId)
        const isUnassigned = !r.groupId || r.groupId === "none"
        return isInMyGroup || isUnassigned
      }
      return true
    }).sort((a, b) => {
      if (!a.groupId && b.groupId) return -1
      if (a.groupId && !b.groupId) return 1
      return 0
    })
  }, [allConfirmands, searchTerm, myGroups, profile])

  const handleOpenPayment = (reg: any) => {
    setSelectedReg(reg)
    const pending = (reg.registrationCost || 0) - (reg.amountPaid || 0)
    setPaymentAmount(pending > 0 ? pending : 0)
    setSelectedEventId("inscripcion")
    setPaymentType("EFECTIVO")
    setPaymentProofUrl(null)
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setPaymentProofUrl(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const onVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node && currentStream) {
      if (node.srcObject !== currentStream) {
        node.srcObject = currentStream;
        node.play().catch(err => console.error("Video play error:", err));
      }
    }
    videoRef.current = node;
  }, [currentStream]);

  const startCamera = async (deviceId?: string) => {
    try {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          facingMode: deviceId ? undefined : "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setCurrentStream(stream)
      setHasCameraPermission(true)
      
      const availableDevices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = availableDevices.filter(d => d.kind === 'videoinput')
      setDevices(videoDevices)
      if (!selectedDeviceId && videoDevices.length > 0) {
        setSelectedDeviceId(deviceId || videoDevices[0].deviceId)
      }
      setShowCamera(true)
    } catch (error) {
      console.error('Error accessing camera:', error)
      setHasCameraPermission(false)
      toast({
        variant: 'destructive',
        title: 'Acceso denegado',
        description: 'Por favor, permite el acceso a la cámara.',
      })
    }
  }

  const stopCamera = () => {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop())
      setCurrentStream(null)
    }
    setShowCamera(false)
  }

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
        setPaymentProofUrl(dataUrl)
        stopCamera()
      }
    }
  }

  const handleProcessPayment = async () => {
    if (!db || !selectedReg || !treasurySettingsRef || isSubmitting) return
    setIsSubmitting(true)
    const regRef = doc(db, "confirmations", selectedReg.id)
    const catechistName = profile ? `${profile.firstName} ${profile.lastName}` : "Catequista"
    try {
      await runTransaction(db, async (transaction) => {
        const treasurySnap = await transaction.get(treasurySettingsRef);
        const regSnap = await transaction.get(regRef);
        if (!regSnap.exists()) throw "Registro no encontrado";
        const regData = regSnap.data();
        const currentNext = treasurySnap.exists() ? (treasurySnap.data()?.nextReceiptNumber || 1) : 1;
        const formattedReceipt = `001-001-${String(currentNext).padStart(7, '0')}`;
        if (selectedEventId === "inscripcion") {
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
            receiptNumber: formattedReceipt,
            lastPaymentMethod: paymentType,
            paymentProofUrl: paymentProofUrl || regData.paymentProofUrl || null
          });
        } else {
          const currentPaid = (regData.eventPayments?.[selectedEventId]?.paid || 0) + paymentAmount;
          transaction.update(regRef, {
            [`eventPayments.${selectedEventId}`]: {
              name: selectedEvent?.category || "Evento",
              paid: currentPaid,
              total: selectedEvent?.cost || 0,
              date: new Date().toISOString(),
              method: paymentType
            },
            validatedBy: catechistName,
            receiptNumber: formattedReceipt,
            paymentProofUrl: paymentProofUrl || regData.paymentProofUrl || null
          });
        }
        if (!treasurySnap.exists()) {
          transaction.set(treasurySettingsRef, { nextReceiptNumber: currentNext + 1 }, { merge: true });
        } else {
          transaction.update(treasurySettingsRef, { nextReceiptNumber: currentNext + 1 });
        }
        const logRef = doc(collection(db, "audit_logs"));
        transaction.set(logRef, {
          userId: user?.uid || "unknown",
          userName: catechistName,
          action: `Cobro (${paymentType})`,
          module: "pagos",
          details: `Cobro de ${paymentAmount.toLocaleString('es-PY')} Gs. por ${selectedEventId === 'inscripcion' ? 'Inscripción' : selectedEvent?.category} a ${regData.fullName}. Recibo: ${formattedReceipt}`,
          timestamp: serverTimestamp()
        });
        const updatedReg = { ...regData, id: regSnap.id, receiptNumber: formattedReceipt, amountPaid: (regData.amountPaid || 0) + paymentAmount, validatedBy: catechistName };
        setSelectedReg(updatedReg);
      });
      toast({ title: "Pago registrado con éxito" })
      setIsPaymentDialogOpen(false)
      setIsReceiptOpen(true)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al procesar", description: error.message || "No se pudo completar la operación." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDownloadPDF = async () => {
    const element = document.getElementById("receipt-content-official");
    if (!element) return;
    setIsGeneratingPDF(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: 750,
        windowWidth: 750,
        onclone: (doc) => {
          const el = doc.getElementById("receipt-content-official");
          if (el) {
            el.style.transform = "none";
            el.style.width = "750px";
            el.style.maxWidth = "750px";
            el.style.margin = "0 auto";
            el.style.padding = "20px";
          }
        }
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Recibo-Santuario-NSPS-${selectedReg?.fullName?.replace(/\s+/g, '-')}.pdf`);
      toast({ title: "PDF Descargado" });
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
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: 750,
        windowWidth: 750,
        onclone: (doc) => {
          const el = doc.getElementById("receipt-content-official");
          if (el) {
            el.style.transform = "none";
            el.style.width = "750px";
            el.style.maxWidth = "750px";
            el.style.margin = "0 auto";
            el.style.padding = "20px";
          }
        }
      });
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `Recibo-NSPS-${selectedReg?.fullName?.replace(/\s+/g, '-')}.png`;
      link.href = url;
      link.click();
      toast({ title: "Imagen guardada" });
    } catch (err) {
      toast({ variant: "destructive", title: "Error al generar imagen" });
    } finally {
      setIsGeneratingPDF(false);
    }
  }

  const handleShareWhatsApp = () => {
    if (!selectedReg) return;
    const amount = paymentAmount || 0;
    const receiptNum = selectedReg.receiptNumber || "PENDIENTE";
    const message = encodeURIComponent(`⛪ *SANTUARIO NACIONAL NSPS*\n\n¡Hola *${selectedReg.fullName}*! Hemos registrado tu pago por inscripción.\n\n*Recibo N°:* ${receiptNum}\n*Monto:* ${amount.toLocaleString('es-PY')} Gs.\n\n_Tesorería de Catequesis_`);
    window.open(`https://wa.me/${selectedReg.phone?.replace(/[^0-9]/g, '')}?text=${message}`, '_blank');
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
          {loadingRegs ? (
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
                    <TableCell colSpan={5} className="py-20 text-center text-slate-400 italic">No se encontraron inscripciones para mostrar.</TableCell>
                  </TableRow>
                ) : (
                  filteredConfirmands.map((reg) => {
                    const pending = (reg.registrationCost || 0) - (reg.amountPaid || 0)
                    const isSettled = pending <= 0 && reg.paymentStatus === "PAGADO"
                    const noGroup = !reg.groupId || reg.groupId === "none"
                    return (
                      <TableRow key={reg.id} className={cn("hover:bg-slate-50/30 h-20 transition-colors", noGroup && "bg-blue-50/20")}>
                        <TableCell className="pl-8"><div className="flex items-center gap-4"><Avatar className="h-10 w-10 border shadow-sm"><AvatarImage src={reg.photoUrl} className="object-cover"/><AvatarFallback><User className="h-5 w-5" /></AvatarFallback></Avatar><div className="flex flex-col"><div className="flex items-center gap-2"><span className="font-bold text-sm text-slate-900 uppercase tracking-tight leading-none">{reg.fullName}</span>{noGroup && <Badge variant="outline" className="text-[7px] h-4 bg-blue-50 text-blue-600 border-blue-100 font-black">NUEVO</Badge>}</div><span className="text-[10px] text-slate-500 font-bold">{reg.ciNumber}</span></div></div></TableCell>
                        <TableCell className="text-center"><Badge variant="secondary" className="text-[9px] uppercase font-black px-3 h-6 bg-slate-100 text-slate-600 border-none">{reg.catechesisYear?.replace("_", " ")}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className={cn("text-[9px] uppercase font-black px-3 h-6 border-slate-200", isSettled ? "bg-green-50 text-green-600 border-green-100" : "bg-white text-slate-400")}>{reg.paymentStatus || "PENDIENTE"}</Badge></TableCell>
                        <TableCell className="text-center"><div className="flex flex-col items-center"><span className={cn("font-black text-sm", pending > 0 ? "text-red-500" : "text-green-600")}>{pending > 0 ? pending.toLocaleString('es-PY') : "0"}</span><span className={cn("text-[10px] font-bold", pending > 0 ? "text-red-500" : "text-green-600")}>Gs.</span></div></TableCell>
                        <TableCell className="text-right pr-8"><div className="flex justify-end items-center gap-3"><Button size="sm" variant="outline" className="h-10 px-5 rounded-xl font-bold gap-2 border-primary text-primary hover:bg-primary hover:text-white transition-all shadow-sm" onClick={() => handleOpenPayment(reg)} disabled={isSettled}><CheckCircle2 className="h-4 w-4" /> Confirmar Pago</Button>{isSettled && (<Button size="icon" variant="ghost" className="h-10 w-10 text-slate-300 hover:text-primary rounded-xl" onClick={() => { setSelectedReg(reg); setPaymentAmount(reg.amountPaid || 0); setIsReceiptOpen(true); }}><FileText className="h-5 w-5" /></Button>)}</div></TableCell>
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
          <DialogHeader className="p-6 bg-primary text-white shrink-0"><DialogTitle className="font-headline text-xl">Confirmar Cobro</DialogTitle><DialogDescription className="text-white/80">Recibiendo pago de {selectedReg?.fullName}</DialogDescription></DialogHeader>
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="space-y-3"><Label className="font-bold text-slate-700 text-xs uppercase tracking-widest">Concepto del Pago</Label><Select value={selectedEventId} onValueChange={setSelectedEventId}><SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inscripcion">Inscripción Catequesis 2026</SelectItem>{events?.map((ev) => <SelectItem key={ev.id} value={ev.id}>{ev.category} ({ev.cost.toLocaleString('es-PY')} Gs.)</SelectItem>)}</SelectContent></Select></div>
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Saldo Pendiente:</p><p className="text-xl font-black text-slate-900">{pendingBalance.toLocaleString('es-PY')} Gs.</p></div>
            <div className="space-y-4"><Label className="font-bold text-slate-700 text-xs uppercase tracking-widest">Método de Pago</Label><RadioGroup value={paymentType} onValueChange={(v: any) => setPaymentType(v)} className="grid grid-cols-2 gap-4"><div className={cn("flex flex-col items-center justify-center p-4 border-2 rounded-2xl cursor-pointer transition-all gap-2", paymentType === "EFECTIVO" ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-200")} onClick={() => setPaymentType("EFECTIVO")}><RadioGroupItem value="EFECTIVO" id="type-cash" className="sr-only" /><Banknote className={cn("h-6 w-6", paymentType === "EFECTIVO" ? "text-primary" : "text-slate-400")} /><span className={cn("text-[10px] font-black uppercase", paymentType === "EFECTIVO" ? "text-primary" : "text-slate-500")}>Efectivo</span></div><div className={cn("flex flex-col items-center justify-center p-4 border-2 rounded-2xl cursor-pointer transition-all gap-2", paymentType === "TRANSFERENCIA" ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-200")} onClick={() => setPaymentType("TRANSFERENCIA")}><RadioGroupItem value="TRANSFERENCIA" id="type-bank" className="sr-only" /><ArrowRightLeft className={cn("h-6 w-6", paymentType === "TRANSFERENCIA" ? "text-primary" : "text-slate-400")} /><span className={cn("text-[10px] font-black uppercase", paymentType === "TRANSFERENCIA" ? "text-primary" : "text-slate-500")}>Transferencia</span></div></RadioGroup></div>
            <div className="space-y-3"><Label className="font-bold text-slate-700 text-xs uppercase tracking-widest">Monto a Registrar (Gs)</Label><Input type="number" className="h-14 text-2xl font-black rounded-2xl bg-white border-primary/20 text-primary shadow-inner" value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} /></div>
            <div className="space-y-3"><Label className="font-bold text-slate-700 text-xs uppercase tracking-widest">Adjuntar Comprobante (Foto)</Label><div className={cn("border-2 border-dashed rounded-2xl h-32 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all", paymentProofUrl ? "border-green-500 bg-green-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100")}>{paymentProofUrl ? (<div className="w-full h-full relative group"><img src={paymentProofUrl} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"><Button type="button" size="sm" variant="secondary" className="rounded-xl h-9 gap-2 font-bold" onClick={() => startCamera()}><Camera className="h-4 w-4" /> Recapturar</Button><Button type="button" size="sm" variant="destructive" className="rounded-xl h-9 w-9 p-0" onClick={() => setPaymentProofUrl(null)}><X className="h-4 w-4" /></Button></div></div>) : (<div className="flex flex-col items-center p-4 w-full h-full" onClick={() => startCamera()}><ImageIcon className="h-8 w-8 text-slate-300 mb-1" /><span className="text-[10px] font-bold text-slate-400 uppercase">Capturar o Subir Comprobante</span><div className="flex gap-2 mt-2"><Button type="button" size="sm" variant="outline" className="h-7 text-[8px] rounded-lg px-2" onClick={(e) => { e.stopPropagation(); startCamera(); }}>CÁMARA</Button><Button type="button" size="sm" variant="outline" className="h-7 text-[8px] rounded-lg px-2" onClick={(e) => { e.stopPropagation(); proofInputRef.current?.click(); }}>ARCHIVO</Button></div></div>)}</div><input type="file" ref={proofInputRef} className="hidden" accept="image/*" onChange={handleFileChange} /></div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3"><Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button><Button className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 font-bold shadow-lg gap-2" onClick={handleProcessPayment} disabled={paymentAmount <= 0 || isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <><CheckCircle2 className="h-4 w-4" /> Confirmar</>}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden border-none shadow-2xl bg-white rounded-xl">
          <DialogHeader className="sr-only"><DialogTitle>Recibo de Pago Oficial</DialogTitle></DialogHeader>
          <div className="p-4 bg-white flex justify-center overflow-y-auto max-h-[80vh]">
            <div className="w-full max-w-[700px] bg-white text-slate-900 font-serif border-2 border-slate-900 p-6 md:p-8 space-y-6" id="receipt-content-official">
              <div className="grid grid-cols-3 gap-4 items-center mb-2">
                <div className="col-span-2 border-2 border-slate-900 p-2 min-h-[100px] flex items-center justify-center relative bg-white">
                  <img src="/logo.png" alt="Logo Santuario" className="max-h-20 object-contain" />
                  <div className="absolute top-1 right-2 text-[6px] font-black uppercase tracking-tighter text-slate-400 text-right leading-tight">Santuario Nacional<br/>Nuestra Señora del Perpetuo Socorro</div>
                </div>
                <div className="flex flex-col gap-2 h-full justify-between">
                  <div className="border-2 border-slate-900 p-2 text-center bg-slate-50">
                    <p className="text-[8px] font-black uppercase tracking-tighter">Gs.</p>
                    <p className="text-lg font-black">{paymentAmount.toLocaleString('es-PY')}</p>
                  </div>
                  <div className="border-2 border-slate-900 p-1 text-center bg-white">
                    <p className="text-[7px] font-bold uppercase">Recibo N°</p>
                    <p className="text-[10px] font-black">{selectedReg?.receiptNumber || "PENDIENTE"}</p>
                  </div>
                </div>
              </div>
              <div className="text-center border-b-2 border-slate-900 pb-1 mb-2">
                <h1 className="text-2xl font-black italic tracking-tighter uppercase">RECIBO</h1>
              </div>
              <div className="space-y-6 text-sm">
                <div className="flex items-baseline gap-2 py-0.5">
                  <span className="whitespace-nowrap font-bold shrink-0 tracking-wide text-xs">Recibí(mos) de:</span>
                  <div className="flex-1 border-b border-dotted border-slate-400 font-bold uppercase pb-0.5 px-2 leading-relaxed truncate text-xs">{selectedReg?.fullName}</div>
                </div>
                <div className="flex items-baseline gap-2 py-0.5">
                  <span className="whitespace-nowrap font-bold shrink-0 tracking-wide text-xs">la cantidad de:</span>
                  <div className="flex-1 border-b border-dotted border-slate-400 pb-0.5 px-2 italic leading-relaxed text-xs">{paymentAmount.toLocaleString('es-PY')} Guaraníes</div>
                </div>
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 py-0.5">
                    <span className="font-bold tracking-wide text-xs">en concepto de:</span>
                    <div className="w-full border-2 border-slate-900 px-4 py-3 font-bold text-[11px] bg-slate-50 uppercase leading-relaxed text-center">
                      {selectedEventId === 'inscripcion' ? 'Inscripción Catequesis de Confirmación' : (selectedEvent?.category || 'Evento Parroquial')} - {selectedReg?.catechesisYear?.replace('_', ' ')}
                    </div>
                  </div>
                </div>
                <div className="flex items-baseline gap-2 py-0.5">
                  <span className="whitespace-nowrap font-bold shrink-0 tracking-wide text-xs">Observación:</span>
                  <div className="flex-1 border-b border-dotted border-slate-400 pb-0.5 px-2 text-[10px] text-slate-700 font-medium italic leading-relaxed">Saldo Pendiente: {((selectedReg?.registrationCost || 0) - (selectedReg?.amountPaid || 0)).toLocaleString('es-PY')} Gs.</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
                <div className="flex flex-col justify-end space-y-2">
                  <p className="text-xs italic font-medium">Asunción, {localDate.day} de {localDate.month} de {localDate.year}</p>
                  <div className="flex flex-col items-start pt-2">
                    <div className="w-40 border-t border-slate-900"></div>
                    <p className="text-[7px] font-bold uppercase mt-0.5 tracking-widest">(Firma y aclaración)</p>
                  </div>
                </div>
                <div className="flex flex-col items-center md:items-end gap-3">
                  <div className="p-1 border border-slate-900 rounded-lg bg-white shadow-sm">
                    <QRCodeCanvas value={`RECIBO-NSPS-${selectedReg?.id}-${paymentAmount}-${selectedReg?.receiptNumber}`} size={70} level="H" />
                  </div>
                  <div className="text-right">
                    <p className="text-[7px] font-black uppercase text-primary tracking-widest leading-none">Firma Digitalizada</p>
                    <p className="text-[10px] font-bold text-slate-900 uppercase mt-0.5">{selectedReg?.validatedBy || 'Secretaría del Santuario'}</p>
                    <p className="text-[7px] text-slate-500 font-bold uppercase">{profile?.role || 'Personal Institucional'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-100 border-t flex flex-row gap-2">
            <Button variant="outline" className="flex-1 rounded-xl h-12 font-bold" onClick={() => setIsReceiptOpen(false)}>Cerrar</Button>
            <Button className="flex-1 gap-2 rounded-xl bg-blue-600 text-white h-12 font-bold shadow-lg" onClick={handleDownloadImage} disabled={isGeneratingPDF}><ImageIcon className="h-4 w-4" /> IMAGEN</Button>
            <Button className="flex-1 gap-2 rounded-xl bg-green-600 text-white h-12 font-bold shadow-lg" onClick={handleShareWhatsApp}><MessageCircle className="h-4 w-4" /> WHATSAPP</Button>
            <Button className="flex-1 gap-2 rounded-xl bg-slate-900 text-white h-12 font-bold shadow-lg" onClick={handleDownloadPDF} disabled={isGeneratingPDF}>{isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCamera} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-primary text-white"><DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Capturar Comprobante</DialogTitle></DialogHeader>
          <div className="relative bg-black aspect-[3/4] max-h-[60vh] mx-auto flex items-center justify-center overflow-hidden"><video ref={onVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" /><canvas ref={canvasRef} className="hidden" />{hasCameraPermission === false && (<div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-white bg-slate-900/90 gap-4"><X className="h-12 w-12 text-red-500" /><p className="font-bold">Acceso a cámara requerido</p><p className="text-xs text-slate-400">Habilita los permisos en tu navegador para usar esta función.</p></div>)}</div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-col gap-4">{devices.length > 1 && (<div className="flex items-center gap-2 w-full"><FlipHorizontal className="h-4 w-4 text-slate-400" /><Select value={selectedDeviceId} onValueChange={(val) => { setSelectedDeviceId(val); startCamera(val); }}><SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue placeholder="Cambiar Cámara" /></SelectTrigger><SelectContent>{devices.map((device) => (<SelectItem key={device.deviceId} value={device.deviceId}>{device.label || `Cámara ${device.deviceId.slice(0, 5)}`}</SelectItem>))}</SelectContent></Select></div>)}<div className="flex gap-3 w-full"><Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={stopCamera}>Cancelar</Button><Button className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 font-bold gap-2" onClick={takePhoto}><Camera className="h-5 w-5" /> Capturar</Button></div></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
