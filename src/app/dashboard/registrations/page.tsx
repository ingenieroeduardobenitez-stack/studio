
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
  CheckCircle2, 
  ImageIcon,
  Edit,
  Save,
  Wallet,
  Download,
  FilterX,
  Maximize2,
  Printer,
  ChevronRight,
  MessageCircle,
  Receipt,
  Eye,
  Users,
  Venus,
  Mars,
  FileText,
  Church,
  Calendar,
  Phone,
  BookOpen,
  X,
  Globe,
  Clock,
  ZoomIn,
  ZoomOut,
  Camera,
  FlipHorizontal
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, updateDoc, deleteDoc, serverTimestamp, addDoc, runTransaction, query, orderBy, limit } from "firebase/firestore"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { QRCodeCanvas } from "qrcode.react"
import Image from "next/image"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

type CaptureTarget = "photo" | "baptism" | "paymentProof"

// Componente de Formulario de Edición con Cámara y Carga de Archivos
function EditRegistrationForm({ 
  selectedReg, 
  profile, 
  onClose, 
  onSaveSuccess
}: { 
  selectedReg: any, 
  profile: any, 
  onClose: () => void, 
  onSaveSuccess: () => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(selectedReg?.photoUrl || null)
  const [editBaptismPreview, setEditBaptismPreview] = useState<string | null>(selectedReg?.baptismCertificatePhotoUrl || null)
  const [editPaymentProofPreview, setEditPaymentProofPreview] = useState<string | null>(selectedReg?.paymentProofUrl || null)
  
  const [editCatechesisYear, setEditCatechesisYear] = useState(selectedReg?.catechesisYear || "PRIMER_AÑO")
  const [editAttendanceDay, setEditAttendanceDay] = useState(selectedReg?.attendanceDay || "SABADO")
  const [editGender, setEditGender] = useState(selectedReg?.sexo || "M")
  const [editPaymentMethod, setEditPaymentMethod] = useState(selectedReg?.lastPaymentMethod || "NONE")
  const [editAmountPaid, setEditAmountPaid] = useState<number>(selectedReg?.amountPaid || 0)
  
  // Estados para Cámara
  const [showCamera, setShowCamera] = useState(false)
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget>("photo")
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null)
  
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { toast } = useToast()
  const db = useFirestore()
  const { user } = useUser()

  const compressImage = (source: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new (window as any).Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 1024;
        let width = img.width;
        let height = img.height;
        if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
        else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = source;
    });
  };

  const startCamera = async (target: CaptureTarget, deviceId?: string) => {
    setCaptureTarget(target)
    try {
      if (currentStream) currentStream.getTracks().forEach(track => track.stop());
      const constraints = {
        video: { 
          deviceId: deviceId ? { exact: deviceId } : undefined, 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: deviceId ? undefined : "environment"
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setCurrentStream(stream)
      const availableDevices = await navigator.mediaDevices.enumerateDevices()
      setDevices(availableDevices.filter(d => d.kind === 'videoinput'))
      setShowCamera(true)
    } catch (error) {
      toast({ variant: 'destructive', title: 'Acceso a cámara denegado' })
    }
  }

  const stopCamera = () => {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      setCurrentStream(null)
      setShowCamera(false)
    }
  }

  const takePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
      const optimized = await compressImage(dataUrl);
      
      if (captureTarget === "photo") setEditPhotoPreview(optimized);
      else if (captureTarget === "baptism") setEditBaptismPreview(optimized);
      else if (captureTarget === "paymentProof") setEditPaymentProofPreview(optimized);
      
      stopCamera()
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: CaptureTarget) => {
    const file = e.target.files?.[0]
    if (file) {
      const objectUrl = URL.createObjectURL(file)
      try {
        const optimized = await compressImage(objectUrl)
        if (target === "photo") setEditPhotoPreview(optimized);
        else if (target === "baptism") setEditBaptismPreview(optimized);
        else if (target === "paymentProof") setEditPaymentProofPreview(optimized);
      } catch (err) {
        console.error("Error al procesar imagen:", err)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
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

  const handleEditRegistration = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !selectedReg || isSubmitting) return
    setIsSubmitting(true)

    const catechistName = profile ? `${profile.firstName} ${profile.lastName}` : "Administrador"
    const formData = new FormData(e.currentTarget)
    const getVal = (name: string) => (formData.get(name) as string || "").trim();

    const regCostLimit = editCatechesisYear === "ADULTOS" ? 50000 : 35000;

    const updateData: any = {
      fullName: getVal("fullName").toUpperCase(),
      ciNumber: getVal("ciNumber"),
      phone: getVal("phone"),
      birthDate: getVal("birthDate"),
      catechesisYear: editCatechesisYear,
      attendanceDay: editAttendanceDay,
      sexo: editGender,
      lastPaymentMethod: editPaymentMethod === "NONE" ? null : editPaymentMethod,
      updatedAt: serverTimestamp()
    }

    if (editPaymentMethod === "EFECTIVO") {
      const amt = Number(editAmountPaid);
      updateData.amountPaid = amt;
      updateData.paymentStatus = amt >= regCostLimit ? "PAGADO" : (amt > 0 ? "PARCIAL" : "PENDIENTE");
      updateData.status = "INSCRITO";
    } else if (editPaymentMethod === "NONE") {
      updateData.amountPaid = 0;
      updateData.paymentStatus = "PENDIENTE";
      updateData.status = "POR_VALIDAR";
    } else {
      updateData.amountPaid = Number(editAmountPaid);
      updateData.paymentStatus = updateData.amountPaid >= regCostLimit ? "PAGADO" : (updateData.amountPaid > 0 ? "PARCIAL" : "PENDIENTE");
    }

    if (editPhotoPreview) updateData.photoUrl = editPhotoPreview;
    if (editBaptismPreview) updateData.baptismCertificatePhotoUrl = editBaptismPreview;
    if (editPaymentProofPreview) updateData.paymentProofUrl = editPaymentProofPreview;

    const regRef = doc(db, "confirmations", selectedReg.id);

    updateDoc(regRef, updateData)
      .then(() => {
        addDoc(collection(db, "audit_logs"), {
          userId: user?.uid || "unknown",
          userName: catechistName,
          action: "Editar Ficha",
          module: "inscripcion",
          details: `Se actualizaron los datos de la ficha de: ${updateData.fullName}`,
          timestamp: serverTimestamp()
        }).catch(() => {});
        toast({ title: "Registro Actualizado" })
        onSaveSuccess()
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: regRef.path, operation: 'update', requestResourceData: updateData }));
      })
      .finally(() => setIsSubmitting(false))
  }

  const ImageUploadBox = ({ title, preview, target }: { title: string, preview: string | null, target: CaptureTarget }) => (
    <div className="space-y-2">
      <Label className="text-[10px] font-black uppercase text-slate-400">{title}</Label>
      <div className="relative h-48 w-full rounded-2xl border-2 border-dashed flex items-center justify-center bg-slate-50 overflow-hidden shadow-inner group">
        {preview ? (
          <img src={preview} className="h-full w-full object-cover" />
        ) : (
          <div className="text-center space-y-1">
            <ImageIcon className="h-8 w-8 text-slate-200 mx-auto" />
            <p className="text-[8px] text-slate-300 font-bold uppercase">Sin imagen</p>
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 bg-white/90 backdrop-blur-sm p-2 flex justify-center gap-3 border-t">
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            className="h-8 text-[9px] font-black uppercase gap-1.5 hover:bg-primary/10 hover:text-primary transition-colors"
            onClick={() => startCamera(target)}
          >
            <Camera className="h-3.5 w-3.5" /> CÁMARA
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            className="h-8 text-[9px] font-black uppercase gap-1.5 hover:bg-accent/10 hover:text-accent transition-colors"
            onClick={() => { setCaptureTarget(target); fileInputRef.current?.click(); }}
          >
            <ImageIcon className="h-3.5 w-3.5" /> GALERÍA
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <form onSubmit={handleEditRegistration} className="flex-1 overflow-hidden flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-6 bg-white space-y-8 pb-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ImageUploadBox title="Foto Perfil" preview={editPhotoPreview} target="photo" />
            <ImageUploadBox title="Cert. Bautismo" preview={editBaptismPreview} target="baptism" />
            <ImageUploadBox title="Comp. Pago" preview={editPaymentProofPreview} target="paymentProof" />
          </div>

          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, captureTarget)} />

          <div className="grid gap-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase">Nombre Completo</Label><Input name="fullName" defaultValue={selectedReg?.fullName} className="h-11 rounded-xl uppercase font-black" /></div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Sexo</Label>
                <Select value={editGender} onValueChange={setEditGender}>
                  <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Femenino</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase">C.I. N°</Label><Input name="ciNumber" defaultValue={selectedReg?.ciNumber} className="h-11 rounded-xl bg-white" /></div>
              <div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase">Celular</Label><Input name="phone" defaultValue={selectedReg?.phone} className="h-11 rounded-xl bg-white" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase">Nivel</Label>
                <Select value={editCatechesisYear} onValueChange={setEditCatechesisYear}>
                  <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="PRIMER_AÑO">1° Año</SelectItem><SelectItem value="SEGUNDO_AÑO">2° Año</SelectItem><SelectItem value="ADULTOS">Adultos</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase">Día</Label>
                <Select value={editAttendanceDay} onValueChange={setEditAttendanceDay}>
                  <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="SABADO">Sábados</SelectItem><SelectItem value="DOMINGO">Domingos</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase">Forma de Pago</Label>
                <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}>
                  <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                    <SelectItem value="NONE">Pendiente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase">Recaudado (Gs)</Label>
                <Input type="number" value={editAmountPaid} onChange={(e) => setEditAmountPaid(Number(e.target.value))} className="h-11 rounded-xl bg-white font-black text-primary" />
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <Dialog open={showCamera} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-[500px] w-[95vw] p-0 overflow-hidden rounded-[2.5rem] flex flex-col max-h-[90vh] border-none shadow-2xl">
          <DialogHeader className="p-4 bg-primary text-white shrink-0">
            <DialogTitle className="text-sm font-black uppercase tracking-widest text-center">Capturar Foto</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden min-h-0">
            <video 
              ref={onVideoRef} 
              autoPlay 
              muted 
              playsInline 
              className="max-h-full w-full object-contain" 
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <DialogFooter className="p-6 bg-slate-50 flex flex-col gap-4 shrink-0 border-t">
            {devices.length > 1 && (
              <Select value={selectedDeviceId} onValueChange={(val) => { setSelectedDeviceId(val); startCamera(captureTarget, val); }}>
                <SelectTrigger className="h-10 rounded-xl bg-white text-xs border-slate-200"><SelectValue placeholder="Cambiar Cámara" /></SelectTrigger>
                <SelectContent>{devices.map((d) => (<SelectItem key={d.deviceId} value={d.deviceId} className="text-xs">{d.label || `Cámara ${d.deviceId.slice(0,5)}`}</SelectItem>))}</SelectContent>
              </Select>
            )}
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1 h-14 rounded-2xl font-black text-xs uppercase" onClick={stopCamera}>CANCELAR</Button>
              <Button type="button" className="flex-1 h-14 bg-primary text-white font-black text-xs uppercase shadow-xl active:scale-95 transition-transform" onClick={takePhoto}>TOMAR FOTO</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3 shrink-0">
        <Button type="button" variant="outline" className="flex-1 h-14 rounded-2xl font-black uppercase text-xs" onClick={onClose}>Cancelar</Button>
        <Button type="submit" className="flex-1 h-14 bg-slate-900 text-white font-black uppercase text-xs shadow-xl active:scale-95 transition-transform" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4 mr-2" />} Guardar Ficha</Button>
      </DialogFooter>
    </form>
  )
}

