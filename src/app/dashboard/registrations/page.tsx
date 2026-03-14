
"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Search, 
  Loader2, 
  MoreHorizontal, 
  User, 
  LayoutList, 
  Users,
  UserCircle,
  UserPlus,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
  ImageIcon,
  Edit,
  Save,
  Phone,
  Calendar,
  ShieldCheck,
  BookOpen,
  Book,
  Camera,
  FlipHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Wallet,
  Globe,
  RefreshCcw,
  FilterX,
  Filter,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Banknote,
  ArrowRightLeft,
  FileText,
  Church,
  ChevronRight,
  Printer,
  CalendarDays,
  Contact,
  CreditCard,
  History,
  Check,
  Download
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, updateDoc, deleteDoc, serverTimestamp, addDoc, runTransaction, writeBatch, getDoc, query, orderBy, limit } from "firebase/firestore"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

type ViewMode = "LIST" | "GROUPS"
type CaptureTarget = "PHOTO" | "BAPTISM" | "PAY_PROOF"

function EditRegistrationForm({ 
  selectedReg, 
  profile, 
  onClose, 
  onSaveSuccess,
  startCameraAction 
}: { 
  selectedReg: any, 
  profile: any, 
  onClose: () => void, 
  onSaveSuccess: (updatedData: any) => void,
  startCameraAction: (target: CaptureTarget) => void
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
  
  const editPhotoInputRef = useRef<HTMLInputElement>(null)
  const editBaptismInputRef = useRef<HTMLInputElement>(null)
  const editPaymentProofInputRef = useRef<HTMLInputElement>(null)
  
  const { toast } = useToast()
  const db = useFirestore()
  const { user } = useUser()

  const isAdmin = profile?.role === "Administrador"

  const compressImage = (source: string, maxWidth = 1024, maxHeight = 1200): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new (window as any).Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
        if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = (e) => reject(e);
      img.src = source;
    });
  };

  const handleFileEdit = async (e: React.ChangeEvent<HTMLInputElement>, target: "photo" | "baptism" | "paymentProof") => {
    const file = e.target.files?.[0]
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      const setPreview = (val: string) => {
        if (target === "photo") setEditPhotoPreview(val);
        else if (target === "baptism") setEditBaptismPreview(val);
        else setEditPaymentProofPreview(val);
      };

      if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = () => setPreview(reader.result as string);
        reader.readAsDataURL(file);
        URL.revokeObjectURL(objectUrl);
        return;
      }

      try {
        const optimized = await compressImage(objectUrl);
        setPreview(optimized);
      } catch (err) {
        const reader = new FileReader();
        reader.onload = () => setPreview(reader.result as string);
        reader.readAsDataURL(file);
      } finally {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    }
  }

  const handleEditRegistration = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !selectedReg || isSubmitting) return
    setIsSubmitting(true)

    const catechistName = profile ? `${profile.firstName} ${profile.lastName}` : "Administrador"
    const formData = new FormData(e.currentTarget)
    const getVal = (name: string) => (formData.get(name) as string || "").trim();

    const updateData: any = {
      fullName: getVal("fullName").toUpperCase(),
      ciNumber: getVal("ciNumber"),
      phone: getVal("phone"),
      birthDate: getVal("birthDate"),
      motherName: getVal("motherName").toUpperCase(),
      motherPhone: getVal("motherPhone"),
      fatherName: getVal("fatherName").toUpperCase(),
      fatherPhone: getVal("fatherPhone"),
      catechesisYear: editCatechesisYear,
      attendanceDay: editAttendanceDay,
      sexo: editGender,
      lastPaymentMethod: editPaymentMethod === "NONE" ? null : editPaymentMethod,
      amountPaid: editPaymentMethod === "NONE" ? 0 : Number(editAmountPaid),
      updatedAt: serverTimestamp()
    }

    if (editPaymentMethod === "NONE") {
      updateData.amountPaid = 0;
      updateData.paymentStatus = "PENDIENTE";
      updateData.status = "POR_VALIDAR";
      updateData.receiptNumber = ""; 
    } else {
      const regCost = selectedReg.registrationCost || (editCatechesisYear === "ADULTOS" ? 50000 : 35000);
      updateData.paymentStatus = updateData.amountPaid >= regCost ? "PAGADO" : (updateData.amountPaid > 0 ? "PARCIAL" : "PENDIENTE");
      if (updateData.amountPaid > 0) {
        updateData.status = "INSCRITO";
      }
    }

    if (editPhotoPreview && editPhotoPreview !== selectedReg.photoUrl) updateData.photoUrl = editPhotoPreview;
    if (editBaptismPreview && editBaptismPreview !== selectedReg.baptismCertificatePhotoUrl) updateData.baptismCertificatePhotoUrl = editBaptismPreview;
    if (editPaymentProofPreview && editPaymentProofPreview !== selectedReg.paymentProofUrl) updateData.paymentProofUrl = editPaymentProofPreview;

    const regRef = doc(db, "confirmations", selectedReg.id);

    updateDoc(regRef, updateData)
      .then(() => {
        addDoc(collection(db, "audit_logs"), {
          userId: user?.uid || "unknown",
          userName: catechistName,
          action: "Editar Ficha",
          module: "inscripcion",
          details: `Se actualizaron los datos de la ficha de: ${updateData.fullName}.`,
          timestamp: serverTimestamp()
        }).catch(() => {});

        toast({ title: "Registro Actualizado" })
        const { updatedAt, ...localData } = updateData;
        onSaveSuccess({ ...localData, id: selectedReg.id, updatedAt: new Date().toISOString() })
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: regRef.path,
          operation: 'update',
          requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsSubmitting(false)
      })
  }

  const renderFilePreview = (preview: string | null) => {
    if (!preview) return null;
    if (preview.startsWith("data:application/pdf")) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-slate-100 gap-2">
          <FileText className="h-8 w-8 text-red-500" />
          <span className="text-[8px] font-bold uppercase text-slate-500">Documento PDF</span>
        </div>
      );
    }
    return <img src={preview} alt="Vista Previa" className="w-full h-full object-cover" />;
  };

  useEffect(() => {
    const handleCameraCapture = (e: any) => {
      const { target, dataUrl } = e.detail;
      if (target === "PHOTO") setEditPhotoPreview(dataUrl);
      else if (target === "BAPTISM") setEditBaptismPreview(dataUrl);
      else if (target === "PAY_PROOF") setEditPaymentProofPreview(dataUrl);
    };
    window.addEventListener('camera-capture-success', handleCameraCapture);
    return () => window.removeEventListener('camera-capture-success', handleCameraCapture);
  }, []);

  return (
    <form onSubmit={handleEditRegistration} className="flex-1 overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto p-6 bg-white space-y-10 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <Label className="text-[10px] font-black text-primary uppercase tracking-widest text-center block">Foto de Perfil</Label>
            <div className="flex flex-col items-center gap-4 p-4 border rounded-2xl bg-slate-50 border-dashed">
              <Avatar className="h-24 w-24 border-4 border-white shadow-md">
                <AvatarImage src={editPhotoPreview || undefined} className="object-cover" />
                <AvatarFallback className="bg-slate-100 text-slate-300">
                  {editPhotoPreview ? renderFilePreview(editPhotoPreview) : <User className="h-10 w-10" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex gap-2">
                <Button type="button" size="sm" className="rounded-xl h-8 gap-2 font-bold px-2 text-[10px]" onClick={() => startCameraAction("PHOTO")}>
                  <Camera className="h-3.5 w-3.5" /> Cámara
                </Button>
                <Button type="button" size="sm" variant="secondary" className="rounded-xl h-8 gap-2 font-bold px-2 text-[10px]" onClick={() => editPhotoInputRef.current?.click()}>
                  <ImageIcon className="h-3.5 w-3.5" /> Archivo
                </Button>
                <input type="file" ref={editPhotoInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileEdit(e, "photo")} />
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <Label className="text-[10px] font-black text-primary uppercase tracking-widest text-center block">Certificado Bautismo</Label>
            <div className="flex flex-col items-center gap-4 p-4 border rounded-2xl bg-slate-50 border-dashed">
              <div className="h-24 w-full rounded-xl bg-white border overflow-hidden flex items-center justify-center relative">
                {editBaptismPreview ? renderFilePreview(editBaptismPreview) : <ImageIcon className="h-8 w-8 text-slate-200" />}
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" className="rounded-xl h-8 gap-2 font-bold px-2 text-[10px]" onClick={() => startCameraAction("BAPTISM")}>
                  <Camera className="h-3.5 w-3.5" /> Cámara
                </Button>
                <Button type="button" size="sm" variant="outline" className="rounded-xl h-8 gap-2 font-bold px-2 text-[10px]" onClick={() => editBaptismInputRef.current?.click()}>
                  <ImageIcon className="h-3.5 w-3.5" /> Archivo
                </Button>
                <input type="file" ref={editBaptismInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => handleFileEdit(e, "baptism")} />
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <Label className="text-[10px] font-black text-primary uppercase tracking-widest text-center block">Comprobante Pago</Label>
            <div className="flex flex-col items-center gap-4 p-4 border rounded-2xl bg-slate-50 border-dashed">
              <div className="h-24 w-full rounded-xl bg-white border overflow-hidden flex items-center justify-center relative">
                {editPaymentProofPreview ? renderFilePreview(editPaymentProofPreview) : <Wallet className="h-8 w-8 text-slate-200" />}
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" className="rounded-xl h-8 gap-2 font-bold px-2 text-[10px]" onClick={() => startCameraAction("PAY_PROOF")}>
                  <Camera className="h-3.5 w-3.5" /> Cámara
                </Button>
                <Button type="button" size="sm" variant="outline" className="rounded-xl h-8 gap-2 font-bold px-2 text-[10px]" onClick={() => editPaymentProofInputRef.current?.click()}>
                  <ImageIcon className="h-3.5 w-3.5" /> Archivo
                </Button>
                <input type="file" ref={editPaymentProofInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => handleFileEdit(e, "paymentProof")} />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Información Personal</h4>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre Completo</Label>
                <Input name="fullName" defaultValue={selectedReg?.fullName} required className="h-11 rounded-xl uppercase font-bold" />
              </div>
              <div className="space-y-2">
                <Label>Sexo</Label>
                <Select value={editGender} onValueChange={setEditGender}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Femenino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>C.I. N°</Label><Input name="ciNumber" defaultValue={selectedReg?.ciNumber} required className="h-11 rounded-xl" /></div>
              <div className="space-y-2"><Label>Celular</Label><Input name="phone" defaultValue={selectedReg?.phone} required className="h-11 rounded-xl" /></div>
            </div>
            <div className="space-y-2"><Label>Fecha de Nacimiento</Label><Input type="date" name="birthDate" defaultValue={selectedReg?.birthDate} required className="h-11 rounded-xl" /></div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Información Administrativa</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-amber-50/30 p-6 rounded-2xl border border-amber-100 border-dashed">
            <div className="space-y-2">
              <Label className="font-bold text-slate-700 flex items-center gap-2">
                <Wallet className="h-4 w-4 text-amber-600" /> Forma de Pago
              </Label>
              <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}>
                <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200">
                  <SelectValue placeholder="Seleccione método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sin registro</SelectItem>
                  <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editPaymentMethod !== "NONE" && (
              <div className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
                <Label className="font-bold text-slate-700 flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-green-600" /> Monto Registrado (Gs)
                </Label>
                <Input 
                  type="number" 
                  value={editAmountPaid} 
                  onChange={(e) => setEditAmountPaid(Number(e.target.value))}
                  readOnly={!isAdmin}
                  className={cn(
                    "h-11 rounded-xl bg-white border-slate-200 font-bold text-primary",
                    !isAdmin && "bg-slate-100 text-slate-400 cursor-not-allowed"
                  )}
                />
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Nivel y Horario</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-dashed">
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Año de Catequesis</Label>
              <Select value={editCatechesisYear} onValueChange={setEditCatechesisYear}>
                <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200">
                  <SelectValue placeholder="Seleccione el nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMER_AÑO">1° Año</SelectItem>
                  <SelectItem value="SEGUNDO_AÑO">2° Año</SelectItem>
                  <SelectItem value="ADULTOS">Adultos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Día de Asistencia</Label>
              <Select value={editAttendanceDay} onValueChange={setEditAttendanceDay}>
                <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200">
                  <SelectValue placeholder="Seleccione el día" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SABADO">Sábados</SelectItem>
                  <SelectItem value="DOMINGO">Domingos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Familia y Tutores</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl">
              <Label className="text-xs font-bold text-primary">MADRE</Label>
              <Input name="motherName" defaultValue={selectedReg?.motherName} placeholder="Nombre" className="h-10 uppercase bg-white" />
              <Input name="motherPhone" defaultValue={selectedReg?.motherPhone} placeholder="Celular" className="h-10 bg-white" />
            </div>
            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl">
              <Label className="text-xs font-bold text-primary">PADRE</Label>
              <Input name="fatherName" defaultValue={selectedReg?.fatherName} placeholder="Nombre" className="h-10 uppercase bg-white" />
              <Input name="fatherPhone" defaultValue={selectedReg?.fatherPhone} placeholder="Celular" className="h-10 bg-white" />
            </div>
          </div>
        </div>
      </div>
      <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3 shrink-0">
        <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={onClose}>Cancelar</Button>
        <Button type="submit" className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-bold gap-2 shadow-lg" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />} Guardar
        </Button>
      </DialogFooter>
    </form>
  )
}

