
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
  FlipHorizontal,
  Share2,
  Globe,
  Filter,
  FilterX,
  ZoomIn,
  ZoomOut,
  Maximize2
} from "lucide-react"
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc, updateDoc, serverTimestamp, addDoc, runTransaction, orderBy, limit } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { QRCodeCanvas } from "qrcode.react"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function PaymentsManagementPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  const [filterSex, setFilterSex] = useState<string>("all")
  const [filterOrigin, setFilterOrigin] = useState<string>("all")
  const [filterYear, setFilterYear] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("all")

  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [selectedEventId, setSelectedEventId] = useState<string>("inscripcion")
  const [paymentType, setPaymentType] = useState<"EFECTIVO" | "TRANSFERENCIA">("EFECTIVO")
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null)
  const [isProofViewOpen, setIsProofViewOpen] = useState(false)
  const [zoomScale, setZoomScale] = useState(1)
  const [localDate, setLocalDate] = useState({ day: "", month: "", year: "" })

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
    // LÍMITE DE SEGURIDAD PARA REDUCIR LECTURAS
    return query(collection(db, "confirmations"), orderBy("createdAt", "desc"), limit(100))
  }, [db])

  const { data: allConfirmands, loading: loadingRegs } = useCollection(confirmandsQuery)

  const eventsQuery = useMemoFirebase(() => db ? collection(db, "events") : null, [db])
  const { data: events } = useCollection(eventsQuery)

  const resetFilters = () => {
    setSearchTerm("");
    setFilterSex("all");
    setFilterOrigin("all");
    setFilterYear("all");
    setFilterStatus("all");
    setFilterPaymentMethod("all");
  }

  const filteredConfirmands = useMemo(() => {
    if (!allConfirmands) return []
    
    return allConfirmands.filter(r => {
      if (r.isArchived) return false
      const matchesSearch = !searchTerm || 
        r.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.ciNumber?.includes(searchTerm)
      
      if (!matchesSearch) return false
      const matchesSex = filterSex === "all" || r.sexo === filterSex
      const matchesOrigin = filterOrigin === "all" || (filterOrigin === "PUBLIC" ? r.userId === "public_registration" : r.userId !== "public_registration")
      const matchesYear = filterYear === "all" || r.catechesisYear === filterYear
      const matchesStatus = filterStatus === "all" || r.status === filterStatus
      const matchesPayment = filterPaymentMethod === "all" || r.lastPaymentMethod === filterPaymentMethod

      if (!matchesSex || !matchesOrigin || !matchesYear || !matchesStatus || !matchesPayment) return false

      if (profile?.role === "Administrador" || profile?.role === "Tesorero") return true

      if (myGroups && myGroups.length > 0) {
        const myGroupIds = myGroups.map(g => g.id)
        const isInMyGroup = r.groupId && myGroupIds.includes(r.groupId)
        const isUnassigned = !r.groupId || r.groupId === "none"
        return isInMyGroup || isUnassigned
      }
      return true
    })
  }, [allConfirmands, searchTerm, myGroups, profile, filterSex, filterOrigin, filterYear, filterStatus, filterPaymentMethod])

  const handleOpenPayment = (reg: any) => {
    setSelectedReg(reg)
    const pending = (reg.registrationCost || 0) - (reg.amountPaid || 0)
    setPaymentAmount(pending > 0 ? pending : 0)
    setSelectedEventId("inscripcion")
    setPaymentType("EFECTIVO")
    setPaymentProofUrl(null)
    setIsPaymentDialogOpen(true)
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
          const newPaid = (regData.amountPaid || 0) + paymentAmount;
          const regCost = regData.registrationCost || (regData.catechesisYear === "ADULTOS" ? 50000 : 35000);
          transaction.update(regRef, { 
            amountPaid: newPaid, 
            paymentStatus: newPaid >= regCost ? "PAGADO" : "PARCIAL", 
            status: "INSCRITO",
            lastPaymentDate: serverTimestamp(),
            validatedBy: catechistName,
            receiptNumber: formattedReceipt,
            lastPaymentMethod: paymentType,
            paymentProofUrl: paymentProofUrl || regData.paymentProofUrl || null
          });
        }
        
        transaction.update(treasurySettingsRef, { nextReceiptNumber: currentNext + 1 });
        const logRef = doc(collection(db, "audit_logs"));
        transaction.set(logRef, {
          userId: user?.uid || "unknown",
          userName: catechistName,
          action: `Cobro (${paymentType})`,
          module: "pagos",
          details: `Cobro de ${paymentAmount.toLocaleString('es-PY')} Gs. a ${regData.fullName}. Recibo: ${formattedReceipt}`,
          timestamp: serverTimestamp()
        });
        setSelectedReg({ ...regData, id: regSnap.id, receiptNumber: formattedReceipt });
      });
      toast({ title: "Pago registrado" })
      setIsPaymentDialogOpen(false)
      setIsReceiptOpen(true)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const onVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node && currentStream) {
      if (node.srcObject !== currentStream) {
        node.srcObject = currentStream;
        node.play().catch(err => {
          if (err.name !== 'AbortError') console.error("Video play error:", err);
        });
      }
    }
    videoRef.current = node;
  }, [currentStream]);

  const startCamera = async (deviceId?: string) => {
    try {
      if (currentStream) currentStream.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1920 }, height: { ideal: 1080 } }
      })
      setCurrentStream(stream);
      setHasCameraPermission(true);
      const devices = await navigator.mediaDevices.enumerateDevices();
      setDevices(devices.filter(d => d.kind === 'videoinput'));
      setShowCamera(true);
    } catch (e) {
      setHasCameraPermission(false);
      toast({ variant: 'destructive', title: 'Error cámara' });
    }
  }

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      setPaymentProofUrl(canvas.toDataURL('image/jpeg', 0.8));
      setShowCamera(false);
      if (currentStream) currentStream.getTracks().forEach(t => t.stop());
    }
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Control de Cobros</h1>
      </div>

      <div className="space-y-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nombre o C.I..." className="pl-9 h-12 rounded-2xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button variant="ghost" className="h-12 rounded-2xl gap-2 font-bold" onClick={resetFilters}><FilterX className="h-4 w-4" /> Limpiar</Button>
          </div>
        </div>

        <Card className="border-none shadow-xl overflow-hidden bg-white">
          <CardContent className="p-0">
            {loadingRegs ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="font-bold pl-8">Confirmando</TableHead>
                    <TableHead className="text-center">Nivel</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-center">Saldo</TableHead>
                    <TableHead className="text-right pr-8 font-bold">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConfirmands.map((reg) => {
                    const pending = (reg.registrationCost || 35000) - (reg.amountPaid || 0)
                    return (
                      <TableRow key={reg.id} className="h-20">
                        <TableCell className="pl-8">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-10 w-10 border"><AvatarImage src={reg.photoUrl} className="object-cover" /><AvatarFallback><User /></AvatarFallback></Avatar>
                            <div className="flex flex-col"><span className="font-bold text-sm text-slate-900 uppercase">{reg.fullName}</span><span className="text-[10px] text-slate-500 font-bold">{reg.ciNumber}</span></div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center"><Badge variant="secondary" className="text-[9px] uppercase">{reg.catechesisYear?.replace("_", " ")}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className={cn(pending <= 0 ? "bg-green-50 text-green-600" : "")}>{reg.paymentStatus || "PENDIENTE"}</Badge></TableCell>
                        <TableCell className="text-center font-black text-sm">{pending > 0 ? pending.toLocaleString('es-PY') : "0"} Gs.</TableCell>
                        <TableCell className="text-right pr-8">
                          <Button size="sm" variant="outline" className="h-10 rounded-xl font-bold border-primary text-primary" onClick={() => handleOpenPayment(reg)} disabled={pending <= 0}>Confirmar Pago</Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-primary text-white">
            <DialogTitle>Confirmar Cobro</DialogTitle>
            <DialogDescription className="text-white/70">Ingresa el monto recibido para {selectedReg?.fullName}.</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="space-y-3"><Label className="font-bold">Monto a Recibir</Label><Input type="number" className="h-14 text-2xl font-black rounded-2xl" value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} /></div>
            <div className="space-y-3"><Label className="font-bold">Comprobante</Label><div className="border-2 border-dashed rounded-2xl h-32 flex flex-col items-center justify-center bg-slate-50 cursor-pointer" onClick={() => startCamera()}>{paymentProofUrl ? <img src={paymentProofUrl} className="h-full w-full object-cover rounded-xl" /> : <ImageIcon className="h-8 w-8 text-slate-300" />}</div></div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button><Button className="flex-1 bg-green-600 font-bold" onClick={handleProcessPayment} disabled={isSubmitting}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCamera} onOpenChange={(open) => !open && setShowCamera(false)}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-3xl">
          <DialogHeader className="p-6 bg-primary text-white">
            <DialogTitle>Capturar Foto del Comprobante</DialogTitle>
            <DialogDescription className="text-white/70">Asegúrate de que los datos del pago sean legibles.</DialogDescription>
          </DialogHeader>
          <div className="relative bg-black aspect-[3/4]"><video ref={onVideoRef} autoPlay playsInline className="w-full h-full object-cover" /><canvas ref={canvasRef} className="hidden" /></div>
          <DialogFooter className="p-6 bg-slate-50 border-t"><Button className="w-full h-12 rounded-xl font-bold bg-primary" onClick={takePhoto}>Capturar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProofViewOpen} onOpenChange={(open) => { setIsProofViewOpen(open); if(!open) setZoomScale(1); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl p-0 bg-transparent border-none shadow-none flex items-center justify-center overflow-visible">
          <DialogHeader className="sr-only">
            <DialogTitle>Vista de Documento</DialogTitle>
            <DialogDescription>Previsualización ampliada del documento seleccionado.</DialogDescription>
          </DialogHeader>
          <div className="relative flex flex-col items-center w-full">
            <Button variant="secondary" size="icon" className="absolute -top-14 right-0 rounded-full text-white bg-white/20 hover:bg-white/40 border border-white/10 z-50" onClick={() => setIsProofViewOpen(false)}>
              <X className="h-6 w-6" />
            </Button>
            <div className="absolute -bottom-16 flex items-center gap-3 bg-slate-900/90 backdrop-blur-xl p-2 px-4 rounded-2xl border border-white/10 shadow-2xl z-50">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/10" onClick={() => setZoomScale(prev => Math.max(0.25, prev - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
              <span className="text-[10px] font-black text-white uppercase w-14 text-center">{Math.round(zoomScale * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/10" onClick={() => setZoomScale(prev => Math.min(4, prev + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
              <Separator orientation="vertical" className="h-4 bg-white/20 mx-1" />
              <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/10" onClick={() => setZoomScale(1)}><Maximize2 className="h-4 w-4" /></Button>
            </div>
            <div className="w-full bg-slate-950/20 backdrop-blur-sm rounded-3xl p-2 border border-white/10 shadow-2xl overflow-hidden">
              <ScrollArea className="max-h-[75vh] w-full rounded-2xl">
                <div className="flex items-center justify-center p-4 md:p-10 min-h-[400px]">
                  <img src={viewProofUrl || ""} className="rounded-xl shadow-2xl transition-all duration-300 select-none h-auto" style={{ width: zoomScale === 1 ? 'auto' : `${zoomScale * 100}%`, maxWidth: zoomScale === 1 ? '100%' : 'none', maxHeight: zoomScale === 1 ? '75vh' : 'none', objectFit: 'contain' }} alt="Documento" />
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