export default function RegistrationsListPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterSex, setFilterSex] = useState("all")
  const [filterYear, setFilterYear] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterOrigin, setFilterOrigin] = useState("all")
  const [filterDay, setFilterDay] = useState("all")

  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isValidationOpen, setIsValidationOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [valAmount, setValAmount] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [zoomScale, setZoomScale] = useState(1)
  
  const [isPhotoViewOpen, setIsPhotoViewOpen] = useState(false)
  const [viewPhotoUrl, setViewPhotoUrl] = useState<string | null>(null)
  const [photoZoom, setPhotoZoom] = useState(1)

  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()

  useEffect(() => { setMounted(true) }, [])

  const userProfileRef = useMemoFirebase(() => db && user?.uid ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc(userProfileRef)

  const registrationsQuery = useMemoFirebase(() => db ? query(collection(db, "confirmations"), orderBy("createdAt", "desc"), limit(200)) : null, [db])
  const { data: registrations, loading: loadingRegs } = useCollection(registrationsQuery)

  const findUserById = (uid: string) => {
    return allUsers?.find(u => u.id === uid)
  }

  const allUsersQuery = useMemoFirebase(() => db ? collection(db, "users") : null, [db])
  const { data: allUsers } = useCollection(allUsersQuery)

  const treasuryRef = useMemoFirebase(() => db ? doc(db, "settings", "treasury") : null, [db])

  const stats = useMemo(() => {
    if (!registrations) return { total: 0, males: 0, females: 0 }
    const active = registrations.filter(r => !r.isArchived)
    return {
      total: active.length,
      males: active.filter(r => r.sexo === "M").length,
      females: active.filter(r => r.sexo === "F").length
    }
  }, [registrations])

  const filteredRegistrations = useMemo(() => {
    if (!registrations) return []
    return registrations.filter(r => {
      if (r.isArchived) return false;
      
      const matchesSearch = !searchTerm || r.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || r.ciNumber?.includes(searchTerm);
      const matchesSex = filterSex === "all" || r.sexo === filterSex;
      const matchesYear = filterYear === "all" || r.catechesisYear === filterYear;
      const matchesStatus = filterStatus === "all" || r.status === filterStatus;
      
      const isPublicOrigin = r.userId === "public_registration";
      const matchesOrigin = filterOrigin === "all" || 
        (filterOrigin === "public" && isPublicOrigin) || 
        (filterOrigin === "manual" && !isPublicOrigin);
        
      const matchesDay = filterDay === "all" || r.attendanceDay === filterDay;

      return matchesSearch && matchesSex && matchesYear && matchesStatus && matchesOrigin && matchesDay;
    })
  }, [registrations, searchTerm, filterSex, filterYear, filterStatus, filterOrigin, filterDay])

  const resetFilters = () => {
    setSearchTerm("")
    setFilterSex("all")
    setFilterYear("all")
    setFilterStatus("all")
    setFilterOrigin("all")
    setFilterDay("all")
  }

  const handleOpenValidation = (reg: any) => {
    setSelectedReg(reg)
    const pending = (reg.registrationCost || (reg.catechesisYear === "ADULTOS" ? 50000 : 35000)) - (reg.amountPaid || 0)
    setValAmount(pending > 0 ? pending : 0)
    setIsValidationOpen(true)
  }

  const handleConfirmValidation = async () => {
    if (!db || !selectedReg || !treasuryRef || isProcessing) return
    setIsProcessing(true)
    const regRef = doc(db, "confirmations", selectedReg.id)
    const catechistName = profile ? `${profile.firstName} ${profile.lastName}` : "Validador"
    try {
      await runTransaction(db, async (transaction) => {
        const treasurySnap = await transaction.get(treasuryRef);
        const nextReceipt = treasurySnap.exists() ? (treasurySnap.data()?.nextReceiptNumber || 1) : 1;
        const formattedReceipt = `001-001-${String(nextReceipt).padStart(7, '0')}`;
        
        const newPaid = (selectedReg.amountPaid || 0) + valAmount;
        const regCost = selectedReg.registrationCost || (selectedReg.catechesisYear === "ADULTOS" ? 50000 : 35000);
        
        const updatePayload = { 
          amountPaid: newPaid, 
          paymentStatus: newPaid >= regCost ? "PAGADO" : "PARCIAL", 
          status: "INSCRITO",
          validatedBy: catechistName,
          receiptNumber: formattedReceipt,
          lastPaymentDate: serverTimestamp(),
          lastPaymentMethod: "TRANSFERENCIA"
        };

        transaction.update(regRef, updatePayload);
        transaction.update(treasuryRef, { nextReceiptNumber: nextReceipt + 1 });
        
        transaction.set(doc(collection(db, "audit_logs")), {
          userId: user?.uid || "unknown",
          userName: catechistName,
          action: "Validación de Transferencia",
          module: "pagos",
          details: `Validado cobro de ${valAmount.toLocaleString('es-PY')} Gs. a ${selectedReg.fullName}. Recibo: ${formattedReceipt}`,
          timestamp: serverTimestamp()
        });

        setSelectedReg({ ...selectedReg, ...updatePayload });
      });
      toast({ title: "Validación Exitosa" })
      setIsValidationOpen(false)
      setIsReceiptOpen(true)
    } catch (e) { toast({ variant: "destructive", title: "Error al validar" }) }
    finally { setIsProcessing(false) }
  }

  const handleDelete = async () => {
    if (!db || !selectedReg) return
    try {
      await deleteDoc(doc(db, "confirmations", selectedReg.id))
      toast({ title: "Registro eliminado" })
      setIsDeleteDialogOpen(false)
    } catch (e) { toast({ variant: "destructive", title: "Error" }) }
  }

  const handleDownloadProof = () => {
    if (!selectedReg?.paymentProofUrl) return;
    const link = document.createElement("a");
    link.href = selectedReg.paymentProofUrl;
    link.download = `comprobante-${selectedReg.ciNumber || selectedReg.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const openEnlargedPhoto = (url: string) => {
    setViewPhotoUrl(url);
    setIsPhotoViewOpen(true);
    setPhotoZoom(1);
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Lista de Confirmandos</h1>
          <p className="text-muted-foreground">Listado general de postulantes del ciclo 2026.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl h-11 font-bold gap-2" onClick={() => {
            const csv = filteredRegistrations.map(r => `${r.fullName},${r.ciNumber},${r.catechesisYear}`).join("\n");
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'confirmandos.csv'; a.click();
          }}><Download className="h-4 w-4" /> Exportar</Button>
          <Button asChild className="bg-primary hover:bg-primary/90 rounded-xl h-11 font-bold px-6 shadow-lg shadow-primary/20"><a href="/dashboard/registration">Nueva Ficha</a></Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-primary overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4 space-y-0">
            <CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Inscritos</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-slate-900">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-blue-500 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4 space-y-0">
            <CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Masculinos</CardTitle>
            <Mars className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-slate-900">{stats.males}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-pink-500 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4 space-y-0">
            <CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Femeninos</CardTitle>
            <Venus className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-slate-900">{stats.females}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b p-6 space-y-6">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Buscador Principal</Label>
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Buscar por Nombre o C.I..." 
                className="pl-10 h-12 rounded-xl bg-white border-slate-200 shadow-sm w-full" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
          </div>
          
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Sexo</Label>
              <Select value={filterSex} onValueChange={setFilterSex}>
                <SelectTrigger className="w-[130px] h-11 rounded-xl bg-white shadow-sm"><SelectValue placeholder="Sexo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Sexos</SelectItem>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Femenino</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Nivel</Label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-[150px] h-11 rounded-xl bg-white shadow-sm"><SelectValue placeholder="Nivel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Niveles</SelectItem>
                  <SelectItem value="PRIMER_AÑO">1° Año</SelectItem>
                  <SelectItem value="SEGUNDO_AÑO">2° Año</SelectItem>
                  <SelectItem value="ADULTOS">Adultos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Estado</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px] h-11 rounded-xl bg-white shadow-sm"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Estados</SelectItem>
                  <SelectItem value="INSCRITO">Inscrito</SelectItem>
                  <SelectItem value="POR_VALIDAR">Por Validar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Origen</Label>
              <Select value={filterOrigin} onValueChange={setFilterOrigin}>
                <SelectTrigger className="w-[130px] h-11 rounded-xl bg-white shadow-sm"><SelectValue placeholder="Origen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Orígenes</SelectItem>
                  <SelectItem value="public">Público</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Horario</Label>
              <Select value={filterDay} onValueChange={setFilterDay}>
                <SelectTrigger className="w-[130px] h-11 rounded-xl bg-white shadow-sm"><SelectValue placeholder="Horario" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Horarios</SelectItem>
                  <SelectItem value="SABADO">Sábados</SelectItem>
                  <SelectItem value="DOMINGO">Domingos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl hover:bg-slate-200" onClick={resetFilters} title="Limpiar Filtros">
              <FilterX className="h-4 w-4 text-slate-500" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingRegs ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="pl-8 font-bold">Confirmando</TableHead>
                  <TableHead className="font-bold">Origen</TableHead>
                  <TableHead className="font-bold">Año / Nivel</TableHead>
                  <TableHead className="font-bold">Forma Pago</TableHead>
                  <TableHead className="font-bold">Estado</TableHead>
                  <TableHead className="font-bold">Fecha Insc.</TableHead>
                  <TableHead className="text-right pr-8 font-bold">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg) => {
                  const creator = findUserById(reg.userId);
                  const isManual = reg.userId !== "public_registration";
                  const hasProof = !!reg.paymentProofUrl;
                  const isEfectivo = reg.lastPaymentMethod === "EFECTIVO" || reg.paymentMethod === "EFECTIVO";
                  
                  return (
                    <TableRow key={reg.id} className="h-20 hover:bg-slate-50/50 transition-colors">
                      <TableCell className="pl-8">
                        <div className="flex items-center gap-4">
                          <Avatar 
                            className="h-10 w-10 border shadow-sm cursor-pointer hover:scale-110 transition-transform"
                            onClick={() => reg.photoUrl && openEnlargedPhoto(reg.photoUrl)}
                          >
                            <AvatarImage src={reg.photoUrl} className="object-cover" />
                            <AvatarFallback><User /></AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-slate-900 uppercase truncate max-w-[200px]">{reg.fullName}</span>
                            <span className="text-[10px] font-black text-primary leading-tight">{reg.ciNumber}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{reg.phone}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <Badge variant="secondary" className={cn("text-[9px] uppercase font-black w-fit", isManual ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700")}>{isManual ? "MANUAL" : "PÚBLICO"}</Badge>
                          {isManual && creator && <span className="text-[9px] text-slate-400 font-bold uppercase mt-1 ml-1">{creator.firstName}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <Badge variant="outline" className="text-[9px] uppercase">{reg.catechesisYear?.replace("_", " ")}</Badge>
                          <span className="text-[9px] text-slate-400 font-bold uppercase mt-1 ml-1">{reg.attendanceDay === "SABADO" ? "Sábados" : "Domingos"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-2">
                            <Wallet className="h-3 w-3 text-slate-400" />
                            <span className={cn(
                              "text-[10px] font-bold uppercase",
                              hasProof ? "text-blue-600" : (isEfectivo ? "text-green-600" : "text-slate-600")
                            )}>
                              {hasProof ? "TRANSFERENCIA" : (isEfectivo ? "EFECTIVO" : "NINGUNA")}
                            </span>
                          </div>
                          {(reg.amountPaid > 0 || isEfectivo) && (
                            <span className="text-[9px] font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded-md">
                              {(reg.amountPaid || 0).toLocaleString('es-PY')} Gs.
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[9px] font-bold", reg.status === "POR_VALIDAR" ? "bg-orange-50 text-orange-600 border-orange-200" : "bg-green-50 text-green-600 border-green-200")}>{reg.status || "PENDIENTE"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-[10px]">
                          <span className="font-bold text-slate-700">{reg.createdAt?.toDate ? reg.createdAt.toDate().toLocaleDateString('es-PY') : 'Reciente'}</span>
                          <span className="text-slate-400">{reg.createdAt?.toDate ? reg.createdAt.toDate().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400"
                            onClick={() => { setSelectedReg(reg); setIsDetailsDialogOpen(true); }}
                            title="Ver Ficha"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {reg.status === "POR_VALIDAR" && hasProof && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] font-black bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200" onClick={() => handleOpenValidation(reg)}>VALIDAR</Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[180px] p-2 rounded-xl">
                              <DropdownMenuItem onClick={() => { setSelectedReg(reg); setIsEditDialogOpen(true); }} className="h-10 rounded-lg gap-2"><Edit className="h-4 w-4" /> Editar Ficha</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedReg(reg); setIsDeleteDialogOpen(true); }} className="h-10 rounded-lg gap-2 text-destructive"><Trash2 className="h-4 w-4" /> Eliminar</DropdownMenuItem>
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

      {/* DIALOGO DE DETALLE (VER FICHA) */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[850px] p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] h-[90vh] flex flex-col">
          <DialogHeader className="p-8 bg-primary text-white shrink-0 relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Church className="h-32 w-32" />
            </div>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar 
                    className="h-24 w-24 border-4 border-white/20 shadow-2xl cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => selectedReg?.photoUrl && openEnlargedPhoto(selectedReg.photoUrl)}
                  >
                    <AvatarImage src={selectedReg?.photoUrl} className="object-cover" />
                    <AvatarFallback className="bg-white/10 text-white"><User className="h-12 w-12" /></AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 -right-2 bg-white text-primary p-1.5 rounded-full shadow-lg">
                    {selectedReg?.sexo === 'M' ? <Mars className="h-4 w-4" /> : <Venus className="h-4 w-4" />}
                  </div>
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-3xl uppercase font-black tracking-tight leading-none">{selectedReg?.fullName}</DialogTitle>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-white/20 text-white border-none uppercase text-[10px] font-black tracking-widest">{selectedReg?.catechesisYear?.replace('_', ' ')}</Badge>
                    <span className="h-1 w-1 rounded-full bg-white/40"></span>
                    <p className="text-white/70 font-bold text-sm uppercase tracking-tighter">C.I. {selectedReg?.ciNumber}</p>
                  </div>
                </div>
              </div>
              <div className="hidden md:flex flex-col items-end gap-2">
                <Badge variant="outline" className="border-white/30 text-white bg-white/5 h-8 px-4 rounded-xl">
                  {selectedReg?.status}
                </Badge>
                <p className="text-[10px] font-bold text-white/50 uppercase">Ciclo Lectivo 2026</p>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 bg-slate-50/50">
            <div className="p-8 space-y-8 pb-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-none shadow-sm bg-white rounded-3xl p-6 space-y-4">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                    <User className="h-3.5 w-3.5" /> Personales
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-[9px] font-bold text-slate-400 uppercase">Edad</Label>
                      <p className="text-sm font-bold text-slate-900">{selectedReg?.age} años</p>
                    </div>
                    <div>
                      <Label className="text-[9px] font-bold text-slate-400 uppercase">Nacimiento</Label>
                      <p className="text-sm font-bold text-slate-900">{selectedReg?.birthDate}</p>
                    </div>
                  </div>
                </Card>

                <Card className="border-none shadow-sm bg-white rounded-3xl p-6 space-y-4">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" /> Contacto
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-[9px] font-bold text-slate-400 uppercase">Celular</Label>
                      <p className="text-sm font-bold text-slate-900">{selectedReg?.phone}</p>
                    </div>
                    <div>
                      <Label className="text-[9px] font-bold text-slate-400 uppercase">Horario</Label>
                      <p className="text-sm font-bold text-slate-900">{selectedReg?.attendanceDay === 'SABADO' ? 'Sábados' : 'Domingos'}</p>
                    </div>
                  </div>
                </Card>

                <Card className="border-none shadow-sm bg-white rounded-3xl p-6 space-y-4">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                    <Wallet className="h-3.5 w-3.5" /> Tesorería
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-[9px] font-bold text-slate-400 uppercase">Estado Pago</Label>
                      <Badge variant="outline" className={cn("text-[9px] block w-fit mt-1", selectedReg?.paymentStatus === 'PAGADO' ? "bg-green-50 text-green-600 border-green-200" : "bg-amber-50 text-amber-600 border-amber-200")}>
                        {selectedReg?.paymentStatus}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-[9px] font-bold text-slate-400 uppercase">Recaudado</Label>
                      <p className="text-sm font-black text-slate-900">{selectedReg?.amountPaid?.toLocaleString('es-PY')} Gs.</p>
                    </div>
                  </div>
                </Card>
              </div>

              <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                <div className="p-6 bg-slate-50/50 border-b flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Familia / Responsables</span>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3 border-r pr-8">
                    <Label className="text-[9px] font-black text-slate-400 uppercase border-b pb-1 block">Madre</Label>
                    <p className="text-sm font-bold text-slate-900">{selectedReg?.motherName || 'No registrado'}</p>
                    {selectedReg?.motherPhone && (
                      <Button variant="ghost" className="h-8 p-0 text-primary hover:bg-transparent gap-2" asChild>
                        <a href={`https://wa.me/${selectedReg.motherPhone.replace(/[^0-9]/g, '')}`} target="_blank">
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span className="text-xs font-bold">{selectedReg.motherPhone}</span>
                        </a>
                      </Button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[9px] font-black text-slate-400 uppercase border-b pb-1 block">Padre</Label>
                    <p className="text-sm font-bold text-slate-900">{selectedReg?.fatherName || 'No registrado'}</p>
                    {selectedReg?.fatherPhone && (
                      <Button variant="ghost" className="h-8 p-0 text-primary hover:bg-transparent gap-2" asChild>
                        <a href={`https://wa.me/${selectedReg.fatherPhone.replace(/[^0-9]/g, '')}`} target="_blank">
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span className="text-xs font-bold">{selectedReg.fatherPhone}</span>
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                  <div className="p-6 bg-slate-50/50 border-b flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vida Sacramental</span>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", selectedReg?.hasBaptism ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                          {selectedReg?.hasBaptism ? <CheckCircle2 className="h-5 w-5" /> : <X className="h-5 w-5" />}
                        </div>
                        <span className="text-xs font-bold text-slate-700">Sacramento del Bautismo</span>
                      </div>
                    </div>
                    {selectedReg?.hasBaptism && (
                      <div className="grid grid-cols-3 gap-2 px-2">
                        <div><Label className="text-[8px] font-bold text-slate-400 uppercase">Libro</Label><p className="text-xs font-bold">{selectedReg.baptismBook || '-'}</p></div>
                        <div><Label className="text-[8px] font-bold text-slate-400 uppercase">Folio</Label><p className="text-xs font-bold">{selectedReg.baptismFolio || '-'}</p></div>
                        <div><Label className="text-[8px] font-bold text-slate-400 uppercase">Parroquia</Label><p className="text-xs font-bold truncate">{selectedReg.baptismParish || '-'}</p></div>
                      </div>
                    )}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", selectedReg?.hasFirstCommunion ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                          {selectedReg?.hasFirstCommunion ? <CheckCircle2 className="h-5 w-5" /> : <X className="h-5 w-5" />}
                        </div>
                        <span className="text-xs font-bold text-slate-700">Primera Comunión</span>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                  <div className="p-6 bg-slate-50/50 border-b flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Documentos Adjuntos</span>
                  </div>
                  <div className="p-6 grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[9px] font-black text-slate-400 uppercase">Bautismo</Label>
                      <div 
                        className="relative aspect-[3/4] rounded-2xl overflow-hidden border shadow-inner bg-slate-100 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                        onClick={() => selectedReg?.baptismCertificatePhotoUrl && openEnlargedPhoto(selectedReg.baptismCertificatePhotoUrl)}
                      >
                        {selectedReg?.baptismCertificatePhotoUrl ? (
                          <img src={selectedReg.baptismCertificatePhotoUrl} className="object-cover w-full h-full" />
                        ) : <div className="text-[10px] text-slate-400 italic">No adjunto</div>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] font-black text-slate-400 uppercase">Comprobante Pago</Label>
                      <div 
                        className="relative aspect-[3/4] rounded-2xl overflow-hidden border shadow-inner bg-slate-100 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                        onClick={() => selectedReg?.paymentProofUrl && openEnlargedPhoto(selectedReg.paymentProofUrl)}
                      >
                        {selectedReg?.paymentProofUrl ? (
                          <img src={selectedReg.paymentProofUrl} className="object-cover w-full h-full" />
                        ) : <div className="text-[10px] text-slate-400 italic">No adjunto</div>}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3 shrink-0">
            <Button variant="outline" className="flex-1 h-14 rounded-2xl font-black gap-2 border-slate-200" onClick={() => setIsDetailsDialogOpen(false)}>Cerrar</Button>
            <Button className="flex-1 h-14 bg-primary text-white rounded-2xl font-black gap-3 shadow-xl active:scale-95 transition-transform" onClick={() => window.print()}>
              <Printer className="h-5 w-5" /> IMPRIMIR FICHA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOGO PARA AMPLIAR FOTO (LIGHTBOX) */}
      <Dialog open={isPhotoViewOpen} onOpenChange={(open) => { setIsPhotoViewOpen(open); if(!open) setPhotoZoom(1); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl p-0 bg-transparent border-none shadow-none flex items-center justify-center overflow-visible">
          <div className="relative flex flex-col items-center w-full animate-in zoom-in-95 duration-300">
            <Button 
              variant="secondary" 
              size="icon" 
              className="absolute -top-14 right-0 rounded-full text-white bg-white/20 hover:bg-white/40 border border-white/10 z-50 shadow-2xl" 
              onClick={() => setIsPhotoViewOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>
            
            <div className="absolute -bottom-16 flex items-center gap-3 bg-slate-900/90 backdrop-blur-xl p-2 px-4 rounded-2xl border border-white/10 shadow-2xl z-50">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/10" onClick={() => setPhotoZoom(prev => Math.max(0.25, prev - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
              <span className="text-[10px] font-black text-white uppercase w-14 text-center">{Math.round(photoZoom * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/10" onClick={() => setPhotoZoom(prev => Math.min(4, prev + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
              <Separator orientation="vertical" className="h-4 bg-white/20 mx-1" />
              <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/10" onClick={() => setPhotoZoom(1)}><Maximize2 className="h-4 w-4" /></Button>
            </div>

            <div className="w-full bg-slate-950/20 backdrop-blur-md rounded-3xl p-2 border border-white/10 shadow-2xl overflow-hidden">
              <ScrollArea className="max-h-[80vh] w-full rounded-2xl">
                <div className="flex items-center justify-center p-4 min-h-[400px]">
                  <img 
                    src={viewPhotoUrl || ""} 
                    className="rounded-xl shadow-2xl transition-all duration-300 select-none h-auto max-w-full" 
                    style={{ transform: `scale(${photoZoom})` }} 
                    alt="Foto ampliada" 
                  />
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOGO DE VALIDACIÓN */}
      <Dialog open={isValidationOpen} onOpenChange={setIsValidationOpen}>
        <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl h-[90vh] flex flex-col">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Laboratorio de Validación</DialogTitle>
                <DialogDescription className="text-slate-400">Procesando pago de {selectedReg?.fullName}</DialogDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="icon" className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border-none" onClick={handleDownloadProof} title="Descargar Comprobante"><Download className="h-4 w-4" /></Button>
                <Button variant="secondary" size="icon" className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border-none" onClick={() => setZoomScale(prev => prev === 1 ? 2 : 1)} title="Zoom"><Maximize2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            <div className="flex-1 bg-slate-100 flex items-center justify-center p-4 relative overflow-auto">
              {selectedReg?.paymentProofUrl ? (
                <img src={selectedReg.paymentProofUrl} className="max-w-full h-auto rounded-xl shadow-lg transition-transform duration-300 origin-center" style={{ transform: `scale(${zoomScale})` }} />
              ) : <div className="text-slate-400 italic">Sin comprobante</div>}
            </div>
            <div className="w-full md:w-[350px] bg-white border-l p-8 space-y-8 overflow-y-auto">
              <div className="space-y-4">
                <Label className="text-[10px] font-black text-primary uppercase tracking-widest">Información del Postulante</Label>
                <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
                  <p className="text-sm font-black text-slate-900">{selectedReg?.fullName}</p>
                  <p className="text-xs font-bold text-slate-500 uppercase">C.I. {selectedReg?.ciNumber}</p>
                  <p className="text-[10px] text-slate-400">{selectedReg?.catechesisYear?.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="space-y-4">
                <Label className="font-bold">Monto a Confirmar (Gs)</Label>
                <Input type="number" className="h-14 text-2xl font-black rounded-2xl bg-slate-50 border-primary/20" value={valAmount} onChange={(e) => setValAmount(Number(e.target.value))} />
                <p className="text-[10px] text-slate-400 italic">Verifica que el monto coincida exactamente con la imagen adjunta.</p>
              </div>
              <div className="pt-4">
                <Button className="w-full h-14 rounded-2xl bg-green-600 hover:bg-green-700 font-bold text-lg gap-2" onClick={handleConfirmValidation} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="animate-spin" /> : <><CheckCircle2 className="h-5 w-5" /> VALIDAR Y GENERAR RECIBO</>}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* RECIBO POST-VALIDACIÓN */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden bg-white rounded-3xl h-[90vh] flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex justify-center">
            <div className="bg-white shadow-xl origin-top scale-[0.75] sm:scale-[0.85]">
              <ReceiptContent reg={selectedReg} />
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-12 rounded-xl font-bold" onClick={() => setIsReceiptOpen(false)}>CERRAR</Button>
            <Button className="h-12 rounded-xl bg-primary text-white font-bold gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" /> IMPRIMIR</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOGO DE EDICIÓN */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[95vh] p-0 overflow-hidden flex flex-col rounded-[2.5rem] border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5" /> Editar Ficha del Confirmando</DialogTitle>
          </DialogHeader>
          <EditRegistrationForm 
            selectedReg={selectedReg} 
            profile={profile} 
            onClose={() => setIsEditDialogOpen(false)} 
            onSaveSuccess={() => { setIsEditDialogOpen(false); }} 
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl"><AlertDialogHeader><AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer. Se borrarán todos los datos del confirmando.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-white" onClick={handleDelete}>Confirmar Eliminación</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ReceiptContent({ reg }: { reg: any }) {
  if (!reg) return null;
  const date = reg.lastPaymentDate?.toDate ? reg.lastPaymentDate.toDate() : new Date();
  const dateStr = date.toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' });
  
  return (
    <div className="p-10 bg-white text-black font-serif border-[4px] border-black w-[800px] h-auto">
      <div className="flex gap-4 mb-8">
        <div className="flex-1 border-[2px] border-black p-4 flex items-center justify-between">
          <div className="relative h-16 w-16"><Image src="/logo.png" fill alt="Logo" className="object-contain" /></div>
          <div className="text-right">
            <p className="text-[11px] font-black tracking-tight leading-none">SANTUARIO NACIONAL</p>
            <p className="text-[9px] font-bold leading-tight uppercase">NSPS</p>
          </div>
        </div>
        <div className="w-[220px] flex flex-col gap-2">
          <div className="border-[2px] border-black p-2 text-center h-[60%] flex flex-col justify-center">
            <p className="text-[10px] font-black uppercase">GS.</p>
            <p className="text-2xl font-black">{(reg.amountPaid || 0).toLocaleString('es-PY')}</p>
          </div>
          <div className="border-[2px] border-black p-1 text-center flex-1">
            <p className="text-[8px] font-bold uppercase leading-none">RECIBO N°</p>
            <p className="text-xs font-black font-mono leading-none mt-1">{reg.receiptNumber || '---'}</p>
          </div>
        </div>
      </div>
      <div className="text-center mb-10"><h2 className="text-4xl font-black italic tracking-[0.2em] border-b-[3px] border-black inline-block px-16 pb-1">RECIBO</h2></div>
      <div className="space-y-8 text-[15px]">
        <div className="flex items-baseline gap-2"><span className="font-bold whitespace-nowrap">Recibí de:</span><span className="flex-1 border-b border-dotted border-black px-2 uppercase font-black tracking-wide">{reg.fullName}</span></div>
        <div className="flex items-baseline gap-2"><span className="font-bold whitespace-nowrap">La cantidad de:</span><span className="flex-1 border-b border-dotted border-black px-2 italic font-medium">{(reg.amountPaid || 0).toLocaleString('es-PY')} Guaraníes</span></div>
        <div className="space-y-3"><span className="font-bold">En concepto de:</span><div className="border-[2px] border-black p-5 text-center font-black uppercase text-base tracking-wider">INSCRIPCIÓN CATEQUESIS - {reg.catechesisYear?.replace('_', ' ')}</div></div>
      </div>
      <div className="mt-16 space-y-12">
        <div><p className="italic border-b border-black inline-block pr-16 text-sm">Asunción, {dateStr}</p><p className="text-[9px] font-black mt-1 uppercase tracking-widest">(FIRMA Y ACLARACIÓN)</p></div>
        <div className="flex flex-col items-center">
          <div className="p-1 border border-slate-100 rounded-lg shadow-sm"><QRCodeCanvas value={`NSPS-RECIBO-${reg.receiptNumber}`} size={90} level="M" /></div>
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