export default function RegistrationsListPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("GROUPS")
  
  const [filterSex, setFilterSex] = useState<string>("all")
  const [filterOrigin, setFilterOrigin] = useState<string>("all")
  const [filterYear, setFilterYear] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("all")
  const [filterSchedule, setFilterSchedule] = useState<string>("all")

  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false)
  const [isProofViewOpen, setIsProofViewOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [newGroupId, setNewGroupId] = useState<string>("")
  const [withdrawalReason, setWithdrawalReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [viewProofUrl, setViewProofUrl] = useState<string | null>(null)
  const [zoomScale, setZoomScale] = useState(1)
  
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({
    key: 'createdAt',
    direction: 'desc'
  })
  
  const [showCamera, setShowCamera] = useState(false)
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget>("PHOTO")
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null)
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const userProfileRef = useMemoFirebase(() => db && user?.uid ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc(userProfileRef)
  const isAdmin = profile?.role === "Administrador"
  const isTesorero = profile?.role === "Tesorero"

  const treasuryRef = useMemoFirebase(() => db ? doc(db, "settings", "treasury") : null, [db])
  
  const regsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "confirmations"), orderBy("createdAt", "desc"), limit(100))
  }, [db, user])

  const groupsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "groups")
  }, [db, user])

  const { data: registrations, loading: loadingRegs } = useCollection(regsQuery)
  const { data: groups, loading: loadingGroups } = useCollection(groupsQuery)

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }))
  }

  const filteredRegistrations = useMemo(() => {
    if (!registrations) return []
    return registrations.filter(reg => {
      if (reg.isArchived) return false
      const matchesSearch = !searchTerm || 
        reg.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reg.ciNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesSex = filterSex === "all" || reg.sexo === filterSex
      const matchesOrigin = filterOrigin === "all" || (filterOrigin === "PUBLIC" ? reg.userId === "public_registration" : reg.userId !== "public_registration")
      const matchesYear = filterYear === "all" || reg.catechesisYear === filterYear
      const matchesStatus = filterStatus === "all" || reg.status === filterStatus
      const matchesPayment = filterPaymentMethod === "all" || reg.lastPaymentMethod === filterPaymentMethod
      const matchesSchedule = filterSchedule === "all" || reg.attendanceDay === filterSchedule
      return matchesSearch && matchesSex && matchesOrigin && matchesYear && matchesStatus && matchesPayment && matchesSchedule
    })
  }, [registrations, searchTerm, filterSex, filterOrigin, filterYear, filterStatus, filterPaymentMethod, filterSchedule])

  const registrationsByGroup = useMemo(() => {
    if (!registrations || !groups) return {}
    const grouped: Record<string, any[]> = {}
    groups.forEach(g => { grouped[g.id] = [] })
    grouped["none"] = []

    const sorted = [...filteredRegistrations].sort((a, b) => {
      const getTime = (val: any) => {
        if (!val) return 0;
        if (val.toDate) return val.toDate().getTime();
        return new Date(val).getTime();
      };
      const timeA = getTime(a[sortConfig.key]);
      const timeB = getTime(b[sortConfig.key]);
      if (timeA < timeB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (timeA > timeB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    sorted.forEach(reg => {
      const gId = reg.groupId && grouped[reg.groupId] ? reg.groupId : "none"
      grouped[gId].push(reg)
    })
    return grouped
  }, [filteredRegistrations, groups, sortConfig])

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

  const startCamera = async (target: CaptureTarget, deviceId?: string) => {
    setCaptureTarget(target)
    try {
      if (currentStream) currentStream.getTracks().forEach(track => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      setCurrentStream(stream)
      setHasCameraPermission(true)
      const availableDevices = await navigator.mediaDevices.enumerateDevices()
      setDevices(availableDevices.filter(d => d.kind === 'videoinput'))
      setShowCamera(true)
    } catch (error) {
      setHasCameraPermission(false)
      toast({ variant: 'destructive', title: 'Acceso denegado' })
    }
  }

  const stopCamera = () => {
    if (currentStream) currentStream.getTracks().forEach(track => track.stop());
    setCurrentStream(null)
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
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
        window.dispatchEvent(new CustomEvent('camera-capture-success', { detail: { target: captureTarget, dataUrl } }));
        stopCamera()
      }
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "INSCRITO": return <Badge className="bg-green-500 hover:bg-green-600 text-white border-none">Inscrito</Badge>
      case "POR_VALIDAR": return <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">Por Validar</Badge>
      case "PENDIENTE_PAGO": return <Badge variant="outline" className="text-blue-500 border-blue-200">Pendiente Pago</Badge>
      case "BAJA": return <Badge variant="destructive" className="bg-slate-900">Baja</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatCatechesisYear = (year: string) => {
    switch (year) {
      case "PRIMER_AÑO": return "1° Año"; case "SEGUNDO_AÑO": return "2° Año"; case "ADULTOS": return "Adultos"; default: return year;
    }
  }

  const formatTimestamp = (ts: any) => {
    if (!ts) return "---";
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      if (isNaN(date.getTime())) return "---";
      return date.toLocaleDateString('es-PY') + " " + date.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return "---"; }
  };

  const handleAssignGroup = async () => {
    if (!db || !selectedReg || !newGroupId) return
    setIsSubmitting(true)
    try {
      const ref = doc(db, "confirmations", selectedReg.id)
      const group = groups?.find(g => g.id === newGroupId)
      await updateDoc(ref, { 
        groupId: newGroupId, 
        attendanceDay: group?.attendanceDay || selectedReg.attendanceDay,
        updatedAt: serverTimestamp() 
      })
      toast({ title: "Grupo Asignado" })
      setIsAssignDialogOpen(false)
    } catch (e) { toast({ variant: "destructive", title: "Error" }) }
    finally { setIsSubmitting(false) }
  }

  const handleDeleteRegistration = async () => {
    if (!db || !selectedReg) return
    setIsSubmitting(true)
    try {
      await deleteDoc(doc(db, "confirmations", selectedReg.id))
      toast({ title: "Registro Eliminado" })
      setIsDeleteDialogOpen(false)
    } catch (e) { toast({ variant: "destructive", title: "Error" }) }
    finally { setIsSubmitting(false) }
  }

  if (!mounted) return null
  const isActuallyLoading = loadingRegs || !registrations;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Lista de Confirmandos</h1>
          <p className="text-muted-foreground">Consulta y valida los registros del Santuario Nacional.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <Button variant={viewMode === "LIST" ? "default" : "ghost"} size="sm" className={cn("h-8 rounded-lg text-xs font-bold gap-2", viewMode === "LIST" ? "shadow-sm" : "text-slate-500")} onClick={() => setViewMode("LIST")}><LayoutList className="h-3.5 w-3.5" /> Lista Plana</Button>
          <Button variant={viewMode === "GROUPS" ? "default" : "ghost"} size="sm" className={cn("h-8 rounded-lg text-xs font-bold gap-2", viewMode === "GROUPS" ? "shadow-sm" : "text-slate-500")} onClick={() => setViewMode("GROUPS")}><Users className="h-3.5 w-3.5" /> Por Grupos</Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nombre o C.I..." className="pl-9 bg-slate-50 border-none h-12 rounded-2xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <Button variant="ghost" className="h-12 rounded-2xl gap-2 font-bold" onClick={() => { setSearchTerm(""); setFilterSex("all"); setFilterYear("all"); setFilterStatus("all"); }}><FilterX className="h-4 w-4" /> Limpiar</Button>
        </div>
      </div>

      {isActuallyLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="text-xs font-bold text-slate-400 uppercase">Sincronizando...</p></div>
      ) : (
        <Accordion type="multiple" defaultValue={["none", ...(groups?.map(g => g.id) || [])]} className="space-y-4">
          {registrationsByGroup["none"]?.length > 0 && (
            <AccordionItem value="none" className="border-none">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <AccordionTrigger className="px-6 h-16 hover:no-underline hover:bg-slate-50">
                  <div className="flex items-center gap-4"><div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500"><AlertCircle className="h-5 w-5" /></div><div className="text-left"><p className="font-bold text-slate-900">Pendientes de Grupo o Validación</p></div></div>
                </AccordionTrigger>
                <AccordionContent className="p-0 border-t border-slate-50">
                  <StudentTable students={registrationsByGroup["none"]} formatYear={formatCatechesisYear} getBadge={getStatusBadge} isAdmin={isAdmin} isTesorero={isTesorero} onAssignGroup={(reg: any) => { setSelectedReg(reg); setIsAssignDialogOpen(true); }} onWithdraw={(reg: any) => { setSelectedReg(reg); setIsWithdrawDialogOpen(true); }} onDelete={(reg: any) => { setSelectedReg(reg); setIsDeleteDialogOpen(true); }} onViewDetails={(reg: any) => { setSelectedReg(reg); setIsDetailsDialogOpen(true); }} onViewImage={(url: string) => { setViewProofUrl(url); setIsProofViewOpen(true); }} onSort={handleSort} sortConfig={sortConfig} />
                </AccordionContent>
              </div>
            </AccordionItem>
          )}
          {groups?.map((group: any) => {
            const groupStudents = registrationsByGroup[group.id] || []
            if (groupStudents.length === 0) return null
            return (
              <AccordionItem key={group.id} value={group.id} className="border-none">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <AccordionTrigger className="px-6 h-16 hover:no-underline hover:bg-slate-50">
                    <div className="flex items-center gap-4"><div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary"><Users className="h-5 w-5" /></div><div className="text-left"><p className="font-bold text-slate-900">{group.name} - {formatCatechesisYear(group.catechesisYear)}</p></div></div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0 border-t border-slate-50">
                    <StudentTable students={groupStudents} formatYear={formatCatechesisYear} getBadge={getStatusBadge} isAdmin={isAdmin} isTesorero={isTesorero} onAssignGroup={(reg: any) => { setSelectedReg(reg); setIsAssignDialogOpen(true); }} onWithdraw={(reg: any) => { setSelectedReg(reg); setIsWithdrawDialogOpen(true); }} onDelete={(reg: any) => { setSelectedReg(reg); setIsDeleteDialogOpen(true); }} onViewDetails={(reg: any) => { setSelectedReg(reg); setIsDetailsDialogOpen(true); }} onViewImage={(url: string) => { setViewProofUrl(url); setIsProofViewOpen(true); }} onSort={handleSort} sortConfig={sortConfig} />
                  </AccordionContent>
                </div>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}

      {/* DIÁLOGOS */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[850px] p-0 overflow-hidden rounded-3xl h-[95vh] max-h-[95vh] flex flex-col border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <DialogTitle className="text-xl font-headline">Ficha de {selectedReg?.fullName}</DialogTitle>
            <DialogDescription className="text-white/70">Consulta detallada de la ficha institucional.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-slate-50">
            {selectedReg && (
              <div className="p-8 space-y-10">
                {/* CABECERA PERFIL */}
                <div className="flex flex-col md:flex-row items-center gap-8 bg-white p-8 rounded-[2.5rem] shadow-sm border">
                  <div className="relative">
                    <Avatar className="h-32 w-32 border-4 border-slate-50 shadow-xl">
                      <AvatarImage src={selectedReg.photoUrl} className="object-cover" />
                      <AvatarFallback><User className="h-16 w-16 text-slate-200" /></AvatarFallback>
                    </Avatar>
                    <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary px-4 py-1 h-auto text-[10px] uppercase font-black">
                      {formatCatechesisYear(selectedReg.catechesisYear)}
                    </Badge>
                  </div>
                  <div className="flex-1 text-center md:text-left space-y-2">
                    <h2 className="text-3xl font-black text-slate-900 leading-tight uppercase tracking-tight">{selectedReg.fullName}</h2>
                    <div className="flex flex-wrap justify-center md:justify-start gap-3">
                      <Badge variant="outline" className="gap-2 h-8 px-4 border-slate-200 bg-slate-50">
                        <UserCircle className="h-3.5 w-3.5 text-slate-400" /> C.I. {selectedReg.ciNumber}
                      </Badge>
                      <Badge variant="outline" className="gap-2 h-8 px-4 border-slate-200 bg-slate-50">
                        <Phone className="h-3.5 w-3.5 text-slate-400" /> {selectedReg.phone}
                      </Badge>
                      <Badge variant="outline" className="gap-2 h-8 px-4 border-slate-200 bg-slate-50 uppercase">
                        {selectedReg.sexo === "M" ? "Masculino" : "Femenino"}
                      </Badge>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-center gap-2">
                    {getStatusBadge(selectedReg.status)}
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado Actual</p>
                  </div>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                  {/* SECCIÓN PERSONAL Y FAMILIAR */}
                  <div className="space-y-8">
                    <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
                      <CardHeader className="bg-slate-50/50 border-b p-6">
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                          <Users className="h-4 w-4" /> Entorno Familiar
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                            <p className="text-[9px] font-black text-primary uppercase tracking-widest">Madre</p>
                            <p className="text-xs font-bold text-slate-700 uppercase">{selectedReg.motherName || "No registrado"}</p>
                            <p className="text-[10px] text-slate-400">{selectedReg.motherPhone || ""}</p>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                            <p className="text-[9px] font-black text-primary uppercase tracking-widest">Padre</p>
                            <p className="text-xs font-bold text-slate-700 uppercase">{selectedReg.fatherName || "No registrado"}</p>
                            <p className="text-[10px] text-slate-400">{selectedReg.fatherPhone || ""}</p>
                          </div>
                        </div>
                        {selectedReg.tutorName && (
                          <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-1">
                            <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Tutor / Responsable</p>
                            <p className="text-xs font-bold text-slate-700 uppercase">{selectedReg.tutorName}</p>
                            <p className="text-[10px] text-slate-400">{selectedReg.tutorPhone || ""}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-slate-500 px-2">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Nacimiento: <strong>{selectedReg.birthDate}</strong> ({selectedReg.age} años)</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
                      <CardHeader className="bg-slate-50/50 border-b p-6">
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                          <BookOpen className="h-4 w-4" /> Vida Sacramental
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-600 uppercase">Bautismo</span>
                            {selectedReg.hasBaptism ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <X className="h-5 w-5 text-red-400" />}
                          </div>
                          {selectedReg.hasBaptism && (
                            <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 space-y-3">
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div><p className="text-[8px] font-black text-slate-400 uppercase">Libro</p><p className="text-xs font-bold">{selectedReg.baptismBook || "-"}</p></div>
                                <div><p className="text-[8px] font-black text-slate-400 uppercase">Folio</p><p className="text-xs font-bold">{selectedReg.baptismFolio || "-"}</p></div>
                                <div><p className="text-[8px] font-black text-slate-400 uppercase">Parroquia</p><p className="text-[10px] font-bold uppercase truncate">{selectedReg.baptismParish || "-"}</p></div>
                              </div>
                              {selectedReg.baptismCertificatePhotoUrl && (
                                <Button variant="outline" className="w-full h-10 rounded-xl font-bold gap-2 text-xs" onClick={() => { setViewProofUrl(selectedReg.baptismCertificatePhotoUrl); setIsProofViewOpen(true); }}>
                                  <Eye className="h-3.5 w-3.5" /> Ver Certificado
                                </Button>
                              )}
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-600 uppercase">Primera Comunión</span>
                            {selectedReg.hasFirstCommunion ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <X className="h-5 w-5 text-red-400" />}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* SECCIÓN ADMINISTRATIVA Y PAGO */}
                  <div className="space-y-8">
                    <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden border-t-4 border-t-primary">
                      <CardHeader className="bg-slate-50/50 border-b p-6">
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4" /> Administrativo
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6">
                        <div className="grid gap-4">
                          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                            <div className="space-y-1">
                              <p className="text-[9px] font-black text-primary uppercase tracking-widest">Grupo Asignado</p>
                              <p className="text-sm font-bold text-slate-700">{groups?.find(g => g.id === selectedReg.groupId)?.name || "Sin grupo"}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-white shadow-sm" onClick={() => setIsAssignDialogOpen(true)}>
                              <RefreshCcw className="h-4 w-4 text-slate-400" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                            <div className="space-y-1">
                              <p className="text-[9px] font-black text-primary uppercase tracking-widest">Día y Horario</p>
                              <p className="text-sm font-bold text-slate-700 uppercase">{selectedReg.attendanceDay}S</p>
                            </div>
                            <CalendarDays className="h-5 w-5 text-slate-300" />
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="text-[9px] font-black text-green-600 uppercase tracking-widest">Recaudación</p>
                              <p className="text-2xl font-black text-slate-900">{(selectedReg.amountPaid || 0).toLocaleString('es-PY')} Gs.</p>
                            </div>
                            <Badge className={cn("px-4 py-1 h-auto text-[10px] font-black uppercase", selectedReg.paymentStatus === "PAGADO" ? "bg-green-500" : "bg-orange-500")}>
                              {selectedReg.paymentStatus || "PENDIENTE"}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-slate-50 rounded-xl text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase">Método</p>
                              <p className="text-xs font-bold uppercase">{selectedReg.lastPaymentMethod || "Sin registro"}</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase">Recibo N°</p>
                              <p className="text-xs font-bold font-mono">{selectedReg.receiptNumber || "-"}</p>
                            </div>
                          </div>
                          {selectedReg.paymentProofUrl && (
                            <Button className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold gap-3 shadow-lg" onClick={() => { setViewProofUrl(selectedReg.paymentProofUrl); setIsProofViewOpen(true); }}>
                              <ImageIcon className="h-4 w-4" /> Ver Comprobante de Pago
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <div className="p-6 bg-slate-100 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-center">
                      <Clock className="h-6 w-6 text-slate-300" />
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Registrado el</p>
                        <p className="text-xs font-bold text-slate-600">{formatTimestamp(selectedReg.createdAt)}</p>
                        <p className="text-[8px] text-slate-400 italic">Por: {selectedReg.userId === "public_registration" ? "Postulante (Web)" : "Secretaría"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="p-6 bg-white border-t flex flex-row gap-3 shrink-0">
            <Button variant="outline" className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-xs border-slate-200" onClick={() => setIsDetailsDialogOpen(false)}>Cerrar</Button>
            <Button className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest text-xs gap-3 shadow-xl active:scale-95 transition-transform" onClick={() => { setIsDetailsDialogOpen(false); setIsEditDialogOpen(true); }}>
              <Edit className="h-4 w-4" /> Editar Ficha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[750px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl h-[90vh] max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 bg-slate-900 text-white">
            <DialogTitle>Editar Ficha de Inscripción</DialogTitle>
            <DialogDescription>Actualiza datos personales o fotos.</DialogDescription>
          </DialogHeader>
          {selectedReg && <EditRegistrationForm selectedReg={selectedReg} profile={profile} onClose={() => setIsEditDialogOpen(false)} onSaveSuccess={(data) => { setSelectedReg({...selectedReg, ...data}); setIsEditDialogOpen(false); }} startCameraAction={(target) => startCamera(target)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={showCamera} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-primary text-white">
            <DialogTitle>Capturar Foto</DialogTitle>
            <DialogDescription>Asegura una buena iluminación.</DialogDescription>
          </DialogHeader>
          <div className="relative bg-black aspect-[3/4]"><video ref={onVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" /><canvas ref={canvasRef} className="hidden" /></div>
          <DialogFooter className="p-6 bg-slate-50 border-t"><Button className="w-full h-12 rounded-xl font-bold bg-primary" onClick={takePhoto}>Capturar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader><DialogTitle>Asignar Grupo</DialogTitle><DialogDescription>Mueve a {selectedReg?.fullName} a un grupo específico.</DialogDescription></DialogHeader>
          <div className="py-6 space-y-4">
            <Label className="font-bold">Seleccionar Grupo</Label>
            <Select value={newGroupId} onValueChange={setNewGroupId}>
              <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Elija un grupo..." /></SelectTrigger>
              <SelectContent>
                {groups?.filter(g => g.catechesisYear === selectedReg?.catechesisYear).map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name} ({g.attendanceDay}s)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2"><Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsAssignDialogOpen(false)}>Cancelar</Button><Button className="flex-1 rounded-xl bg-primary" onClick={handleAssignGroup} disabled={isSubmitting || !newGroupId}>Asignar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer. Se borrará permanentemente la ficha de {selectedReg?.fullName}.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-white rounded-xl" onClick={handleDeleteRegistration} disabled={isSubmitting}>Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isProofViewOpen} onOpenChange={(open) => { setIsProofViewOpen(open); if(!open) setZoomScale(1); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl p-0 bg-transparent border-none shadow-none flex items-center justify-center overflow-visible">
          <DialogHeader className="sr-only"><DialogTitle>Vista de Documento</DialogTitle></DialogHeader>
          <div className="relative flex flex-col items-center w-full">
            <Button variant="secondary" size="icon" className="absolute -top-14 right-0 rounded-full text-white bg-white/20 hover:bg-white/40 border border-white/10 z-50" onClick={() => setIsProofViewOpen(false)}><X className="h-6 w-6" /></Button>
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
                  {viewProofUrl?.startsWith("data:application/pdf") ? (
                    <iframe src={viewProofUrl} className="w-full h-[70vh] rounded-xl" />
                  ) : (
                    <img src={viewProofUrl || ""} className="rounded-xl shadow-2xl transition-all duration-300 select-none h-auto" style={{ width: zoomScale === 1 ? 'auto' : `${zoomScale * 100}%`, maxWidth: zoomScale === 1 ? '100%' : 'none', maxHeight: zoomScale === 1 ? '75vh' : 'none', objectFit: 'contain' }} alt="Documento" />
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StudentTable({ students, formatYear, getBadge, isAdmin, isTesorero, onAssignGroup, onWithdraw, onDelete, onViewDetails, onViewImage, onSort, sortConfig }: any) {
  return (
    <Table>
      <TableHeader className="bg-slate-50/30">
        <TableRow>
          <TableHead className="w-[60px] pl-6"></TableHead>
          <TableHead className="font-bold text-xs">Confirmando</TableHead>
          <TableHead className="text-center font-bold text-xs">Año</TableHead>
          <TableHead className="text-center font-bold text-xs">Estado</TableHead>
          <TableHead className="text-right pr-8 font-bold text-xs">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((reg: any) => (
          <TableRow key={reg.id} className="h-14 hover:bg-slate-50/50 transition-colors">
            <TableCell className="pl-6"><Avatar className="h-8 w-8 border cursor-pointer active:scale-95 transition-transform" onClick={() => reg.photoUrl && onViewImage(reg.photoUrl)}><AvatarImage src={reg.photoUrl} className="object-cover" /><AvatarFallback><User className="h-4 w-4" /></AvatarFallback></Avatar></TableCell>
            <TableCell><div className="flex flex-col"><span className="font-bold text-xs uppercase text-slate-900">{reg.fullName}</span><span className="text-[10px] text-slate-400">C.I. {reg.ciNumber}</span></div></TableCell>
            <TableCell className="text-center"><span className="text-[10px] font-bold text-slate-400">{formatYear(reg.catechesisYear)}</span></TableCell>
            <TableCell className="text-center">{getBadge(reg.status)}</TableCell>
            <TableCell className="text-right pr-8">
              <div className="flex justify-end gap-2">
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-colors" onClick={() => onViewDetails(reg)} title="Ver Ficha"><Eye className="h-4 w-4" /></Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl border-none shadow-xl p-2 w-48">
                    <DropdownMenuLabel className="text-[10px] uppercase font-black text-slate-400 px-2 py-1">Opciones</DropdownMenuLabel>
                    <DropdownMenuItem className="rounded-lg h-10 gap-3" onClick={() => onAssignGroup(reg)}><Users className="h-4 w-4 text-slate-400" /> Asignar Grupo</DropdownMenuItem>
                    <DropdownMenuItem className="rounded-lg h-10 gap-3" onClick={() => onViewDetails(reg)}><Edit className="h-4 w-4 text-slate-400" /> Editar Datos</DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-slate-100" />
                    {isAdmin && <DropdownMenuItem className="rounded-lg h-10 gap-3 text-destructive focus:bg-red-50 focus:text-destructive" onClick={() => onDelete(reg)}><Trash2 className="h-4 w-4" /> Eliminar Ficha</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
