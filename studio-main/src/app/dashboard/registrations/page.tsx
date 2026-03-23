
"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Search, 
  Loader2, 
  MoreHorizontal, 
  User, 
  Trash2, 
  Eye,
  AlertTriangle,
  FilterX,
  Download,
  Users,
  Banknote,
  ArrowRightLeft,
  FileText,
  MessageCircle,
  Church,
  Save,
  UserMinus,
  CheckCircle2,
  X,
  ImageIcon,
  Info,
  Shapes,
  CreditCard,
  RotateCcw,
  Plus,
  Phone,
  Heart,
  Calendar,
  Maximize2,
  Camera,
  Clock,
  Edit,
  Move,
  ZoomIn,
  FlipHorizontal,
  Check
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, deleteDoc, updateDoc, serverTimestamp, query, orderBy, runTransaction, addDoc } from "firebase/firestore"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { Slider } from "@/components/ui/slider"

export default function RegistrationsListPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  const [filterSex, setFilterSex] = useState<string>("all")
  const [filterYear, setFilterYear] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterOrigin, setFilterOrigin] = useState<string>("all")
  const [filterDay, setFilterDay] = useState<string>("all")
  const [filterMethod, setFilterMethod] = useState<string>("all")
  
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isRevertDialogOpen, setIsRevertDialogOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false)
  const [isValidatingProofOpen, setIsValidatingProofOpen] = useState(false)
  const [withdrawalReason, setWithdrawalReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // Estados para Validacion Personalizada
  const [validationAmount, setValidationAmount] = useState<number>(0)
  
  // Estado para Visualizador de Imagen Full
  const [fullImageViewerOpen, setFullImageOpen] = useState(false)
  const [fullImageUrl, setFullImageUrl] = useState("")

  // Estado para la forma de pago y foto en edición
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>("")
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null)

  // Estados para Cámara y Ajuste de Foto
  const [showCamera, setShowCamera] = useState(false)
  const [showAdjuster, setShowAdjuster] = useState(false)
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const adjusterImgRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()

  useEffect(() => { 
    setMounted(true)
  }, [])

  const regsQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "confirmations")
  }, [db])

  const groupsQuery = useMemoFirebase(() => db ? collection(db, "groups") : null, [db])
  const usersQuery = useMemoFirebase(() => db ? collection(db, "users") : null, [db])
  const treasuryRef = useMemoFirebase(() => db ? doc(db, "settings", "treasury") : null, [db])

  const { data: rawData, loading } = useCollection(regsQuery)
  const { data: allGroups } = useCollection(groupsQuery)
  const { data: allUsers } = useCollection(usersQuery)
  const { data: costs } = useDoc(treasuryRef)

  const registrations = useMemo(() => {
    if (!rawData) return []
    return [...rawData]
      .filter(r => r.isArchived !== true)
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0))
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0))
        return dateB.getTime() - dateA.getTime()
      })
  }, [rawData])

  const userProfileRef = useMemoFirebase(() => db && user?.uid ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc(userProfileRef)

  const duplicateCis = useMemo(() => {
    if (!registrations) return new Set<string>()
    const counts: Record<string, number> = {}
    registrations.forEach(r => {
      if (r.ciNumber) {
        const cleanCi = r.ciNumber.replace(/[^0-9]/g, '')
        counts[cleanCi] = (counts[cleanCi] || 0) + 1
      }
    })
    return new Set(Object.keys(counts).filter(ci => counts[ci] > 1))
  }, [registrations])

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r: any) => {
      const cleanCi = r.ciNumber?.replace(/[^0-9]/g, '') || ""
      const searchLower = searchTerm.toLowerCase()
      const searchNumbers = searchTerm.replace(/[^0-9]/g, '')
      const matchesSearch = !searchTerm || 
        r.fullName?.toLowerCase().includes(searchLower) || 
        (searchNumbers !== "" && cleanCi.includes(searchNumbers)) ||
        r.phone?.includes(searchTerm) ||
        r.receiptNumber?.toLowerCase().includes(searchLower)
      
      const isRepetido = duplicateCis.has(cleanCi)
      const matchesSex = filterSex === "all" || r.sexo === filterSex
      const matchesYear = filterYear === "all" || r.catechesisYear === filterYear
      const matchesStatus = filterStatus === "all" || (filterStatus === "REPETIDO" ? isRepetido : r.status === filterStatus)
      const matchesOrigin = filterOrigin === "all" || (filterOrigin === "MANUAL" ? r.userId !== "public_registration" : r.userId === "public_registration")
      const matchesDay = filterDay === "all" || r.attendanceDay === filterDay
      const matchesMethod = filterMethod === "all" || r.paymentMethod === filterMethod

      return matchesSearch && matchesSex && matchesYear && matchesStatus && matchesOrigin && matchesDay && matchesMethod
    })
  }, [registrations, searchTerm, filterSex, filterYear, filterStatus, filterOrigin, filterDay, filterMethod, duplicateCis])

  const stats = useMemo(() => {
    if (!filteredRegistrations) return { total: 0, masc: 0, fem: 0 }
    return {
      total: filteredRegistrations.length,
      masc: filteredRegistrations.filter(r => r.sexo === "M").length,
      fem: filteredRegistrations.filter(r => r.sexo === "F").length
    }
  }, [filteredRegistrations])

  const handleOpenDetails = (reg: any) => {
    setSelectedReg(reg)
    setEditPaymentMethod(reg.paymentMethod || "TRANSFERENCIA")
    setEditPhotoUrl(reg.photoUrl || null)
    setIsDetailsOpen(true)
  }

  // Lógica de Cámara y Carga de Archivos
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ variant: "destructive", title: "Formato no válido" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPendingPhoto(reader.result as string);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setShowAdjuster(true);
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = "";
  }

  const startCamera = async (deviceId?: string) => {
    try {
      if (currentStream) currentStream.getTracks().forEach(track => track.stop());
      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          facingMode: deviceId ? undefined : "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setCurrentStream(stream)
      const availableDevices = await navigator.mediaDevices.enumerateDevices()
      setDevices(availableDevices.filter(d => d.kind === 'videoinput'))
      if (!selectedDeviceId && availableDevices.length > 0) {
        setSelectedDeviceId(deviceId || availableDevices.find(d => d.kind === 'videoinput')?.deviceId || "")
      }
      setShowCamera(true)
    } catch (error) {
      toast({ variant: 'destructive', title: 'Acceso a cámara denegado' })
    }
  }

  const stopCamera = () => {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop())
      setCurrentStream(null)
    }
    setShowCamera(false)
  }

  const takePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        setPendingPhoto(canvas.toDataURL('image/jpeg', 0.9));
        setZoom(1);
        setPosition({ x: 0, y: 0 });
        setShowAdjuster(true);
        stopCamera();
      }
    }
  }

  const handleAdjusterConfirm = () => {
    if (!canvasRef.current || !adjusterImgRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 800;
    canvas.height = 800;
    const img = adjusterImgRef.current;
    const realScale = (img.naturalWidth / img.width) * zoom;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 800, 800);
    ctx.save();
    ctx.translate(400, 400);
    ctx.scale(realScale, realScale);
    ctx.translate(position.x * (img.naturalWidth / (img.width * realScale)), position.y * (img.naturalHeight / (img.height * realScale)));
    ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
    ctx.restore();
    const finalDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setEditPhotoUrl(finalDataUrl);
    setShowAdjuster(false);
    setPendingPhoto(null);
    toast({ title: "Imagen actualizada" });
  }

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  }

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setPosition({ x: clientX - dragStart.x, y: clientY - dragStart.y });
  }

  const handleMouseUp = () => setIsDragging(false);

  // Funciones de Negocio
  const handleOpenValidation = (reg: any) => {
    setSelectedReg(reg)
    const limit = reg.registrationCost || (reg.catechesisYear === "ADULTOS" ? (costs?.adultCost || 50000) : (costs?.juvenileCost || 35000))
    setValidationAmount(limit)
    setIsValidatingProofOpen(true)
  }

  const handleConfirmValidation = async () => {
    if (!db || !selectedReg || !treasuryRef || isProcessing) return
    const limit = selectedReg.registrationCost || (selectedReg.catechesisYear === "ADULTOS" ? (costs?.adultCost || 50000) : (costs?.juvenileCost || 35000))
    if (validationAmount > limit) {
      toast({ variant: "destructive", title: "Monto no permitido", description: `El monto no puede superar el límite de ${limit.toLocaleString('es-PY')} Gs.` })
      return
    }
    setIsProcessing(true)
    const regRef = doc(db, "confirmations", selectedReg.id)
    const catechistName = profile ? `${profile.firstName} ${profile.lastName}` : "Tesorero"
    try {
      await runTransaction(db, async (transaction) => {
        const treasurySnap = await transaction.get(treasuryRef!);
        const currentNext = treasurySnap.exists() ? (treasurySnap.data()?.nextReceiptNumber || 1) : 1;
        const formattedReceipt = `001-001-${String(currentNext).padStart(7, '0')}`;
        
        transaction.update(regRef, {
          amountPaid: validationAmount,
          paymentStatus: validationAmount >= limit ? "PAGADO" : "PARCIAL",
          status: "INSCRITO",
          validatedBy: catechistName,
          receiptNumber: formattedReceipt,
          lastPaymentDate: serverTimestamp(),
          lastPaymentMethod: selectedReg.paymentMethod || "TRANSFERENCIA"
        });

        transaction.set(treasuryRef!, { nextReceiptNumber: currentNext + 1 }, { merge: true });
        
        transaction.set(doc(collection(db, "audit_logs")), {
          userId: user?.uid || "unknown",
          userName: catechistName,
          action: "Confirmación de Pago",
          module: "inscripcion",
          details: `Se confirmó el pago de ${validationAmount.toLocaleString('es-PY')} Gs. para ${selectedReg.fullName}. Recibo: ${formattedReceipt}`,
          timestamp: serverTimestamp()
        })
      });
      toast({ title: "Pago confirmado con éxito" })
      setIsValidatingProofOpen(false)
    } catch (e) { toast({ variant: "destructive", title: "Error al confirmar" }) }
    finally { setIsProcessing(false) }
  }

  const handleRevertValidation = async () => {
    if (!db || !selectedReg || isProcessing) return
    setIsProcessing(true)
    const regRef = doc(db, "confirmations", selectedReg.id)
    try {
      await updateDoc(regRef, {
        status: "POR_VALIDAR",
        paymentStatus: "PENDIENTE",
        amountPaid: 0,
        receiptNumber: null,
        validatedBy: null,
        lastPaymentDate: null,
        lastPaymentMethod: null,
        updatedAt: serverTimestamp()
      })
      await addDoc(collection(db, "audit_logs"), {
        userId: user?.uid || "unknown",
        userName: profile ? `${profile.firstName} ${profile.lastName}` : "Administrador",
        action: "Anular Pago",
        module: "tesoreria",
        details: `Se anuló la confirmación de pago de ${selectedReg.fullName}. Registro volvió a 'Por Validar'.`,
        timestamp: serverTimestamp()
      })
      toast({ title: "Pago Anulado" })
      setIsRevertDialogOpen(false); setIsDetailsOpen(false);
    } catch (e) { toast({ variant: "destructive", title: "Error al revertir" }) }
    finally { setIsProcessing(false) }
  }

  const handleUpdateDetails = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !selectedReg || isProcessing) return
    setIsProcessing(true)
    const formData = new FormData(e.currentTarget)
    const updateData = {
      fullName: (formData.get("fullName") as string).toUpperCase(),
      ciNumber: formData.get("ciNumber") as string,
      phone: formData.get("phone") as string,
      groupId: formData.get("groupId") as string,
      catechesisYear: formData.get("catechesisYear") as string,
      paymentMethod: editPaymentMethod,
      photoUrl: editPhotoUrl,
      motherName: (formData.get("motherName") as string || "").toUpperCase(),
      motherPhone: formData.get("motherPhone") as string || "",
      fatherName: (formData.get("fatherName") as string || "").toUpperCase(),
      fatherPhone: formData.get("fatherPhone") as string || "",
      baptismParish: formData.get("baptismParish") as string || "",
      baptismBook: formData.get("baptismBook") as string || "",
      baptismFolio: formData.get("baptismFolio") as string || "",
      updatedAt: serverTimestamp()
    }
    const regRef = doc(db, "confirmations", selectedReg.id)
    updateDoc(regRef, updateData)
      .then(() => { toast({ title: "Ficha actualizada" }); setIsDetailsOpen(false); })
      .catch(async (error) => { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: regRef.path, operation: 'update', requestResourceData: updateData })); })
      .finally(() => setIsProcessing(false))
  }

  const handleWithdrawal = async () => {
    if (!db || !selectedReg || isProcessing || !withdrawalReason) return
    setIsProcessing(true)
    try {
      await updateDoc(doc(db, "confirmations", selectedReg.id), { isArchived: true, status: "BAJA", withdrawalReason, withdrawalDate: serverTimestamp() })
      toast({ title: "Baja procesada" }); setIsWithdrawalOpen(false); setIsDetailsOpen(false);
    } catch (e) { toast({ variant: "destructive", title: "Error" }) }
    finally { setIsProcessing(false) }
  }

  const handleDelete = async () => {
    if (!db || !selectedReg) return
    setIsProcessing(true)
    try { await deleteDoc(doc(db, "confirmations", selectedReg.id)); toast({ title: "Registro eliminado" }); setIsDeleteDialogOpen(false); }
    catch (e) { toast({ variant: "destructive", title: "Error" }) }
    finally { setIsProcessing(false) }
  }

  const openImageViewer = (url: string) => { if (!url) return; setFullImageUrl(url); setFullImageOpen(true); }
  const resetFilters = () => { setSearchTerm(""); setFilterSex("all"); setFilterYear("all"); setFilterStatus("all"); setFilterOrigin("all"); setFilterDay("all"); setFilterMethod("all"); }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold text-primary tracking-tight">Lista de Confirmandos</h1>
          <p className="text-muted-foreground font-medium">Gestión administrativa de postulantes ciclo 2026.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl h-12 font-bold px-6 border-slate-200 bg-white hover:bg-slate-50 gap-2 shadow-sm" onClick={() => {
            if (filteredRegistrations.length === 0) return;
            const headers = ["Nombre", "CI", "Celular", "Año", "Dia", "Estado"];
            const rows = filteredRegistrations.map(r => [r.fullName, r.ciNumber, r.phone, r.catechesisYear, r.attendanceDay, r.status]);
            const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "lista_confirmandos.csv");
            document.body.appendChild(link);
            link.click();
          }}>
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Button asChild className="bg-primary hover:bg-primary/90 rounded-2xl h-12 font-black px-8 shadow-lg shadow-primary/20 text-white">
            <Link href="/dashboard/registration" prefetch={false}>Nueva Ficha</Link>
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
        <CardHeader className="bg-slate-50/30 p-8 pb-0">
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row gap-6 items-end">
              <div className="flex-1 w-full space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Buscador Principal</Label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input 
                    placeholder="Nombre o C.I..." 
                    className="pl-12 h-14 rounded-2xl bg-white border-slate-200 shadow-sm text-lg" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                  />
                </div>
              </div>
              
              <div className="flex gap-3 w-full lg:w-auto">
                <div className="bg-white px-6 py-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center min-w-[100px]">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total</p>
                  <p className="text-xl font-black text-primary leading-none">{loading ? "..." : stats.total}</p>
                </div>
                <div className="bg-white px-6 py-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center min-w-[100px]">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Hombres</p>
                  <p className="text-xl font-black text-blue-600 leading-none">{loading ? "..." : stats.masc}</p>
                </div>
                <div className="bg-white px-6 py-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center min-w-[100px]">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Mujeres</p>
                  <p className="text-xl font-black text-pink-600 leading-none">{loading ? "..." : stats.fem}</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4 pb-8 border-b border-slate-100">
              <div className="space-y-1.5 flex-1 min-w-[140px]"><Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sexo</Label><Select value={filterSex} onValueChange={setFilterSex}><SelectTrigger className="h-12 rounded-2xl bg-white"><SelectValue placeholder="Sexo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="M">Masc.</SelectItem><SelectItem value="F">Fem.</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5 flex-1 min-w-[140px]"><Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nivel</Label><Select value={filterYear} onValueChange={setFilterYear}><SelectTrigger className="h-12 rounded-2xl bg-white"><SelectValue placeholder="Nivel" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="PRIMER_AÑO">1° Año</SelectItem><SelectItem value="SEGUNDO_AÑO">2° Año</SelectItem><SelectItem value="ADULTOS">Adultos</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5 flex-1 min-w-[140px]"><Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado</Label><Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="h-12 rounded-2xl bg-white"><SelectValue placeholder="Estado" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="INSCRITO">Inscritos</SelectItem><SelectItem value="POR_VALIDAR">Por Validar</SelectItem><SelectItem value="REPETIDO">Repetidos</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5 flex-1 min-w-[140px]"><Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Método Pago</Label><Select value={filterMethod} onValueChange={setFilterMethod}><SelectTrigger className="h-12 rounded-2xl bg-white"><SelectValue placeholder="Método" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="EFECTIVO">Efectivo</SelectItem><SelectItem value="TRANSFERENCIA">Transferencia</SelectItem><SelectItem value="SIN_PAGO">Pagar en Caja</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5 flex-1 min-w-[140px]"><Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Horario</Label><Select value={filterDay} onValueChange={setFilterDay}><SelectTrigger className="h-12 rounded-2xl bg-white"><SelectValue placeholder="Horario" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="SABADO">Sábados</SelectItem><SelectItem value="DOMINGO">Domingos</SelectItem></SelectContent></Select></div>
              <div className="flex items-end pb-1"><Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-100" onClick={resetFilters}><FilterX className="h-5 w-5 text-slate-400" /></Button></div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cargando...</p></div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="py-32 text-center text-slate-400 italic">No se encontraron registros.</div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50 border-y">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-8 py-5 font-bold text-slate-500">Confirmando</TableHead>
                  <TableHead className="font-bold text-slate-500">Origen</TableHead>
                  <TableHead className="font-bold text-slate-500">Año / Horario</TableHead>
                  <TableHead className="font-bold text-slate-500">Forma Pago</TableHead>
                  <TableHead className="text-center font-bold text-slate-500">Estado</TableHead>
                  <TableHead className="font-bold text-slate-500">Fecha Insc.</TableHead>
                  <TableHead className="text-right pr-8 font-bold text-slate-500">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg) => {
                  const cleanCi = reg.ciNumber?.replace(/[^0-9]/g, '') || ""
                  const isRepetido = duplicateCis.has(cleanCi)
                  const isManual = reg.userId !== "public_registration"
                  const creator = allUsers?.find(u => u.id === reg.userId)
                  const createdDate = reg.createdAt?.toDate ? reg.createdAt.toDate() : (reg.createdAt ? new Date(reg.createdAt) : new Date())
                  const isEfectivo = reg.paymentMethod === "EFECTIVO"
                  const isPagarEnCaja = reg.paymentMethod === "SIN_PAGO"
                  const methodLabel = isPagarEnCaja ? "PAGAR EN CAJA" : (reg.paymentMethod || "TRANSFERENCIA")
                  
                  return (
                    <TableRow key={reg.id} className="h-24 hover:bg-slate-50/30 transition-colors border-slate-100">
                      <TableCell className="pl-8">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12 border-2 border-white shadow-sm ring-1 ring-slate-100 cursor-pointer" onClick={() => openImageViewer(reg.photoUrl)}>
                            <AvatarImage src={reg.photoUrl} className="object-cover" />
                            <AvatarFallback className="bg-slate-50 text-slate-300 font-black"><User /></AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sm text-slate-900 uppercase tracking-tight leading-none">{reg.fullName}</span>
                              {isRepetido && (
                                <Badge className="bg-red-500 hover:bg-red-600 text-white text-[8px] font-black h-4 px-1.5 rounded-full animate-pulse">REPETIDO</Badge>
                              )}
                            </div>
                            <span className="text-xs font-bold text-blue-600 tracking-tighter mt-1">{reg.ciNumber}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{reg.phone}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <Badge variant="secondary" className={cn("text-[9px] font-black uppercase tracking-widest px-2.5 h-6 rounded-full border-none shadow-sm w-fit", isManual ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700")}>
                            {isManual ? "MANUAL" : "PÚBLICO"}
                          </Badge>
                          {isManual && creator && (
                            <span className="text-[9px] text-slate-400 font-bold uppercase mt-1 ml-1 truncate max-w-[100px]">
                              {creator.firstName}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-slate-200 bg-white w-fit">
                            {reg.catechesisYear?.replace("_", " ")}
                          </Badge>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                            {reg.attendanceDay}S
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={cn(
                          "flex items-center gap-1.5 text-[9px] font-black uppercase",
                          isEfectivo ? "text-green-600" : isPagarEnCaja ? "text-amber-600" : "text-blue-600"
                        )}>
                          {isEfectivo ? <Banknote className="h-3 w-3" /> : isPagarEnCaja ? <Clock className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}
                          {methodLabel}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn("h-6 px-3 rounded-full text-[9px] font-black tracking-widest border-orange-200 text-orange-600 bg-orange-50", 
                          reg.status === "INSCRITO" && "border-green-200 text-green-600 bg-green-50")}>
                          {reg.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700">{createdDate.toLocaleDateString('es-PY')}</span>
                          <span className="text-[9px] text-slate-400 font-medium">{createdDate.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex items-center justify-end gap-3">
                          <button className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-300 hover:text-primary" onClick={() => handleOpenDetails(reg)}>
                            <Eye className="h-5 w-5" />
                          </button>
                          
                          {(reg.status === "POR_VALIDAR" || isPagarEnCaja) && reg.status !== "INSCRITO" && (
                            <Button 
                              variant="outline" 
                              className="h-9 px-6 rounded-full font-black text-[10px] tracking-widest border-blue-600 text-blue-600 hover:bg-blue-50 transition-all uppercase"
                              onClick={() => handleOpenValidation(reg)}
                              disabled={isProcessing}
                            >
                              CONFIRMAR PAGO
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-slate-300 hover:bg-slate-100">
                                <MoreHorizontal className="h-5 w-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[200px] p-2 rounded-2xl border-none shadow-2xl">
                              <DropdownMenuItem className="h-11 rounded-xl cursor-pointer gap-3" onClick={() => handleOpenDetails(reg)}>
                                <FileText className="h-4 w-4 text-slate-400" /> <span className="font-bold">Editar Ficha</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem className="h-11 rounded-xl cursor-pointer gap-3" onClick={() => handleOpenDetails(reg)}>
                                <Shapes className="h-4 w-4 text-slate-400" /> <span className="font-bold">Asignar Grupo</span>
                              </DropdownMenuItem>
                              {reg.status === "INSCRITO" && (
                                <DropdownMenuItem className="h-11 rounded-xl cursor-pointer gap-3 text-amber-600" onClick={() => { setSelectedReg(reg); setIsRevertDialogOpen(true); }}>
                                  <RotateCcw className="h-4 w-4" /> <span className="font-bold">Anular Pago</span>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="h-11 rounded-xl cursor-pointer gap-3 text-orange-600" onClick={() => { setSelectedReg(reg); setIsWithdrawalOpen(true); }}>
                                <UserMinus className="h-4 w-4" /> <span className="font-bold">Dar de Baja</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => { setSelectedReg(reg); setIsDeleteDialogOpen(true); }} 
                                className="h-11 rounded-xl text-destructive focus:bg-red-50 focus:text-destructive cursor-pointer gap-3"
                              >
                                <Trash2 className="h-4 w-4" /> <span className="font-bold">Eliminar</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* DIÁLOGO FICHA DE INSCRIPCIÓN ELEGANTE */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[850px] p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] h-[90vh] flex flex-col">
          {selectedReg && (
            <form onSubmit={handleUpdateDetails} className="flex flex-col h-full overflow-hidden">
              <DialogHeader className="p-8 bg-slate-900 text-white shrink-0 relative">
                <div className="absolute top-0 right-0 p-8 opacity-10"><Church className="h-24 w-24" /></div>
                <div className="flex items-center gap-6 relative z-10">
                  <div className="relative group">
                    <Avatar className="h-24 w-24 border-4 border-white/20 shadow-xl overflow-hidden">
                      <AvatarImage src={editPhotoUrl || undefined} className="object-cover" />
                      <AvatarFallback className="bg-white/10 text-white"><User className="h-12 w-12" /></AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 flex gap-1">
                      <button 
                        type="button"
                        className="h-8 w-8 rounded-full bg-primary text-white border-2 border-slate-900 flex items-center justify-center hover:bg-primary/90 transition-all shadow-lg active:scale-95"
                        onClick={() => startCamera()}
                      >
                        <Camera className="h-3.5 w-3.5" />
                      </button>
                      <button 
                        type="button"
                        className="h-8 w-8 rounded-full bg-blue-600 text-white border-2 border-slate-900 flex items-center justify-center hover:bg-blue-700 transition-all shadow-lg active:scale-95"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                  </div>
                  <div className="space-y-1">
                    <DialogTitle className="text-3xl font-black uppercase tracking-tight leading-none">{selectedReg.fullName}</DialogTitle>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className="bg-primary/20 text-primary-foreground border-none px-3 font-bold">{selectedReg.status}</Badge>
                      <Badge variant="outline" className="border-white/20 text-white/60 font-medium">{selectedReg.catechesisYear?.replace('_', ' ')}</Badge>
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">REG N° {selectedReg.id.split('_')[1]}</span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
                <Tabs defaultValue="general" className="w-full">
                  <TabsList className="mb-8 bg-white border p-1 rounded-2xl shadow-sm h-14 w-full justify-start gap-2">
                    <TabsTrigger value="general" className="rounded-xl px-6 font-bold h-11 data-[state=active]:bg-primary data-[state=active]:text-white">General</TabsTrigger>
                    <TabsTrigger value="family" className="rounded-xl px-6 font-bold h-11 data-[state=active]:bg-primary data-[state=active]:text-white">Familia</TabsTrigger>
                    <TabsTrigger value="catechesis" className="rounded-xl px-6 font-bold h-11 data-[state=active]:bg-primary data-[state=active]:text-white">Catequesis</TabsTrigger>
                    <TabsTrigger value="docs" className="rounded-xl px-6 font-bold h-11 data-[state=active]:bg-primary data-[state=active]:text-white">Documentos & Pagos</TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-8 rounded-[2rem] border shadow-sm">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</Label>
                        <Input name="fullName" defaultValue={selectedReg.fullName} required className="h-12 rounded-xl bg-slate-50 border-none shadow-inner uppercase font-bold" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número de C.I.</Label>
                        <Input name="ciNumber" defaultValue={selectedReg.ciNumber} required className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono Principal</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                          <Input name="phone" defaultValue={selectedReg.phone} required className="pl-10 h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Forma de Pago Inicial</Label>
                        <Select 
                          name="paymentMethod" 
                          value={editPaymentMethod} 
                          onValueChange={setEditPaymentMethod}
                        >
                          <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold">
                            <SelectValue placeholder="Seleccione método" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EFECTIVO">EFECTIVO</SelectItem>
                            <SelectItem value="TRANSFERENCIA">TRANSFERENCIA</SelectItem>
                            <SelectItem value="SIN_PAGO">PAGAR EN CAJA</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="family" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="bg-white p-8 rounded-[2rem] border shadow-sm space-y-6">
                        <div className="flex items-center gap-2 border-b pb-2"><Heart className="h-4 w-4 text-pink-500" /><h4 className="text-xs font-black uppercase text-slate-500">Datos de la Madre</h4></div>
                        <div className="space-y-4">
                          <div className="space-y-1.5"><Label className="text-[9px] font-black text-slate-400 uppercase ml-1">Nombre Completo</Label><Input name="motherName" defaultValue={selectedReg.motherName} className="h-11 rounded-xl bg-slate-50 border-none uppercase font-bold" /></div>
                          <div className="space-y-1.5"><Label className="text-[9px] font-black text-slate-400 uppercase ml-1">Celular</Label><Input name="motherPhone" defaultValue={selectedReg.motherPhone} className="h-11 rounded-xl bg-slate-50 border-none font-bold" /></div>
                        </div>
                      </div>
                      <div className="bg-white p-8 rounded-[2rem] border shadow-sm space-y-6">
                        <div className="flex items-center gap-2 border-b pb-2"><Heart className="h-4 w-4 text-blue-500" /><h4 className="text-xs font-black uppercase text-slate-500">Datos del Padre</h4></div>
                        <div className="space-y-4">
                          <div className="space-y-1.5"><Label className="text-[9px] font-black text-slate-400 uppercase ml-1">Nombre Completo</Label><Input name="fatherName" defaultValue={selectedReg.fatherName} className="h-11 rounded-xl bg-slate-50 border-none uppercase font-bold" /></div>
                          <div className="space-y-1.5"><Label className="text-[9px] font-black text-slate-400 uppercase ml-1">Celular</Label><Input name="fatherPhone" defaultValue={selectedReg.fatherPhone} className="h-11 rounded-xl bg-slate-50 border-none font-bold" /></div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="catechesis" className="space-y-6">
                    <div className="p-8 bg-white rounded-[2rem] border shadow-sm space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Año de Catequesis</Label>
                          <Select name="catechesisYear" defaultValue={selectedReg.catechesisYear}>
                            <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none shadow-inner"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PRIMER_AÑO">PRIMER AÑO</SelectItem>
                              <SelectItem value="SEGUNDO_AÑO">SEGUNDO AÑO</SelectItem>
                              <SelectItem value="ADULTOS">ADULTOS</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asignación de Grupo</Label>
                          <Select name="groupId" defaultValue={selectedReg.groupId || "none"}>
                            <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold"><SelectValue placeholder="Sin grupo asignado" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">SIN GRUPO ASIGNADO</SelectItem>
                              {allGroups?.filter(g => g.catechesisYear === selectedReg.catechesisYear).map(g => (
                                <SelectItem key={g.id} value={g.id}>{g.name} ({g.attendanceDay})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
                        <div className="flex items-center gap-2 border-b pb-2"><Church className="h-4 w-4 text-primary" /><h4 className="text-xs font-black uppercase text-slate-500">Datos de Bautismo</h4></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1.5"><Label className="text-[9px] font-black text-slate-400 uppercase ml-1">Parroquia</Label><Input name="baptismParish" defaultValue={selectedReg.baptismParish} className="h-10 rounded-xl bg-white border-slate-200" /></div>
                          <div className="space-y-1.5"><Label className="text-[9px] font-black text-slate-400 uppercase ml-1">Libro</Label><Input name="baptismBook" defaultValue={selectedReg.baptismBook} className="h-10 rounded-xl bg-white border-slate-200" /></div>
                          <div className="space-y-1.5"><Label className="text-[9px] font-black text-slate-400 uppercase ml-1">Folio</Label><Input name="baptismFolio" defaultValue={selectedReg.baptismFolio} className="h-10 rounded-xl bg-white border-slate-200" /></div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="docs" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="p-8 bg-white rounded-[2rem] border shadow-sm space-y-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-blue-500" /><h4 className="text-xs font-black uppercase text-slate-500">Comprobante de Pago</h4></div>
                          {selectedReg.receiptNumber && <Badge className="bg-green-100 text-green-700 border-none">RECIBO: {selectedReg.receiptNumber}</Badge>}
                        </div>
                        <div className="aspect-[4/3] bg-slate-100 rounded-3xl overflow-hidden border border-dashed border-slate-300 relative group cursor-pointer" onClick={() => openImageViewer(selectedReg.paymentProofUrl)}>
                          {selectedReg.paymentProofUrl ? (
                            <>
                              <img src={selectedReg.paymentProofUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Maximize2 className="h-8 w-8 text-white" /></div>
                            </>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2"><ImageIcon className="h-12 w-12" /><span className="text-[10px] font-bold uppercase">Sin imagen adjunta</span></div>
                          )}
                        </div>
                        <div className="pt-2 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                          <span>Monto Abonado:</span>
                          <span className="text-slate-900 text-sm">{(selectedReg.amountPaid || 0).toLocaleString('es-PY')} Gs.</span>
                        </div>
                      </div>

                      <div className="p-8 bg-white rounded-[2rem] border shadow-sm space-y-4">
                        <div className="flex items-center gap-2 mb-2"><ImageIcon className="h-4 w-4 text-orange-500" /><h4 className="text-xs font-black uppercase text-slate-500">Certificado de Bautismo</h4></div>
                        <div className="aspect-[4/3] bg-slate-100 rounded-3xl overflow-hidden border border-dashed border-slate-300 relative group cursor-pointer" onClick={() => openImageViewer(selectedReg.baptismCertificatePhotoUrl)}>
                          {selectedReg.baptismCertificatePhotoUrl ? (
                            <>
                              <img src={selectedReg.baptismCertificatePhotoUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Maximize2 className="h-8 w-8 text-white" /></div>
                            </>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2"><ImageIcon className="h-12 w-12" /><span className="text-[10px] font-bold uppercase">Sin imagen adjunta</span></div>
                          )}
                        </div>
                        <div className="pt-2 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                          <span>Estado SACRAMENTO:</span>
                          <Badge variant="outline" className={cn("text-[9px]", selectedReg.hasBaptism ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50")}>{selectedReg.hasBaptism ? "BAUTIZADO" : "SIN BAUTISMO"}</Badge>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <DialogFooter className="p-8 bg-white border-t flex items-center justify-end gap-3">
                <Button type="button" variant="outline" className="h-12 px-8 rounded-xl font-bold border-slate-200" onClick={() => setIsDetailsOpen(false)}>Cerrar</Button>
                <Button type="submit" className="h-12 px-10 rounded-xl bg-primary hover:bg-primary/90 text-white font-black shadow-xl gap-2 active:scale-95 transition-all" disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />} GUARDAR CAMBIOS
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE CÁMARA */}
      <Dialog open={showCamera} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-primary text-white">
            <DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Capturar Fotografía</DialogTitle>
          </DialogHeader>
          <div className="relative bg-black aspect-square max-h-[60vh] mx-auto flex items-center justify-center overflow-hidden">
            <video ref={onVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-col gap-4">
            {devices.length > 1 && (
              <div className="flex items-center gap-2 w-full">
                <FlipHorizontal className="h-4 w-4 text-slate-400" />
                <Select value={selectedDeviceId} onValueChange={(val) => { setSelectedDeviceId(val); startCamera(val); }}>
                  <SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue placeholder="Cambiar Cámara" /></SelectTrigger>
                  <SelectContent>{devices.map((d) => (<SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Cámara ${d.deviceId.slice(0,5)}`}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={stopCamera}>Cancelar</Button>
              <Button className="flex-1 h-12 rounded-xl bg-primary text-white font-bold gap-2" onClick={takePhoto}>Capturar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE AJUSTE Y RECORTE */}
      <Dialog open={showAdjuster} onOpenChange={(open) => !open && setShowAdjuster(false)}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-slate-900 text-white">
            <DialogTitle className="flex items-center gap-2"><Move className="h-5 w-5" /> Ajustar Fotografía</DialogTitle>
            <DialogDescription className="text-slate-400">Centra la imagen antes de confirmar.</DialogDescription>
          </DialogHeader>
          <div className="p-8 bg-slate-50 flex flex-col items-center gap-8">
            <div 
              className="relative w-[300px] h-[300px] rounded-full border-4 border-white shadow-2xl bg-black overflow-hidden cursor-move touch-none"
              onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
              onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
            >
              {pendingPhoto && (
                <img 
                  ref={adjusterImgRef} src={pendingPhoto} alt="Ajuste"
                  className="absolute pointer-events-none select-none max-w-none"
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                    left: '50%', top: '50%',
                    marginLeft: adjusterImgRef.current ? -adjusterImgRef.current.width / 2 : 0,
                    marginTop: adjusterImgRef.current ? -adjusterImgRef.current.height / 2 : 0,
                    transition: isDragging ? 'none' : 'transform 0.1s'
                  }}
                />
              )}
              <div className="absolute inset-0 rounded-full border-[100px] border-slate-900/20 pointer-events-none" />
            </div>
            <div className="w-full space-y-4 px-4">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><ZoomIn className="h-3 w-3" /> Zoom</Label>
                <span className="text-[10px] font-bold text-primary">{Math.round(zoom * 100)}%</span>
              </div>
              <Slider value={[zoom]} min={0.5} max={3} step={0.01} onValueChange={(val) => setZoom(val[0])} />
            </div>
          </div>
          <DialogFooter className="p-6 bg-white border-t flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setShowAdjuster(false)}>Cancelar</Button>
            <Button className="flex-1 h-12 rounded-xl bg-primary text-white font-bold gap-2 shadow-lg" onClick={handleAdjusterConfirm}><Check className="h-5 w-5" /> Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VISUALIZADOR DE IMAGEN FULL */}
      <Dialog open={fullImageViewerOpen} onOpenChange={setFullImageOpen}>
        <DialogContent className="max-w-[95vw] h-[95vh] p-0 border-none bg-black/95 shadow-2xl flex flex-col items-center justify-center rounded-none sm:rounded-[2.5rem] overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Visualizador de Imagen</DialogTitle>
            <DialogDescription>Vista ampliada del documento o foto de perfil</DialogDescription>
          </DialogHeader>
          <button className="absolute top-6 right-6 z-50 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all" onClick={() => setFullImageOpen(false)}><X className="h-6 w-6" /></button>
          <div className="w-full h-full p-4 flex items-center justify-center">
            <img src={fullImageUrl} className="max-w-full max-h-full object-contain animate-in zoom-in-95 duration-300" />
          </div>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO CONFIRMAR PAGO (VALIDACIÓN) AVANZADO */}
      <Dialog open={isValidatingProofOpen} onOpenChange={setIsValidatingProofOpen}>
        <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl h-[90vh] flex flex-col">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Confirmación de Pago</DialogTitle>
                <DialogDescription className="text-slate-400">Procesando abono de {selectedReg?.fullName}</DialogDescription>
              </div>
              <div className="flex gap-2">
                {selectedReg?.paymentProofUrl && (
                  <Button variant="secondary" size="icon" className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border-none" onClick={() => {
                    const link = document.createElement("a");
                    link.href = selectedReg.paymentProofUrl;
                    link.download = `comprobante-${selectedReg.ciNumber || selectedReg.id}.jpg`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }} title="Descargar Comprobante">
                    <Download className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="secondary" size="icon" className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border-none" onClick={() => setIsValidatingProofOpen(false)} title="Cerrar">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            <div className="flex-1 bg-slate-100 flex items-center justify-center p-4 relative overflow-auto">
              {selectedReg?.paymentProofUrl ? (
                <img 
                  src={selectedReg.paymentProofUrl} 
                  className="max-w-full h-auto rounded-xl shadow-lg transition-transform duration-300 origin-center cursor-pointer"
                  onClick={() => openImageViewer(selectedReg.paymentProofUrl)}
                  alt="Comprobante"
                />
              ) : (
                <div className="text-center space-y-4">
                  <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
                  <div className="text-slate-400 italic">Sin comprobante para mostrar (Pago en Caja o Efectivo)</div>
                </div>
              )}
            </div>
            <div className="w-full md:w-[350px] bg-white border-l p-8 space-y-8 overflow-y-auto flex flex-col">
              <div className="space-y-4">
                <Label className="text-[10px] font-black text-primary uppercase tracking-widest">Información del Postulante</Label>
                <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
                  <p className="text-sm font-black text-slate-900 uppercase">{selectedReg?.fullName}</p>
                  <p className="text-xs font-bold text-slate-500 uppercase">C.I. {selectedReg?.ciNumber}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{selectedReg?.catechesisYear?.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="space-y-4 flex-1">
                <Label className="font-bold">Monto a Confirmar (Gs)</Label>
                <Input type="number" className="h-14 text-2xl font-black rounded-2xl bg-slate-50 border-primary/20" value={validationAmount} onChange={(e) => setValidationAmount(Number(e.target.value))} />
                <p className="text-[10px] text-slate-400 italic">Verifica que el monto coincida con el arancel o comprobante.</p>
              </div>
              <div className="pt-4 mt-auto">
                <Button className="w-full h-14 rounded-2xl bg-green-600 hover:bg-green-700 font-bold gap-2 shadow-xl shadow-green-100 active:scale-95 transition-all" onClick={handleConfirmValidation} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <><CheckCircle2 className="h-5 w-5" /> CONFIRMAR PAGO</>}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO ANULAR PAGO */}
      <AlertDialog open={isRevertDialogOpen} onOpenChange={setIsRevertDialogOpen}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-amber-500 p-8 text-white"><RotateCcw className="h-12 w-12 mx-auto mb-4" /><AlertDialogTitle className="text-2xl font-black text-center uppercase">¿Anular Pago?</AlertDialogTitle></div>
          <div className="p-8"><AlertDialogDescription className="text-center font-medium">Se anulará el recibo de <strong className="text-slate-900">"{selectedReg?.fullName}"</strong>. El estado volverá a "Por Validar" y el monto pagado se reiniciará a cero. Esta acción se registrará en la auditoría.</AlertDialogDescription></div>
          <AlertDialogFooter className="p-8 bg-slate-50 gap-3 border-t"><AlertDialogCancel className="rounded-2xl h-14 font-black flex-1">CANCELAR</AlertDialogCancel><AlertDialogAction className="bg-amber-600 hover:bg-amber-700 text-white rounded-2xl h-14 font-black flex-1" onClick={handleRevertValidation} disabled={isProcessing}>ANULAR AHORA</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIÁLOGO DAR DE BAJA */}
      <Dialog open={isWithdrawalOpen} onOpenChange={setIsWithdrawalOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-orange-600 text-white"><DialogTitle>Procesar Baja Definitiva</DialogTitle></DialogHeader>
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-600">Explica el motivo por el cual el alumno abandona la catequesis.</p>
            <div className="space-y-2"><Label className="font-bold">Motivo del Retiro</Label><Input value={withdrawalReason} onChange={(e) => setWithdrawalReason(e.target.value)} placeholder="Ej. Cambio de domicilio, decisión personal..." className="h-12 rounded-xl" /></div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t gap-3"><Button variant="outline" onClick={() => setIsWithdrawalOpen(false)}>Cancelar</Button><Button className="bg-orange-600 hover:bg-orange-700 font-bold" onClick={handleWithdrawal} disabled={!withdrawalReason || isProcessing}>Confirmar Baja</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO ELIMINAR */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-red-600 p-8 text-white"><AlertTriangle className="h-12 w-12 mx-auto mb-4" /><AlertDialogTitle className="text-2xl font-black text-center uppercase">¿Eliminar Registro?</AlertDialogTitle></div>
          <div className="p-8"><AlertDialogDescription className="text-center font-medium">Esta acción es irreversible. Se borrará permanentemente la ficha de <strong className="text-slate-900">"{selectedReg?.fullName}"</strong>.</AlertDialogDescription></div>
          <AlertDialogFooter className="p-8 bg-slate-50 gap-3 border-t"><AlertDialogCancel className="rounded-2xl h-14 font-black flex-1">CANCELAR</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white rounded-2xl h-14 font-black flex-1" onClick={handleDelete} disabled={isProcessing}>ELIMINAR AHORA</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
