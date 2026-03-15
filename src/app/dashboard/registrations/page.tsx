
"use client"

import { useState, useMemo, useEffect, useRef } from "react"
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
  X
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

// Componente de Formulario de Edición
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
  
  const editPhotoInputRef = useRef<HTMLInputElement>(null)
  const editBaptismInputRef = useRef<HTMLInputElement>(null)
  const editPaymentProofInputRef = useRef<HTMLInputElement>(null)
  
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

  const handleFileEdit = async (e: React.ChangeEvent<HTMLInputElement>, target: "photo" | "baptism" | "paymentProof") => {
    const file = e.target.files?.[0]
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      const setPreview = (val: string) => {
        if (target === "photo") setEditPhotoPreview(val);
        else if (target === "baptism") setEditBaptismPreview(val);
        else setEditPaymentProofPreview(val);
      };
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

  return (
    <form onSubmit={handleEditRegistration} className="flex-1 overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto p-6 bg-white space-y-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-400">Foto Perfil</Label>
            <div className="relative h-32 w-full rounded-2xl border-2 border-dashed flex items-center justify-center bg-slate-50 overflow-hidden">
              {editPhotoPreview ? <img src={editPhotoPreview} className="h-full w-full object-cover" /> : <User className="h-10 w-10 text-slate-200" />}
              <div className="absolute bottom-2 right-2 flex gap-1">
                <Button type="button" size="icon" variant="secondary" className="h-7 w-7 rounded-full" onClick={() => editPhotoInputRef.current?.click()}><ImageIcon className="h-3.5 w-3.5" /></Button>
                <input type="file" ref={editPhotoInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileEdit(e, "photo")} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-400">Cert. Bautismo</Label>
            <div className="relative h-32 w-full rounded-2xl border-2 border-dashed flex items-center justify-center bg-slate-50 overflow-hidden">
              {editBaptismPreview ? <img src={editBaptismPreview} className="h-full w-full object-cover" /> : <ImageIcon className="h-10 w-10 text-slate-200" />}
              <div className="absolute bottom-2 right-2 flex gap-1">
                <Button type="button" size="icon" variant="secondary" className="h-7 w-7 rounded-full" onClick={() => editBaptismInputRef.current?.click()}><ImageIcon className="h-3.5 w-3.5" /></Button>
                <input type="file" ref={editBaptismInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileEdit(e, "baptism")} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-400">Comp. Pago</Label>
            <div className="relative h-32 w-full rounded-2xl border-2 border-dashed flex items-center justify-center bg-slate-50 overflow-hidden">
              {editPaymentProofPreview ? <img src={editPaymentProofPreview} className="h-full w-full object-cover" /> : <Wallet className="h-10 w-10 text-slate-200" />}
              <div className="absolute bottom-2 right-2 flex gap-1">
                <Button type="button" size="icon" variant="secondary" className="h-7 w-7 rounded-full" onClick={() => editPaymentProofInputRef.current?.click()}><ImageIcon className="h-3.5 w-3.5" /></Button>
                <input type="file" ref={editPaymentProofInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileEdit(e, "paymentProof")} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Nombre Completo</Label><Input name="fullName" defaultValue={selectedReg?.fullName} className="uppercase font-bold" /></div>
            <div className="space-y-2">
              <Label>Sexo</Label>
              <Select value={editGender} onValueChange={setEditGender}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Femenino</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>C.I. N°</Label><Input name="ciNumber" defaultValue={selectedReg?.ciNumber} /></div>
            <div className="space-y-2"><Label>Celular</Label><Input name="phone" defaultValue={selectedReg?.phone} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Año Catequesis</Label>
              <Select value={editCatechesisYear} onValueChange={setEditCatechesisYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="PRIMER_AÑO">1° Año</SelectItem><SelectItem value="SEGUNDO_AÑO">2° Año</SelectItem><SelectItem value="ADULTOS">Adultos</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Día Asistencia</Label>
              <Select value={editAttendanceDay} onValueChange={setEditAttendanceDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="SABADO">Sábados</SelectItem><SelectItem value="DOMINGO">Domingos</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Forma de Pago</Label>
              <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  <SelectItem value="NONE">Sin Pago / Pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Monto Cobrado (Gs)</Label>
              <Input type="number" value={editAmountPaid} onChange={(e) => setEditAmountPaid(Number(e.target.value))} className="font-black text-primary" />
            </div>
          </div>
        </div>
      </div>
      <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3 shrink-0">
        <Button type="button" variant="outline" className="flex-1 h-12" onClick={onClose}>Cancelar</Button>
        <Button type="submit" className="flex-1 h-12 bg-slate-900 text-white font-bold" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4 mr-2" />} Guardar</Button>
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

  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isValidationOpen, setIsValidationOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [valAmount, setValAmount] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [zoomScale, setZoomScale] = useState(1)

  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()

  useEffect(() => { setMounted(true) }, [])

  const userProfileRef = useMemoFirebase(() => db && user?.uid ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc(userProfileRef)

  const registrationsQuery = useMemoFirebase(() => db ? query(collection(db, "confirmations"), orderBy("createdAt", "desc"), limit(200)) : null, [db])
  const { data: registrations, loading: loadingRegs } = useCollection(registrationsQuery)

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
      return matchesSearch && matchesSex && matchesYear && matchesStatus;
    })
  }, [registrations, searchTerm, filterSex, filterYear, filterStatus])

  const resetFilters = () => {
    setSearchTerm("")
    setFilterSex("all")
    setFilterYear("all")
    setFilterStatus("all")
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
        <CardHeader className="bg-slate-50/50 border-b p-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Buscar por Nombre o C.I..." className="pl-10 h-11 rounded-xl bg-white border-slate-200 shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={filterSex} onValueChange={setFilterSex}>
                <SelectTrigger className="w-[130px] h-11 rounded-xl bg-white shadow-sm"><SelectValue placeholder="Sexo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Sexos</SelectItem>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Femenino</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-[150px] h-11 rounded-xl bg-white shadow-sm"><SelectValue placeholder="Nivel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Niveles</SelectItem>
                  <SelectItem value="PRIMER_AÑO">1° Año</SelectItem>
                  <SelectItem value="SEGUNDO_AÑO">2° Año</SelectItem>
                  <SelectItem value="ADULTOS">Adultos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px] h-11 rounded-xl bg-white shadow-sm"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Estados</SelectItem>
                  <SelectItem value="INSCRITO">Inscrito</SelectItem>
                  <SelectItem value="POR_VALIDAR">Por Validar</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl hover:bg-slate-200" onClick={resetFilters} title="Limpiar Filtros"><FilterX className="h-4 w-4 text-slate-500" /></Button>
            </div>
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
                  const creator = allUsers?.find(u => u.id === reg.userId);
                  const isManual = reg.userId !== "public_registration";
                  const hasProof = !!reg.paymentProofUrl;
                  const isEfectivo = reg.lastPaymentMethod === "EFECTIVO" || reg.paymentMethod === "EFECTIVO";
                  
                  return (
                    <TableRow key={reg.id} className="h-20 hover:bg-slate-50/50 transition-colors">
                      <TableCell className="pl-8">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-10 w-10 border shadow-sm"><AvatarImage src={reg.photoUrl} className="object-cover" /><AvatarFallback><User /></AvatarFallback></Avatar>
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
                      <TableCell><Badge variant="outline" className="text-[9px] uppercase">{reg.catechesisYear?.replace("_", " ")}</Badge></TableCell>
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
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl h-[90vh] flex flex-col">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 border-2 border-white/20">
                  <AvatarImage src={selectedReg?.photoUrl} className="object-cover" />
                  <AvatarFallback className="bg-white/10 text-white"><User /></AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-xl uppercase font-black tracking-tight">{selectedReg?.fullName}</DialogTitle>
                  <DialogDescription className="text-white/70">Ficha de Inscripción 2026</DialogDescription>
                </div>
              </div>
              <Badge className="bg-white/20 text-white border-none uppercase text-[10px]">{selectedReg?.catechesisYear?.replace('_', ' ')}</Badge>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 bg-slate-50">
            <div className="p-8 space-y-10">
              {/* SECCIÓN 1: DATOS PERSONALES */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                  <User className="h-3 w-3" /> Información del Postulante
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-3xl border shadow-sm">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Cédula N°</Label>
                    <p className="text-sm font-bold text-slate-900">{selectedReg?.ciNumber}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Nacimiento</Label>
                    <p className="text-sm font-bold text-slate-900">{selectedReg?.birthDate} ({selectedReg?.age} años)</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Celular</Label>
                    <p className="text-sm font-bold text-slate-900">{selectedReg?.phone}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Sexo</Label>
                    <p className="text-sm font-bold text-slate-900">{selectedReg?.sexo === 'M' ? 'Masculino' : 'Femenino'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Horario</Label>
                    <p className="text-sm font-bold text-slate-900">{selectedReg?.attendanceDay === 'SABADO' ? 'Sábados' : 'Domingos'}</p>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: PADRES / TUTORES */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                  <Users className="h-3 w-3" /> Padres / Tutores
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-3xl border shadow-sm">
                  <div className="space-y-3">
                    <Label className="text-[9px] font-black text-slate-400 uppercase border-b pb-1 block">Madre</Label>
                    <p className="text-sm font-bold text-slate-900">{selectedReg?.motherName || 'No registrado'}</p>
                    {selectedReg?.motherPhone && <p className="text-xs text-slate-500 flex items-center gap-2"><Phone className="h-3 w-3" /> {selectedReg.motherPhone}</p>}
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[9px] font-black text-slate-400 uppercase border-b pb-1 block">Padre</Label>
                    <p className="text-sm font-bold text-slate-900">{selectedReg?.fatherName || 'No registrado'}</p>
                    {selectedReg?.fatherPhone && <p className="text-xs text-slate-500 flex items-center gap-2"><Phone className="h-3 w-3" /> {selectedReg.fatherPhone}</p>}
                  </div>
                </div>
              </div>

              {/* SECCIÓN 3: VIDA SACRAMENTAL */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                  <BookOpen className="h-3 w-3" /> Vida Sacramental
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 rounded-3xl border shadow-sm">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                      <span className="text-xs font-bold text-slate-600">¿Tiene Bautismo?</span>
                      {selectedReg?.hasBaptism ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <X className="h-5 w-5 text-red-400" />}
                    </div>
                    {selectedReg?.hasBaptism && (
                      <div className="space-y-3 pl-2">
                        <div className="grid grid-cols-3 gap-2">
                          <div><Label className="text-[8px] font-bold text-slate-400 uppercase">Libro</Label><p className="text-xs font-bold">{selectedReg.baptismBook || '-'}</p></div>
                          <div><Label className="text-[8px] font-bold text-slate-400 uppercase">Folio</Label><p className="text-xs font-bold">{selectedReg.baptismFolio || '-'}</p></div>
                          <div><Label className="text-[8px] font-bold text-slate-400 uppercase">Parroquia</Label><p className="text-xs font-bold">{selectedReg.baptismParish || '-'}</p></div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                      <span className="text-xs font-bold text-slate-600">¿Hizo la Comunión?</span>
                      {selectedReg?.hasFirstCommunion ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <X className="h-5 w-5 text-red-400" />}
                    </div>
                  </div>
                  {selectedReg?.baptismCertificatePhotoUrl && (
                    <div className="space-y-2">
                      <Label className="text-[9px] font-black text-slate-400 uppercase">Foto Certificado</Label>
                      <div className="relative aspect-video rounded-2xl overflow-hidden border shadow-inner bg-slate-100 flex items-center justify-center">
                        <img src={selectedReg.baptismCertificatePhotoUrl} className="object-contain max-h-full" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SECCIÓN 4: CUENTA Y PAGOS */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                  <Wallet className="h-3 w-3" /> Cuenta y Pagos
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 rounded-3xl border shadow-sm">
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-900 text-white rounded-[2rem] space-y-1">
                      <p className="text-[8px] font-black text-white/50 uppercase tracking-widest">Saldo Recaudado</p>
                      <p className="text-2xl font-black">{selectedReg?.amountPaid?.toLocaleString('es-PY')} Gs.</p>
                      <Badge className="bg-white/20 text-white border-none text-[9px] uppercase">{selectedReg?.paymentStatus}</Badge>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] font-bold text-slate-400 uppercase">Forma de Pago Principal</Label>
                      <p className="text-sm font-bold text-slate-900">{selectedReg?.lastPaymentMethod || selectedReg?.paymentMethod}</p>
                    </div>
                    {selectedReg?.receiptNumber && (
                      <div className="space-y-1">
                        <Label className="text-[9px] font-bold text-slate-400 uppercase">N° Recibo Oficial</Label>
                        <p className="text-sm font-black text-primary font-mono">{selectedReg.receiptNumber}</p>
                      </div>
                    )}
                  </div>
                  {selectedReg?.paymentProofUrl && (
                    <div className="space-y-2">
                      <Label className="text-[9px] font-black text-slate-400 uppercase">Comprobante Adjunto</Label>
                      <div className="relative aspect-video rounded-2xl overflow-hidden border shadow-inner bg-slate-100 flex items-center justify-center">
                        <img src={selectedReg.paymentProofUrl} className="object-contain max-h-full" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setIsDetailsDialogOpen(false)}>Cerrar</Button>
            <Button className="flex-1 h-12 bg-primary text-white rounded-xl font-bold gap-2 shadow-lg" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir Ficha
            </Button>
          </DialogFooter>
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

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[95vh] p-0 overflow-hidden flex flex-col rounded-3xl border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary text-white shrink-0"><DialogTitle>Editar Ficha de Confirmando</DialogTitle></DialogHeader>
          <EditRegistrationForm selectedReg={selectedReg} profile={profile} onClose={() => setIsEditDialogOpen(false)} onSaveSuccess={() => setIsEditDialogOpen(false)} />
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
