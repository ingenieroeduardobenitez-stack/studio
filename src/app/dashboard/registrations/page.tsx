
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
  Download,
  MessageCircle,
  Receipt
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, updateDoc, deleteDoc, serverTimestamp, addDoc, runTransaction, writeBatch, getDoc, query, orderBy, limit, where } from "firebase/firestore"
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
import { QRCodeCanvas } from "qrcode.react"
import Image from "next/image"

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

    // CALCULO DE COSTO ESTABLECIDO PARA COMPARAR
    const regCost = selectedReg.registrationCost || (editCatechesisYear === "ADULTOS" ? 50000 : 35000);

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
      // LÓGICA DE ACTUALIZACIÓN DE ESTADO SEGÚN MONTO PARA EFECTIVO
      updateData.paymentStatus = updateData.amountPaid >= regCost ? "PAGADO" : (updateData.amountPaid > 0 ? "PARCIAL" : "PENDIENTE");
      
      if (editPaymentMethod === "EFECTIVO" && updateData.amountPaid > 0) {
        updateData.status = "INSCRITO";
      } else if (editPaymentMethod === "TRANSFERENCIA" && selectedReg.status === "POR_VALIDAR") {
        // Mantener por validar si es transferencia y no ha sido validado formalmente por el botón
        updateData.status = "POR_VALIDAR";
      } else {
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
          details: `Se actualizaron los datos de la ficha de: ${updateData.fullName}. Monto: ${updateData.amountPaid}`,
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
  // ... resto del componente permanece igual
}
