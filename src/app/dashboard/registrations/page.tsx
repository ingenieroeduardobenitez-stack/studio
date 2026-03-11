
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
  UserMinus,
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
  Church
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
import { QRCodeCanvas } from "qrcode.react"
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
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
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
      baptismParish: getVal("baptismParish").toUpperCase(),
      baptismBook: getVal("baptismBook"),
      baptismFolio: getVal("baptismFolio"),
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
          details: `Se actualizaron los datos de la ficha de: ${updateData.fullName}.${editPaymentMethod === 'NONE' ? ' Se reseteó el pago a 0.' : ` Monto editado: ${updateData.amountPaid} Gs.`}`,
          timestamp: serverTimestamp()
        }).catch(() => {});

        toast({ title: "Registro Actualizado", description: "Los datos de la ficha han sido guardados." })
        onSaveSuccess({ ...updateData, updatedAt: new Date().toISOString() })
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
                {editBaptismPreview ? (
                  renderFilePreview(editBaptismPreview)
                ) : (
                  <ImageIcon className="h-8 w-8 text-slate-200" />
                )}
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
                {editPaymentProofPreview ? (
                  renderFilePreview(editPaymentProofPreview)
                ) : (
                  <Wallet className="h-8 w-8 text-slate-200" />
                )}
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
                    <SelectValue placeholder="Seleccione sexo" />
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
              <p className="text-[9px] text-slate-400 italic">
                * Al cambiar a "Sin registro", la ficha pasará a estado "Por Validar" y el monto volverá a 0.
              </p>
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
                <p className="text-[9px] text-slate-400 italic">
                  {isAdmin 
                    ? "* Puedes corregir el monto recibido si fue cargado incorrectamente." 
                    : "* Solo los administradores pueden corregir montos registrados."}
                </p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Nivel y Horario de Catequesis</h4>
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
        <Button type="submit" className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-black text-white font-bold gap-2 shadow-lg" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />} Guardar Cambios
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

  const stats = useMemo(() => {
    const s = { m: 0, f: 0, total: 0 };
    filteredRegistrations.forEach(r => {
      s.total++;
      if (r.sexo === "M") s.m++;
      else if (r.sexo === "F") s.f++;
    });
    return s;
  }, [filteredRegistrations]);

  const registrationsByGroup = useMemo(() => {
    if (!registrations || !groups) return {}
    
    const grouped: Record<string, any[]> = {}
    groups.forEach(g => { grouped[g.id] = [] })
    grouped["none"] = []

    const sorted = [...filteredRegistrations].sort((a, b) => {
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      
      const getTime = (val: any) => {
        if (!val) return 0;
        if (val.toDate) return val.toDate().getTime();
        return new Date(val).getTime();
      };

      const timeA = getTime(valA);
      const timeB = getTime(valB);

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

  const resetFilters = () => {
    setSearchTerm("");
    setFilterSex("all");
    setFilterOrigin("all");
    setFilterYear("all");
    setFilterStatus("all");
    setFilterPaymentMethod("all");
    setFilterSchedule("all");
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

  const startCamera = async (target: CaptureTarget, deviceId?: string) => {
    setCaptureTarget(target)
    try {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      const facingModeValue = target === "PHOTO" ? "user" : "environment";
      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          facingMode: deviceId ? undefined : facingModeValue,
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
      toast({ variant: 'destructive', title: 'Acceso denegado', description: 'Por favor, permite el acceso a la cámara.' })
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
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
        window.dispatchEvent(new CustomEvent('camera-capture-success', { 
          detail: { target: captureTarget, dataUrl } 
        }));
        stopCamera()
      }
    }
  }

  const handleSyncSexData = async () => {
    if (!db || !isAdmin || isSubmitting) return;
    setIsSubmitting(true);
    let count = 0;
    try {
      const studentsToFix = filteredRegistrations.filter(r => !r.sexo || r.sexo === "");
      if (studentsToFix.length === 0) {
        toast({ title: "Información al día" });
        setIsSubmitting(false);
        return;
      }
      const batchSize = 25; 
      for (let i = 0; i < studentsToFix.length; i += batchSize) {
        const chunk = studentsToFix.slice(i, i + batchSize);
        const batch = writeBatch(db);
        let batchCount = 0;
        for (const student of chunk) {
          const cleanCi = student.ciNumber?.replace(/[^0-9]/g, '');
          if (!cleanCi) continue;
          const cedulaRef = doc(db, 'cedulas', cleanCi);
          const cedulaSnap = await getDoc(cedulaRef);
          if (cedulaSnap.exists()) {
            const data = cedulaSnap.data();
            let sexValue = "";
            if (data.SEXO) {
              const raw = String(data.SEXO).trim().toUpperCase();
              if (raw.startsWith('M')) sexValue = "M"; else if (raw.startsWith('F')) sexValue = "F";
            }
            if (sexValue) {
              batch.update(doc(db, "confirmations", student.id), { sexo: sexValue });
              batchCount++; count++;
            }
          }
        }
        if (batchCount > 0) await batch.commit();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (count > 0) toast({ title: `Se actualizaron ${count} fichas.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error en sincronización" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValidatePayment = async () => {
    if (!db || !selectedReg || !treasuryRef) return
    setIsSubmitting(true)
    const catechistName = profile ? `${profile.firstName} ${profile.lastName}` : "Tesorero"
    const regRef = doc(db, "confirmations", selectedReg.id);
    try {
      await runTransaction(db, async (transaction) => {
        const treasurySnap = await transaction.get(treasuryRef);
        if (!treasurySnap.exists()) throw "Settings not found";
        const currentNext = treasurySnap.data()?.nextReceiptNumber || 1;
        const formattedReceipt = `001-001-${String(currentNext).padStart(7, '0')}`;
        transaction.update(regRef, {
          status: "INSCRITO",
          amountPaid: selectedReg.registrationCost || 35000,
          paymentStatus: "PAGADO",
          validatedAt: serverTimestamp(),
          validatedBy: catechistName,
          receiptNumber: formattedReceipt
        });
        transaction.update(treasuryRef, { nextReceiptNumber: currentNext + 1 });
      });
      toast({ title: "Pago Validado" })
      setIsDetailsDialogOpen(false)
    } catch (error) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAssignGroup = () => {
    if (!db || !selectedReg || !newGroupId) return
    setIsSubmitting(true)
    const group = groups?.find(g => g.id === newGroupId)
    if (!group) return
    const regRef = doc(db, "confirmations", selectedReg.id);
    updateDoc(regRef, { groupId: newGroupId, attendanceDay: group.attendanceDay, updatedAt: serverTimestamp() })
      .then(() => {
        toast({ title: "Grupo asignado" })
        setIsAssignDialogOpen(false)
      })
      .finally(() => setIsSubmitting(false))
  }

  const handleWithdrawConfirmand = () => {
    if (!db || !selectedReg || !withdrawalReason) return
    setIsSubmitting(true)
    updateDoc(doc(db, "confirmations", selectedReg.id), { status: "BAJA", isArchived: true, withdrawalReason, withdrawalDate: serverTimestamp() })
      .then(() => {
        toast({ title: "Baja procesada" })
        setIsWithdrawDialogOpen(false)
      })
      .finally(() => setIsSubmitting(false))
  }

  const handleDeleteRegistration = () => {
    if (!db || !selectedReg) return
    setIsSubmitting(true)
    deleteDoc(doc(db, "confirmations", selectedReg.id))
      .then(() => {
        toast({ title: "Registro eliminado" })
        setIsDeleteDialogOpen(false)
      })
      .finally(() => setIsSubmitting(false))
  }

  const openAssignDialog = (reg: any) => { setSelectedReg(reg); setNewGroupId(reg.groupId || ""); setIsAssignDialogOpen(true); }
  const openWithdrawDialog = (reg: any) => { setSelectedReg(reg); setWithdrawalReason(""); setIsWithdrawDialogOpen(true); }
  const openDeleteDialog = (reg: any) => { setSelectedReg(reg); setIsDeleteDialogOpen(true); }
  const openDetailsDialog = (reg: any) => { setSelectedReg(reg); setIsDetailsDialogOpen(true); }
  const openEditDialog = (reg: any) => { setSelectedReg(reg); setIsEditDialogOpen(true); }

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

  if (!mounted) return null
  const isActuallyLoading = loadingRegs || !registrations;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Lista de Confirmandos</h1>
          <p className="text-muted-foreground">Consulta y valida los registros del Santuario Nacional.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {isAdmin && (
            <Button variant="outline" className="h-11 rounded-xl font-bold gap-2 text-primary border-primary/20 hover:bg-primary/5 shadow-sm" onClick={handleSyncSexData} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Sincronizar Sexo
            </Button>
          )}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Button variant={viewMode === "LIST" ? "default" : "ghost"} size="sm" className={cn("h-8 rounded-lg text-xs font-bold gap-2", viewMode === "LIST" ? "shadow-sm" : "text-slate-500")} onClick={() => setViewMode("LIST")}><LayoutList className="h-3.5 w-3.5" /> Lista Plana</Button>
            <Button variant={viewMode === "GROUPS" ? "default" : "ghost"} size="sm" className={cn("h-8 rounded-lg text-xs font-bold gap-2", viewMode === "GROUPS" ? "shadow-sm" : "text-slate-500")} onClick={() => setViewMode("GROUPS")}><Users className="h-3.5 w-3.5" /> Por Grupos</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-blue-50/50 border-l-4 border-l-blue-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5"><p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Masculino</p><p className="text-2xl font-black text-blue-900">{isActuallyLoading ? "..." : stats.m}</p></div>
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><span className="font-black text-sm">M</span></div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-pink-50/50 border-l-4 border-l-pink-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5"><p className="text-[10px] font-black text-pink-600 uppercase tracking-widest">Femenino</p><p className="text-2xl font-black text-pink-900">{isActuallyLoading ? "..." : stats.f}</p></div>
            <div className="h-10 w-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600"><span className="font-black text-sm">F</span></div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-slate-100/50 border-l-4 border-l-slate-500 col-span-2 md:col-span-1">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5"><p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Total General</p><p className="text-2xl font-black text-slate-900">{isActuallyLoading ? "..." : stats.total}</p></div>
            <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600"><span className="font-black text-sm">Σ</span></div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nombre o C.I..." className="pl-9 bg-slate-50 border-none h-12 rounded-2xl focus:ring-primary shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button variant="ghost" className="h-12 rounded-2xl gap-2 font-bold text-slate-400 hover:text-primary" onClick={resetFilters}><FilterX className="h-4 w-4" /> Limpiar Filtros</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4">
            <div className="space-y-1.5"><Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sexo</Label><Select value={filterSex} onValueChange={setFilterSex}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="M">M</SelectItem><SelectItem value="F">F</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Origen</Label><Select value={filterOrigin} onValueChange={setFilterOrigin}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="PUBLIC">Público</SelectItem><SelectItem value="MANUAL">Manual</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nivel</Label><Select value={filterYear} onValueChange={setFilterYear}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="PRIMER_AÑO">1° Año</SelectItem><SelectItem value="SEGUNDO_AÑO">2° Año</SelectItem><SelectItem value="ADULTOS">Adultos</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado</Label><Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="INSCRITO">Inscrito</SelectItem><SelectItem value="POR_VALIDAR">Por Validar</SelectItem><SelectItem value="PENDIENTE_PAGO">Pendiente Pago</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pago</Label><Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="EFECTIVO">Efectivo</SelectItem><SelectItem value="TRANSFERENCIA">Transferencia</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Horario</Label><Select value={filterSchedule} onValueChange={setFilterSchedule}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="SABADO">Sábado</SelectItem><SelectItem value="DOMINGO">Domingo</SelectItem></SelectContent></Select></div>
          </div>
        </div>

        {isActuallyLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sincronizando...</p></div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[2.5rem] border shadow-sm flex flex-col items-center gap-4"><div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center"><Filter className="h-8 w-8 text-slate-200" /></div><p className="text-slate-500 font-bold">Sin resultados</p></div>
        ) : (
          <Accordion type="multiple" defaultValue={["none", ...(groups?.map(g => g.id) || [])]} className="space-y-4">
            {registrationsByGroup["none"]?.length > 0 && (
              <AccordionItem value="none" className="border-none">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <AccordionTrigger className="px-6 h-16 hover:no-underline hover:bg-slate-50">
                    <div className="flex items-center gap-4"><div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500"><AlertCircle className="h-5 w-5" /></div><div className="text-left"><p className="font-bold text-slate-900">Pendientes de Grupo o Validación</p><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{registrationsByGroup["none"].length} registros</p></div></div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0 border-t border-slate-50">
                    <StudentTable students={registrationsByGroup["none"]} formatYear={formatCatechesisYear} getBadge={getStatusBadge} isAdmin={isAdmin} isTesorero={isTesorero} onAssignGroup={openAssignDialog} onWithdraw={openWithdrawDialog} onDelete={openDeleteDialog} onViewDetails={openDetailsDialog} onViewImage={(url: string) => { setViewProofUrl(url); setIsProofViewOpen(true); }} onSort={handleSort} sortConfig={sortConfig} />
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
                      <div className="flex items-center gap-4"><div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary"><Users className="h-5 w-5" /></div><div className="text-left"><div className="flex items-center gap-2"><p className="font-bold text-slate-900">{group.name}</p><Badge variant="secondary" className="text-[9px] h-4 uppercase tracking-tighter">{formatYear(group.catechesisYear)}</Badge></div><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{group.attendanceDay}s • {groupStudents.length} confirmandos</p></div></div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0 border-t border-slate-50">
                      <StudentTable students={groupStudents} formatYear={formatCatechesisYear} getBadge={getStatusBadge} isAdmin={isAdmin} isTesorero={isTesorero} onAssignGroup={openAssignDialog} onWithdraw={openWithdrawDialog} onDelete={openDeleteDialog} onViewDetails={openDetailsDialog} onViewImage={(url: string) => { setViewProofUrl(url); setIsProofViewOpen(true); }} onSort={handleSort} sortConfig={sortConfig} />
                    </AccordionContent>
                  </div>
                </AccordionItem>
              )
            })}
          </Accordion>
        )}
      </div>

      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[850px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl h-[95vh] max-h-[95vh] flex flex-col">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="relative cursor-pointer hover:scale-105 transition-transform" onClick={() => { if(selectedReg?.photoUrl) { setViewProofUrl(selectedReg.photoUrl); setIsProofViewOpen(true); } }}>
                <Avatar className="h-20 w-20 md:h-24 md:w-24 border-4 border-white/20 shadow-xl"><AvatarImage src={selectedReg?.photoUrl} className="object-cover" /><AvatarFallback className="bg-white/10 text-white"><User className="h-10 w-10" /></AvatarFallback></Avatar>
                <div className="absolute -bottom-2 -right-2">{getStatusBadge(selectedReg?.status)}</div>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60 leading-none">Ficha Institucional</p>
                <DialogTitle className="text-xl md:text-2xl font-black uppercase tracking-tight leading-tight truncate">{selectedReg?.fullName}</DialogTitle>
                <div className="flex flex-wrap items-center gap-2 md:gap-4 pt-1"><Badge variant="outline" className="text-white border-white/30 font-bold gap-1 text-[10px]"><ShieldCheck className="h-3 w-3" /> C.I. {selectedReg?.ciNumber}</Badge><Badge variant="secondary" className="bg-white text-primary font-black uppercase tracking-tighter text-[10px]">{formatCatechesisYear(selectedReg?.catechesisYear)}</Badge></div>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-slate-50"><div className="p-6 md:p-8 space-y-8 pb-20">
            <section className="space-y-4"><div className="flex items-center gap-3 border-b pb-2"><UserCircle className="h-5 w-5 text-primary" /><h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Información Personal</h3></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6"><div className="space-y-1"><Label className="text-[9px] font-bold text-slate-400 uppercase">Nacimiento</Label><p className="text-sm font-bold text-slate-700 flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-slate-400" /> {selectedReg?.birthDate}</p></div><div className="space-y-1"><Label className="text-[9px] font-bold text-slate-400 uppercase">Edad</Label><p className="text-sm font-bold text-slate-700">{selectedReg?.age} Años</p></div><div className="space-y-1"><Label className="text-[9px] font-bold text-slate-400 uppercase">Contacto</Label><p className="text-sm font-bold text-slate-700 flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-green-500" /> {selectedReg?.phone}</p></div></div></section>
            <section className="space-y-4"><div className="flex items-center gap-3 border-b pb-2"><Users className="h-5 w-5 text-primary" /><h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Familia</h3></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="bg-white p-4 rounded-2xl border shadow-sm"><p className="text-[8px] font-black text-primary uppercase">Madre</p><p className="text-xs font-bold text-slate-700">{selectedReg?.motherName}</p><p className="text-[10px] text-slate-500">{selectedReg?.motherPhone}</p></div><div className="bg-white p-4 rounded-2xl border shadow-sm"><p className="text-[8px] font-black text-primary uppercase">Padre</p><p className="text-xs font-bold text-slate-700">{selectedReg?.fatherName}</p><p className="text-[10px] text-slate-500">{selectedReg?.fatherPhone}</p></div></div></section>
            <section className="space-y-4"><div className="flex items-center gap-3 border-b pb-2"><BookOpen className="h-5 w-5 text-primary" /><h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Sacramentos</h3></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className={cn("p-4 rounded-2xl border flex items-start gap-4", selectedReg?.hasBaptism ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100")}><div className={cn("p-2 rounded-xl shrink-0", selectedReg?.hasBaptism ? "bg-green-500 text-white" : "bg-red-500 text-white")}><Church className="h-5 w-5" /></div><div className="min-w-0"><p className="text-[10px] font-black uppercase">Bautismo</p><p className="text-[10px] font-bold text-slate-600 mt-0.5">{selectedReg?.hasBaptism ? 'Realizado' : 'Pendiente'}</p></div></div><div className={cn("p-4 rounded-2xl border flex items-start gap-4", selectedReg?.hasFirstCommunion ? "bg-blue-50 border-blue-100" : "bg-orange-50 border-orange-100")}><div className={cn("p-2 rounded-xl shrink-0", selectedReg?.hasFirstCommunion ? "bg-blue-500 text-white" : "bg-orange-500 text-white")}><Book className="h-5 w-5" /></div><div className="min-w-0"><p className="text-[10px] font-black uppercase">Primera Comunión</p><p className="text-[10px] font-bold text-slate-600 mt-0.5">{selectedReg?.hasFirstCommunion ? 'Realizado' : 'Pendiente'}</p></div></div></div></section>
            <section className="space-y-6"><div className="flex items-center gap-3 border-b pb-2"><ImageIcon className="h-5 w-5 text-primary" /><h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Documentación</h3></div><div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[8px] font-black text-slate-400 uppercase">Comprobante Pago</Label><div className="aspect-[4/3] rounded-xl border-2 border-dashed overflow-hidden bg-white cursor-pointer" onClick={() => { if(selectedReg?.paymentProofUrl) { setViewProofUrl(selectedReg.paymentProofUrl); setIsProofViewOpen(true); } }}>{selectedReg?.paymentProofUrl ? <img src={selectedReg.paymentProofUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-300"><ImageIcon className="h-6 w-6" /></div>}</div></div>
              <div className="space-y-2"><Label className="text-[8px] font-black text-slate-400 uppercase">Cert. Bautismo</Label><div className="aspect-[4/3] rounded-xl border-2 border-dashed overflow-hidden bg-white cursor-pointer" onClick={() => { if(selectedReg?.baptismCertificatePhotoUrl) { setViewProofUrl(selectedReg.baptismCertificatePhotoUrl); setIsProofViewOpen(true); } }}>{selectedReg?.baptismCertificatePhotoUrl ? <img src={selectedReg.baptismCertificatePhotoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-300"><ImageIcon className="h-6 w-6" /></div>}</div></div>
            </div></div></section>
          </div></div>
          <DialogFooter className="p-4 md:p-6 bg-white border-t flex flex-row justify-between gap-3 shrink-0"><Button variant="outline" className="rounded-xl h-11 md:h-12 font-bold" onClick={() => setIsDetailsDialogOpen(false)}>Cerrar</Button><div className="flex gap-2"><Button variant="secondary" className="rounded-xl h-11 md:h-12 bg-slate-100 text-slate-700 font-bold gap-2" onClick={() => openEditDialog(selectedReg)}><Edit className="h-4 w-4 text-primary" /> Editar Ficha</Button>{selectedReg?.status === "POR_VALIDAR" && (isAdmin || isTesorero) && (<Button className="rounded-xl h-11 md:h-12 bg-green-600 font-bold gap-2" onClick={handleValidatePayment} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <><CheckCircle2 className="h-4 w-4" /> Validar Pago</>}</Button>)}</div></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open)
        if (!open) setSelectedReg(null)
      }}>
        <DialogContent className="sm:max-w-[750px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl h-[90vh] max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5" /> Actualizar Ficha de Inscripción</DialogTitle>
            <DialogDescription className="text-slate-400">Corrige datos o completa fotos faltantes de {selectedReg?.fullName}</DialogDescription>
          </DialogHeader>
          {selectedReg && (
            <EditRegistrationForm 
              key={selectedReg.id} 
              selectedReg={selectedReg} 
              profile={profile} 
              onClose={() => setIsEditDialogOpen(false)}
              onSaveSuccess={(data) => { 
                setSelectedReg({...selectedReg, ...data}); 
                setIsEditDialogOpen(false); 
              }}
              startCameraAction={(target) => startCamera(target)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCamera} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-primary text-white">
            <DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Capturar Foto</DialogTitle>
            <DialogDescription className="sr-only">Interfaz de captura de imagen mediante cámara.</DialogDescription>
          </DialogHeader>
          <div className="relative bg-black aspect-[3/4] max-h-[60vh] mx-auto flex items-center justify-center overflow-hidden"><video ref={onVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" /><canvas ref={canvasRef} className="hidden" />{hasCameraPermission === false && <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-white bg-slate-900/90 gap-4"><X className="h-12 w-12 text-red-500" /><p className="font-bold">Acceso denegado</p></div>}</div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-col gap-4">{devices.length > 1 && <div className="flex items-center gap-2 w-full"><FlipHorizontal className="h-4 w-4 text-slate-400" /><Select value={selectedDeviceId} onValueChange={(val) => { setSelectedDeviceId(val); startCamera(captureTarget, val); }}><SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Cambiar Cámara" /></SelectTrigger><SelectContent>{devices.map((device) => (<SelectItem key={device.deviceId} value={device.deviceId}>{device.label || `Cámara ${device.deviceId.slice(0, 5)}`}</SelectItem>))}</SelectContent></Select></div>}<div className="flex gap-3 w-full"><Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={stopCamera}>Cancelar</Button><Button className="flex-1 h-12 rounded-xl bg-primary text-white font-bold" onClick={takePhoto}>Capturar</Button></div></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white">
            <div className="flex items-center gap-3">
              <UserMinus className="h-6 w-6 text-red-400" />
              <DialogTitle>Baja de Confirmando</DialogTitle>
            </div>
            <DialogDescription className="text-slate-400">Procesa la baja de un alumno del sistema regular.</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="p-4 bg-orange-50 rounded-2xl text-xs text-orange-800 font-medium">Esta acción cerrará el ciclo del confirmando. No aparecerá en listas regulares.</div>
            <div className="space-y-3">
              <Label className="font-bold">Motivo de la Baja</Label>
              <Textarea placeholder="Ej. Cambio de domicilio, falta de tiempo, etc." className="rounded-xl min-h-[120px] bg-slate-50 border-slate-200" value={withdrawalReason} onChange={(e) => setWithdrawalReason(e.target.value)} required />
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setIsWithdrawDialogOpen(false)}>Cancelar</Button>
            <Button className="flex-1 h-12 rounded-xl bg-red-600 text-white font-bold shadow-lg" onClick={handleWithdrawConfirmand} disabled={isSubmitting || !withdrawalReason}>Confirmar Baja</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isProofViewOpen} onOpenChange={(open) => { setIsProofViewOpen(open); if(!open) setZoomScale(1); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl p-0 bg-transparent border-none shadow-none flex items-center justify-center overflow-visible">
          <DialogHeader className="sr-only">
            <DialogTitle>Vista de Documento</DialogTitle>
            <DialogDescription>Previsualización ampliada del documento o comprobante seleccionado.</DialogDescription>
          </DialogHeader>
          <div className="relative flex flex-col items-center w-full">
            <Button variant="secondary" size="icon" className="absolute -top-14 right-0 rounded-full text-white bg-white/20 hover:bg-white/40 border border-white/10 z-50" onClick={() => setIsProofViewOpen(false)}>
              <X className="h-6 w-6" />
            </Button>

            {!viewProofUrl?.startsWith("data:application/pdf") && (
              <div className="absolute -bottom-16 flex items-center gap-3 bg-slate-900/90 backdrop-blur-xl p-2 px-4 rounded-2xl border border-white/10 shadow-2xl z-50">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/10" onClick={() => setZoomScale(prev => Math.max(0.25, prev - 0.25))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <div className="w-14 text-center">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">{Math.round(zoomScale * 100)}%</span>
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/10" onClick={() => setZoomScale(prev => Math.min(4, prev + 0.25))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Separator orientation="vertical" className="h-4 bg-white/20 mx-1" />
                <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/10" title="Restablecer" onClick={() => setZoomScale(1)}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="w-full bg-slate-950/20 backdrop-blur-sm rounded-3xl p-2 border border-white/10 shadow-2xl overflow-hidden">
              <ScrollArea className="max-h-[75vh] w-full rounded-2xl">
                <div className="flex items-center justify-center p-4 md:p-10 min-h-[400px]">
                  {viewProofUrl?.startsWith("data:application/pdf") ? (
                    <div className="bg-white p-10 rounded-2xl flex flex-col items-center gap-4 w-[300px]">
                      <div className="p-4 bg-red-50 rounded-2xl"><FileText className="h-16 w-16 text-red-500" /></div>
                      <p className="font-bold text-center text-sm text-slate-900">Vista previa de PDF no disponible.</p>
                      <Button asChild className="w-full rounded-xl font-bold bg-red-600"><a href={viewProofUrl} download="comprobante.pdf">DESCARGAR PDF</a></Button>
                    </div>
                  ) : (
                    <div className="transition-all duration-300 ease-out flex items-center justify-center">
                      <img 
                        src={viewProofUrl || ""} 
                        className="rounded-xl shadow-2xl transition-all duration-300 select-none h-auto" 
                        style={{ 
                          width: zoomScale === 1 ? 'auto' : `${zoomScale * 100}%`,
                          maxWidth: zoomScale === 1 ? '100%' : 'none',
                          maxHeight: zoomScale === 1 ? '75vh' : 'none',
                          objectFit: 'contain'
                        }}
                        alt="Documento"
                      />
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-[450px] border-none shadow-2xl rounded-3xl overflow-hidden p-0">
          <DialogHeader className="p-6 bg-primary text-white">
            <DialogTitle>Asignar Grupo</DialogTitle>
            <DialogDescription className="text-white/80">Selecciona un grupo para el confirmando.</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-4">
            <p className="text-xs text-slate-500 font-medium italic">Selecciona el grupo de {formatCatechesisYear(selectedReg?.catechesisYear)} para {selectedReg?.fullName}:</p>
            <Select value={newGroupId} onValueChange={setNewGroupId}>
              <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200">
                <SelectValue placeholder="Elige un grupo disponible" />
              </SelectTrigger>
              <SelectContent>
                {groups?.filter(g => g.catechesisYear === selectedReg?.catechesisYear).map((g: any) => (
                  <SelectItem key={g.id} value={g.id}>{g.name} ({g.attendanceDay}s)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsAssignDialogOpen(false)}>Cancelar</Button>
            <Button className="flex-1 h-12 rounded-xl bg-primary text-white font-bold" onClick={handleAssignGroup} disabled={isSubmitting || !newGroupId}>Asignar Ahora</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-headline font-bold">¿Eliminar registro permanentemente?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">Esta acción borrará definitivamente la ficha de {selectedReg?.fullName}. No se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-3">
            <AlertDialogCancel className="flex-1 h-12 rounded-xl font-bold">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRegistration} className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold border-none">Eliminar Definitivamente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function StudentTable({ students, formatYear, getBadge, isAdmin, isTesorero, onAssignGroup, onWithdraw, onDelete, onViewDetails, onViewImage, onSort, sortConfig }: any) {
  const formatTimestamp = (ts: any) => {
    if (!ts) return "---";
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/Asuncion' }) + " - " + date.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Asuncion' });
    } catch (e) { return "---"; }
  };

  const getGenderBadge = (sexo: string) => {
    if (sexo === "M") return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 text-[10px] font-black h-5 w-5 p-0 flex items-center justify-center rounded-sm">M</Badge>;
    if (sexo === "F") return <Badge className="bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-100 text-[10px] font-black h-5 w-5 p-0 flex items-center justify-center rounded-sm">F</Badge>;
    return <Badge variant="outline" className="text-[10px] font-black h-5 w-5 p-0 flex items-center justify-center rounded-sm text-slate-300">?</Badge>;
  };

  const getSourceBadge = (reg: any) => {
    if (reg.userId === "public_registration") {
      return (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1 text-[9px] font-bold text-green-600 uppercase bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
            <Globe className="h-2.5 w-2.5" /> Público
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1 text-[9px] font-bold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
          <User className="h-2.5 w-2.5" /> Manual
        </div>
        {reg.validatedBy && (
          <span className="text-[8px] text-slate-400 font-medium truncate max-w-[80px]" title={reg.validatedBy}>
            {reg.validatedBy.split(' ')[0]}
          </span>
        )}
      </div>
    );
  };

  const getPaymentMethodBadge = (method: string) => {
    if (!method) return <span className="text-[10px] text-slate-300 italic">---</span>;
    return (
      <Badge variant="outline" className={cn(
        "text-[9px] uppercase font-black px-2 h-6 gap-1",
        method === "EFECTIVO" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
      )}>
        {method === "EFECTIVO" ? <Banknote className="h-3 w-3" /> : <ArrowRightLeft className="h-3 w-3" />}
        {method}
      </Badge>
    );
  };

  return (
    <Table><TableHeader className="bg-slate-50/30"><TableRow><TableHead className="w-[60px] pl-6"></TableHead><TableHead className="font-bold text-xs uppercase">Confirmando / Identidad</TableHead><TableHead className="font-bold text-xs uppercase text-center">Sexo</TableHead><TableHead className="font-bold text-xs uppercase text-center">Origen</TableHead><TableHead className="font-bold text-xs uppercase">Año</TableHead><TableHead className="font-bold text-xs uppercase text-center">Horario</TableHead><TableHead className="font-bold text-xs uppercase cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => onSort('createdAt')}><div className="flex items-center gap-2"><Clock className="h-3 w-3" />Fecha Insc.{sortConfig.key === 'createdAt' ? (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />) : <ArrowUpDown className="h-3 w-3 text-slate-300" />}</div></TableHead><TableHead className="font-bold text-xs uppercase text-center">Forma de Pago</TableHead><TableHead className="font-bold text-xs uppercase text-center">Saldo Pendiente</TableHead><TableHead className="font-bold text-xs uppercase text-center">Estado</TableHead><TableHead className="text-right font-bold text-xs uppercase pr-8">Acciones</TableHead></TableRow></TableHeader><TableBody>
      {students.map((reg: any) => {
        const pending = (reg.registrationCost || (reg.catechesisYear === "ADULTOS" ? 50000 : 35000)) - (reg.amountPaid || 0);
        return (
          <TableRow key={reg.id} className="hover:bg-slate-50/30 h-14">
            <TableCell className="pl-6"><Avatar className="h-8 w-8 border cursor-pointer hover:scale-110 transition-transform" onClick={() => reg.photoUrl && onViewImage(reg.photoUrl)}><AvatarImage src={reg.photoUrl} className="object-cover" /><AvatarFallback><User className="h-4 w-4" /></AvatarFallback></Avatar></TableCell>
            <TableCell>
              <div className="flex flex-col gap-0.5 py-2">
                <span className="font-bold text-slate-900 text-xs uppercase truncate max-w-[180px]" title={reg.fullName}>{reg.fullName}</span>
                <span className="text-[10px] text-primary font-bold">C.I. {reg.ciNumber}</span>
                <span className="text-[9px] text-slate-500 font-medium">{reg.phone}</span>
              </div>
            </TableCell>
            <TableCell className="text-center"><div className="flex justify-center">{getGenderBadge(reg.sexo)}</div></TableCell>
            <TableCell className="text-center"><div className="flex justify-center">{getSourceBadge(reg)}</div></TableCell>
            <TableCell><span className="text-[10px] font-bold text-slate-400">{formatYear(reg.catechesisYear)}</span></TableCell>
            <TableCell className="text-center">
              <Badge variant="outline" className="text-[9px] uppercase font-bold border-slate-200">
                {reg.attendanceDay === "SABADO" ? "Sábado" : "Domingo"}
              </Badge>
            </TableCell>
            <TableCell><span className="text-[10px] font-medium text-slate-600">{formatTimestamp(reg.createdAt)}</span></TableCell>
            <TableCell className="text-center"><div className="flex justify-center">{getPaymentMethodBadge(reg.lastPaymentMethod)}</div></TableCell>
            <TableCell className="text-center"><div className="flex flex-col items-center"><span className={cn("font-black text-xs", pending > 0 ? "text-red-500" : "text-green-600")}>{pending.toLocaleString('es-PY')}</span><span className={cn("text-[8px] font-bold uppercase", pending > 0 ? "text-red-500" : "text-green-600")}>Gs.</span></div></TableCell>
            <TableCell className="text-center">{getBadge(reg.status)}</TableCell>
            <TableCell className="text-right pr-8"><div className="flex justify-end gap-2"><Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl bg-primary/5 text-primary hover:bg-primary hover:text-white" onClick={() => onViewDetails(reg)}><Eye className="h-4 w-4" /></Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="rounded-xl p-2 shadow-xl border-none"><DropdownMenuLabel className="text-[10px] uppercase text-slate-400 px-3 py-2">Opciones</DropdownMenuLabel><DropdownMenuItem onClick={() => onAssignGroup(reg)} className="gap-2 h-10 rounded-lg cursor-pointer"><UserPlus className="h-4 w-4" /> Asignar Grupo</DropdownMenuItem><DropdownMenuSeparator />{(isAdmin || isTesorero) && (<><DropdownMenuItem onClick={() => onWithdraw(reg)} className="text-orange-600 gap-2 h-10 rounded-lg cursor-pointer"><UserMinus className="h-4 w-4" /> Dar de Baja</DropdownMenuItem><DropdownMenuItem onClick={() => onDelete(reg)} className="text-destructive gap-2 h-10 rounded-lg cursor-pointer"><Trash2 className="h-4 w-4" /> Eliminar Ficha</DropdownMenuItem></>)}</DropdownMenuContent></DropdownMenu></div></TableCell>
          </TableRow>
        )
      })}
    </TableBody></Table>
  )
}
