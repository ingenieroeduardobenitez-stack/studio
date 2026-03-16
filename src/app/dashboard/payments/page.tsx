
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
  Maximize2,
  Receipt,
  AlertTriangle,
  Users,
  Clock
} from "lucide-react"
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc, updateDoc, serverTimestamp, addDoc, runTransaction, orderBy, limit } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { QRCodeCanvas } from "qrcode.react"
import Image from "next/image"

export default function PaymentsManagementPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  const [filterSex, setFilterSex] = useState<string>("all")
  const [filterYear, setFilterYear] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterMethod, setFilterMethod] = useState<string>("all")

  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [selectedEventId, setSelectedEventId] = useState<string>("inscripcion")
  const [paymentType, setPaymentType] = useState<"EFECTIVO" | "TRANSFERENCIA">("EFECTIVO")
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null)
  const [viewProofUrl, setViewProofUrl] = useState<string | null>(null)
  const [isProofViewOpen, setIsProofViewOpen] = useState(false)
  const [zoomScale, setZoomScale] = useState(1)

  const [showCamera, setShowCamera] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null)
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

  const { data: myGroups } = useCollection(myGroupsQuery)

  const confirmandsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "confirmations"), orderBy("createdAt", "desc"), limit(200))
  }, [db])

  const { data: allConfirmands, loading: loadingRegs } = useCollection(confirmandsQuery)

  const usersQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "users")
  }, [db])

  const { data: allUsers } = useCollection(usersQuery)

  const findUserById = (uid: string) => {
    return allUsers?.find(u => u.id === uid)
  }

  const resetFilters = () => {
    setSearchTerm("");
    setFilterSex("all");
    setFilterYear("all");
    setFilterStatus("all");
    setFilterMethod("all");
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
      const matchesYear = filterYear === "all" || r.catechesisYear === filterYear
      
      // Lógica de filtro de estado incluyendo el "Ajuste Pendiente"
      const isEfectivoZero = r.paymentMethod === "EFECTIVO" && (r.amountPaid || 0) === 0;
      const matchesStatus = filterStatus === "all" || 
        (filterStatus === "AJUSTE" ? isEfectivoZero : r.paymentStatus === filterStatus);
      
      const currentMethod = r.lastPaymentMethod || r.paymentMethod || "SIN_PAGO";
      const matchesMethod = filterMethod === "all" || currentMethod === filterMethod;

      if (!matchesSex || !matchesYear || !matchesStatus || !matchesMethod) return false

      if (profile?.role === "Administrador" || profile?.role === "Tesorero") return true

      if (myGroups && myGroups.length > 0) {
        const myGroupIds = myGroups.map(g => g.id)
        const isInMyGroup = r.groupId && myGroupIds.includes(r.groupId)
        const isUnassigned = !r.groupId || r.groupId === "none"
        return isInMyGroup || isUnassigned
      }
      return true
    })
  }, [allConfirmands, searchTerm, myGroups, profile, filterSex, filterYear, filterStatus, filterMethod])

  const handleOpenPayment = (reg: any) => {
    setSelectedReg(reg)
    const pending = (reg.registrationCost || (reg.catechesisYear === "ADULTOS" ? 50000 : 35000)) - (reg.amountPaid || 0)
    setPaymentAmount(pending > 0 ? pending : 0)
    setSelectedEventId("inscripcion")
    setPaymentType(reg.paymentMethod === "TRANSFERENCIA" ? "TRANSFERENCIA" : "EFECTIVO")
    setPaymentProofUrl(null)
    setIsPaymentDialogOpen(true)
  }

  const handleViewReceipt = (reg: any) => {
    setSelectedReg(reg)
    setIsReceiptOpen(true)
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
          lastPaymentDate: serverTimestamp(),
          validatedBy: catechistName,
          receiptNumber: formattedReceipt,
          lastPaymentMethod: paymentType,
          paymentProofUrl: paymentProofUrl || regData.paymentProofUrl || null
        };

        transaction.update(regRef, updatePayload);
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

        setSelectedReg({ ...regData, ...updatePayload, id: regSnap.id });
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

  const formatReceiptDate = (ts: any) => {
    if (!ts) return "---";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const day = date.getDate();
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} de ${month} de ${year}`;
  };

  const shareViaWhatsApp = () => {
    if (!selectedReg) return;
    const msg = `*RECIBO DE PAGO - SANTUARIO NSPS*\n\n` +
                `*Nro:* ${selectedReg.receiptNumber}\n` +
                `*Confirmando:* ${selectedReg.fullName}\n` +
                `*Monto:* ${selectedReg.amountPaid.toLocaleString('es-PY')} Gs.\n` +
                `*Concepto:* INSCRIPCIÓN CATEQUESIS ${selectedReg.catechesisYear.replace('_', ' ')}\n\n` +
                `Este es un comprobante digital oficial.`;
    
    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Control de Cobros</h1>
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-xl border border-primary/10">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-primary">{filteredConfirmands.length} Registros</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1 space-y-1.5">
              <Label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Buscador</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Nombre o C.I..." 
                  className="pl-9 h-12 rounded-2xl bg-slate-50 border-none shadow-inner" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Método</Label>
              <Select value={filterMethod} onValueChange={setFilterMethod}>
                <SelectTrigger className="w-[160px] h-12 rounded-2xl bg-white"><SelectValue placeholder="Método" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Métodos</SelectItem>
                  <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  <SelectItem value="SIN_PAGO">Pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Estado</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px] h-12 rounded-2xl bg-white"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Pagos</SelectItem>
                  <SelectItem value="PAGADO">Pagado</SelectItem>
                  <SelectItem value="PARCIAL">Parcial</SelectItem>
                  <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                  <SelectItem value="AJUSTE">Ajuste Pendiente (Efectivo 0)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Nivel</Label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-[140px] h-12 rounded-2xl bg-white"><SelectValue placeholder="Nivel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Niveles</SelectItem>
                  <SelectItem value="PRIMER_AÑO">1° Año</SelectItem>
                  <SelectItem value="SEGUNDO_AÑO">2° Año</SelectItem>
                  <SelectItem value="ADULTOS">Adultos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="ghost" className="h-12 w-12 rounded-2xl p-0 hover:bg-slate-100" onClick={resetFilters} title="Limpiar Filtros">
              <FilterX className="h-5 w-5 text-slate-400" />
            </Button>
          </div>
        </div>

        <Card className="border-none shadow-xl overflow-hidden bg-white">
          <CardContent className="p-0">
            {loadingRegs ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredConfirmands.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground italic">No se encontraron registros con estos filtros.</div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="pl-8 font-bold">Confirmando</TableHead>
                    <TableHead className="font-bold">Origen</TableHead>
                    <TableHead className="text-center font-bold">Método</TableHead>
                    <TableHead className="text-center font-bold">Estado Pago</TableHead>
                    <TableHead className="text-right font-bold">Saldo</TableHead>
                    <TableHead className="text-right pr-8 font-bold">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConfirmands.map((reg) => {
                    const currentCost = reg.registrationCost || (reg.catechesisYear === "ADULTOS" ? 50000 : 35000)
                    const pending = currentCost - (reg.amountPaid || 0)
                    const isPaid = reg.paymentStatus === "PAGADO"
                    const declaredMethod = reg.paymentMethod || "SIN_PAGO";
                    const isEfectivoZero = declaredMethod === "EFECTIVO" && (reg.amountPaid || 0) === 0;
                    const isManual = reg.userId !== "public_registration";
                    const creator = findUserById(reg.userId);

                    return (
                      <TableRow key={reg.id} className="h-20 hover:bg-slate-50/30 transition-colors">
                        <TableCell className="pl-8">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-10 w-10 border shadow-sm"><AvatarImage src={reg.photoUrl} className="object-cover" /><AvatarFallback><User /></AvatarFallback></Avatar>
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-slate-900 uppercase truncate max-w-[180px]">{reg.fullName}</span>
                              <span className="text-[10px] text-slate-500 font-bold uppercase">{reg.catechesisYear?.replace("_", " ")}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <Badge variant="secondary" className={cn("text-[9px] uppercase font-black w-fit", isManual ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700")}>
                              {isManual ? "MANUAL" : "PÚBLICO"}
                            </Badge>
                            {isManual && creator && (
                              <span className="text-[9px] text-slate-400 font-bold uppercase mt-1 ml-1 truncate max-w-[100px]">
                                {creator.firstName}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-[9px] uppercase gap-1.5">
                            {declaredMethod === "EFECTIVO" ? <Banknote className="h-3 w-3" /> : declaredMethod === "TRANSFERENCIA" ? <ArrowRightLeft className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {declaredMethod}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant="outline" className={cn(isPaid ? "bg-green-50 text-green-600 border-green-200" : "bg-amber-50 text-amber-600 border-amber-200")}>
                              {reg.paymentStatus || "PENDIENTE"}
                            </Badge>
                            {isEfectivoZero && (
                              <span className="text-[8px] font-black text-orange-600 uppercase flex items-center gap-1 animate-pulse">
                                <AlertTriangle className="h-2 w-2" /> AJUSTE PENDIENTE
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-black text-sm text-slate-900">
                          {pending > 0 ? pending.toLocaleString('es-PY') : "0"} Gs.
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          <div className="flex justify-end gap-2">
                            {reg.receiptNumber ? (
                              <Button size="icon" variant="outline" className="h-10 w-10 rounded-xl border-amber-200 text-amber-600 hover:bg-amber-50 shadow-sm" onClick={() => handleViewReceipt(reg)} title="Ver Recibo">
                                <Receipt className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className={cn(
                                  "h-10 rounded-xl font-bold px-4 gap-2 transition-all active:scale-95",
                                  isEfectivoZero ? "border-orange-500 bg-orange-50 text-orange-700 hover:bg-orange-100" : "border-primary text-primary hover:bg-primary/5"
                                )} 
                                onClick={() => handleOpenPayment(reg)}
                                disabled={isPaid && !!reg.receiptNumber}
                              >
                                {isEfectivoZero ? (
                                  <><CheckCircle2 className="h-4 w-4" /> Validar Efectivo</>
                                ) : (
                                  <><Banknote className="h-4 w-4" /> Confirmar Pago</>
                                )}
                              </Button>
                            )}
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
      </div>

      {/* DIÁLOGO DE PROCESAR PAGO */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-[2rem]">
          <DialogHeader className="p-8 bg-primary text-white shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 rounded-xl">
                <Banknote className="h-6 w-6" />
              </div>
              <DialogTitle className="text-2xl font-headline">Confirmar Cobro</DialogTitle>
            </div>
            <DialogDescription className="text-white/70">Confirmando: {selectedReg?.fullName}</DialogDescription>
          </DialogHeader>
          
          <div className="p-8 space-y-6">
            <div className="bg-slate-50 p-5 rounded-3xl border border-dashed border-slate-200 space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Pendiente de Cobro:</p>
              <p className="text-3xl font-black text-primary tracking-tighter">
                {((selectedReg?.registrationCost || (selectedReg?.catechesisYear === "ADULTOS" ? 50000 : 35000)) - (selectedReg?.amountPaid || 0)).toLocaleString('es-PY')} Gs.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-slate-700 ml-1">Monto Recibido (Gs)</Label>
              <Input 
                type="number" 
                className="h-14 text-2xl font-black rounded-2xl bg-slate-50 border-primary/20 text-primary text-center" 
                value={paymentAmount} 
                onChange={(e) => setPaymentAmount(Number(e.target.value))} 
              />
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-slate-700 ml-1">Forma de Pago Real</Label>
              <Select value={paymentType} onValueChange={(val: any) => setPaymentType(val)}>
                <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none shadow-inner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EFECTIVO">
                    <div className="flex items-center gap-2 font-bold"><Banknote className="h-4 w-4" /> Efectivo (Caja)</div>
                  </SelectItem>
                  <SelectItem value="TRANSFERENCIA">
                    <div className="flex items-center gap-2 font-bold"><ArrowRightLeft className="h-4 w-4" /> Transferencia</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentType === "TRANSFERENCIA" && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                <Label className="font-bold text-slate-700 ml-1">Comprobante (Foto)</Label>
                <div 
                  className={cn(
                    "border-2 border-dashed rounded-2xl h-32 flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden",
                    paymentProofUrl ? "border-primary bg-primary/5" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  )} 
                  onClick={() => startCamera()}
                >
                  {paymentProofUrl ? (
                    <img src={paymentProofUrl} className="h-full w-full object-cover" alt="Comprobante" />
                  ) : (
                    <div className="text-center space-y-1">
                      <ImageIcon className="h-6 w-6 text-slate-300 mx-auto" />
                      <p className="text-[10px] font-black text-slate-400 uppercase">Tocar para Capturar</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-8 bg-slate-50 border-t flex flex-row gap-3">
            <Button variant="outline" className="flex-1 h-14 rounded-2xl font-black uppercase text-xs" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button 
              className="flex-1 h-14 bg-primary hover:bg-primary/90 text-white font-black uppercase text-xs rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all" 
              onClick={handleProcessPayment} 
              disabled={isSubmitting || paymentAmount <= 0}
            >
              {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "PROCESAR COBRO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOGO DE RECIBO OFICIAL */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden border-none shadow-2xl bg-white rounded-[2rem] h-[90vh] flex flex-col">
          <DialogHeader className="p-4 bg-slate-50 border-b no-print shrink-0">
            <DialogTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Comprobante Oficial Emitido</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-4 bg-slate-100 no-print flex justify-center">
            <div className="bg-white shadow-xl origin-top scale-[0.75] sm:scale-[0.85] mb-[-15%]">
              <ReceiptContent reg={selectedReg} formatDate={formatReceiptDate} />
            </div>
          </div>

          <div className="hidden print:block">
            <ReceiptContent reg={selectedReg} formatDate={formatReceiptDate} />
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3 no-print shrink-0">
            <Button variant="outline" className="flex-1 rounded-2xl font-black h-14 border-slate-200" onClick={() => setIsReceiptOpen(false)}>CERRAR</Button>
            <Button variant="secondary" className="flex-1 rounded-2xl font-black h-14 bg-green-50 text-green-700 border-green-200 gap-2" onClick={shareViaWhatsApp}>
              <MessageCircle className="h-5 w-5" /> WHATSAPP
            </Button>
            <Button className="flex-1 bg-primary text-white rounded-2xl font-black gap-2 shadow-xl h-14 active:scale-95" onClick={() => window.print()}>
              <Printer className="h-5 w-5" /> IMPRIMIR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CÁMARA */}
      <Dialog open={showCamera} onOpenChange={(open) => !open && setShowCamera(false)}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <DialogTitle className="text-center uppercase font-black text-sm tracking-widest">Capturar Foto Comprobante</DialogTitle>
          </DialogHeader>
          <div className="relative bg-black aspect-[3/4]">
            <video ref={onVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-col gap-4">
            {devices.length > 1 && (
              <Select value={selectedDeviceId} onValueChange={(val) => { setSelectedDeviceId(val); startCamera(val); }}>
                <SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue placeholder="Cambiar Cámara" /></SelectTrigger>
                <SelectContent>{devices.map((d) => (<SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Cámara ${d.deviceId.slice(0,5)}`}</SelectItem>))}</SelectContent>
              </Select>
            )}
            <Button className="w-full h-14 rounded-2xl font-black bg-primary text-lg active:scale-95 transition-all" onClick={takePhoto}>CAPTURAR AHORA</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReceiptContent({ reg, formatDate }: { reg: any, formatDate: any }) {
  return (
    <div className="p-10 bg-white text-black font-serif border-[4px] border-black w-[800px] h-auto">
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
            <p className="text-2xl font-black">{(reg?.amountPaid || 0).toLocaleString('es-PY')}</p>
          </div>
          <div className="border-[2px] border-black p-1 text-center flex-1 flex flex-col justify-center">
            <p className="text-[8px] font-bold uppercase leading-none">RECIBO N°</p>
            <p className="text-xs font-black font-mono leading-none mt-1">{reg?.receiptNumber || '---'}</p>
          </div>
        </div>
      </div>

      <div className="text-center mb-10">
        <h2 className="text-4xl font-black italic tracking-[0.2em] border-b-[3px] border-black inline-block px-16 pb-1">RECIBO</h2>
      </div>

      <div className="space-y-8 text-[15px]">
        <div className="flex items-baseline gap-2">
          <span className="font-bold whitespace-nowrap">Recibí(mos) de:</span>
          <span className="flex-1 border-b border-dotted border-black px-2 uppercase font-black tracking-wide">{reg?.fullName}</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="font-bold whitespace-nowrap">la cantidad de:</span>
          <span className="flex-1 border-b border-dotted border-black px-2 italic font-medium">{(reg?.amountPaid || 0).toLocaleString('es-PY')} Guaraníes</span>
        </div>

        <div className="space-y-3">
          <span className="font-bold">en concepto de:</span>
          <div className="border-[2px] border-black p-5 text-center font-black uppercase text-base tracking-wider">
            INSCRIPCIÓN CATEQUESIS DE CONFIRMACIÓN - {reg?.catechesisYear?.replace('_', ' ')}
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="font-bold whitespace-nowrap">Observación:</span>
          <span className="flex-1 border-b border-dotted border-black px-2 italic font-medium">
            Pago regularizado vía {reg?.lastPaymentMethod || 'EFECTIVO'}.
          </span>
        </div>
      </div>

      <div className="mt-16 space-y-12">
        <div>
          <p className="italic border-b border-black inline-block pr-16 text-sm">
            Asunción, {formatDate(reg?.lastPaymentDate || reg?.createdAt)}
          </p>
          <p className="text-[9px] font-black mt-1 uppercase tracking-widest">(FIRMA Y ACLARACIÓN)</p>
        </div>

        <div className="flex flex-col items-center">
          <div className="p-1 border border-slate-100 rounded-lg shadow-sm">
            <QRCodeCanvas value={`NSPS-RECIBO-${reg?.receiptNumber}`} size={90} level="M" />
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
