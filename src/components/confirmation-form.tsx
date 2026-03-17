
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { 
  Loader2, 
  User,
  Church,
  Camera,
  CheckCircle2,
  Wallet,
  ImageIcon,
  BookOpen,
  UserPlus,
  X,
  CreditCard,
  FileText,
  Search,
  Book,
  Users,
  Banknote,
  ArrowRightLeft,
  Clock,
  ChevronRight,
  Printer,
  Download,
  Share2,
  Copy,
  Info,
  Building2,
  MessageCircle,
  UserCheck,
  AlertTriangle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase"
import { doc, setDoc, getDoc, getDocs, query, where, serverTimestamp, collection, increment, updateDoc, runTransaction } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Link from "next/link"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { QRCodeCanvas } from "qrcode.react"

const formSchema = z.object({
  fullName: z.string().min(5, "Nombre completo requerido"),
  ciNumber: z.string().min(5, "N° C.I. requerido"),
  phone: z.string().min(6, "N° de celular requerido"),
  birthDate: z.string().min(1, "Fecha de nacimiento requerida"),
  age: z.coerce.number().optional(),
  sexo: z.string().min(1, "Seleccione sexo"),
  photoUrl: z.string().optional(),
  paymentMethod: z.enum(["EFECTIVO", "TRANSFERENCIA", "SIN_PAGO"], {
    required_error: "Debe seleccionar un método de pago",
  }),
  registrationCost: z.coerce.number().min(0, "Monto inválido"),
  paymentProofUrl: z.string().optional(),
  motherName: z.string().optional(),
  motherPhone: z.string().optional(),
  fatherName: z.string().optional(),
  fatherPhone: z.string().optional(),
  tutorName: z.string().optional(),
  tutorPhone: z.string().optional(),
  catechesisYear: z.enum(["PRIMER_AÑO", "SEGUNDO_AÑO", "ADULTOS"], {
    required_error: "Debe seleccionar un año de catequesis",
  }),
  attendanceDay: z.enum(["SABADO", "DOMINGO"], {
    required_error: "Debe seleccionar un día de asistencia",
  }),
  hasBaptism: z.boolean().default(false),
  hasFirstCommunion: z.boolean().default(false),
  baptismParish: z.string().optional(),
  baptismBook: z.string().optional(),
  baptismFolio: z.string().optional(),
  baptismCertificatePhotoUrl: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>
type CaptureTarget = "STUDENT_PHOTO" | "PAYMENT_PROOF" | "BAPTISM_CERT"

export function ConfirmationForm({ isPublic = false }: { isPublic?: boolean }) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isSearchingCi, setIsSearchingCi] = useState(false)
  
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [baptismPreview, setBaptismPreview] = useState<string | null>(null)
  
  const [isSubmittedSuccessfully, setIsSubmittedSuccessfully] = useState(false)
  const [submittedData, setSubmittedData] = useState<any>(null)

  const [showCamera, setShowCamera] = useState(false)
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget>("STUDENT_PHOTO")
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null)
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null)
  
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const proofInputRef = useRef<HTMLInputElement>(null)
  const baptismInputRef = useRef<HTMLInputElement>(null)
  
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()

  useEffect(() => {
    setMounted(true)
  }, [])

  const treasuryRef = useMemoFirebase(() => {
    if (!db) return null
    return doc(db, "settings", "treasury")
  }, [db])
  const { data: costs } = useDoc(treasuryRef)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "", ciNumber: "", phone: "", birthDate: "", age: 0, sexo: "",
      photoUrl: "", paymentMethod: isPublic ? "TRANSFERENCIA" : "EFECTIVO",
      registrationCost: 35000, paymentProofUrl: "", motherName: "", motherPhone: "",
      fatherName: "", fatherPhone: "", tutorName: "", tutorPhone: "",
      hasBaptism: false, hasFirstCommunion: false, baptismParish: "",
      baptismBook: "", baptismFolio: "", baptismCertificatePhotoUrl: "",
    },
  })

  const { watch, setValue, setError, clearErrors } = form
  const birthDate = watch("birthDate")
  const hasBaptism = watch("hasBaptism")
  const catechesisYear = watch("catechesisYear")
  const paymentMethod = watch("paymentMethod")
  const registrationCost = watch("registrationCost")

  const establishedLimit = catechesisYear === "ADULTOS" ? (costs?.adultCost || 50000) : (costs?.juvenileCost || 35000)

  useEffect(() => {
    if (catechesisYear) setValue("registrationCost", establishedLimit)
  }, [catechesisYear, establishedLimit, setValue])

  useEffect(() => {
    if (registrationCost > establishedLimit) {
      setValue("registrationCost", establishedLimit)
      toast({ title: "Límite superado", description: `El máximo es ${establishedLimit.toLocaleString('es-PY')} Gs.` })
    }
  }, [registrationCost, establishedLimit, setValue, toast])

  useEffect(() => {
    if (birthDate) {
      const birth = new Date(birthDate)
      const now = new Date()
      let calculatedAge = now.getFullYear() - birth.getFullYear()
      const m = now.getMonth() - birth.getMonth()
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) calculatedAge--
      setValue("age", calculatedAge >= 0 ? calculatedAge : 0)
    }
  }, [birthDate, setValue])

  const compressImage = (source: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new (window as any).Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 1024;
        let width = img.width; let height = img.height;
        if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
        else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8)); 
      };
      img.onerror = (e: any) => reject(e);
      img.src = source;
    });
  };

  const onVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node && currentStream) {
      if (node.srcObject !== currentStream) {
        node.srcObject = currentStream;
        node.play().catch(err => { if (err.name !== 'AbortError') console.error(err); });
      }
    }
    videoRef.current = node;
  }, [currentStream]);

  const startCamera = async (target: CaptureTarget, deviceId?: string) => {
    setCaptureTarget(target)
    try {
      if (currentStream) currentStream.getTracks().forEach(track => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: deviceId ? undefined : "environment" }
      })
      setCurrentStream(stream); setHasCameraPermission(true);
      const devices = await navigator.mediaDevices.enumerateDevices();
      setDevices(devices.filter(d => d.kind === 'videoinput')); setShowCamera(true);
    } catch (error) { setHasCameraPermission(false); toast({ variant: 'destructive', title: 'Error cámara' }); }
  }

  const stopCamera = () => { if (currentStream) currentStream.getTracks().forEach(track => track.stop()); setCurrentStream(null); setShowCamera(false); }

  const takePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      const optimized = await compressImage(canvas.toDataURL('image/jpeg', 0.9));
      if (captureTarget === "STUDENT_PHOTO") { setPhotoPreview(optimized); setValue("photoUrl", optimized); }
      else if (captureTarget === "PAYMENT_PROOF") { setProofPreview(optimized); setValue("paymentProofUrl", optimized); }
      else if (captureTarget === "BAPTISM_CERT") { setBaptismPreview(optimized); setValue("baptismCertificatePhotoUrl", optimized); }
      stopCamera();
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof FormValues) => {
    const file = e.target.files?.[0]
    if (file) {
      const objectUrl = URL.createObjectURL(file)
      try {
        const optimized = await compressImage(objectUrl)
        if (fieldName === "photoUrl") { setPhotoPreview(optimized); setValue("photoUrl", optimized); }
        else if (fieldName === "paymentProofUrl") { setProofPreview(optimized); setValue("paymentProofUrl", optimized); }
        else if (fieldName === "baptismCertificatePhotoUrl") { setBaptismPreview(optimized); setValue("baptismCertificatePhotoUrl", optimized); }
      } finally { URL.revokeObjectURL(objectUrl); }
    }
  }

  const handleLookupCi = async (ciValue: string) => {
    if (!db || !ciValue || ciValue.length < 5) return;
    setIsSearchingCi(true); clearErrors("ciNumber");
    const cleanCi = ciValue.replace(/[^0-9]/g, '');
    try {
      const ciCheckQuery = query(collection(db, "confirmations"), where("ciNumber", "in", [ciValue, cleanCi]), where("isArchived", "==", false));
      const querySnapshot = await getDocs(ciCheckQuery);
      if (!querySnapshot.empty) {
        setError("ciNumber", { type: "manual", message: "Esta persona ya se encuentra registrada." });
        setIsSearchingCi(false); return;
      }
      const docSnap = await getDoc(doc(db, "cedulas", cleanCi));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.NOMBRE && data.APELLIDO) setValue("fullName", `${data.NOMBRE} ${data.APELLIDO}`.toUpperCase());
        if (data.NOM_MADRE) setValue("motherName", data.NOM_MADRE.toUpperCase());
        if (data.NOM_PADRE) setValue("fatherName", data.NOM_PADRE.toUpperCase());
        if (data.FECHA_NACI) setValue("birthDate", data.FECHA_NACI);
        if (data.SEXO) { const s = String(data.SEXO).toUpperCase(); if (s.startsWith('M')) setValue("sexo", "M"); else if (s.startsWith('F')) setValue("sexo", "F"); }
        toast({ title: "Datos precargados" });
      }
    } finally { setIsSearchingCi(false); }
  }

  const handleRegistration = async (values: FormValues) => {
    if (!db) return;
    setLoading(true);
    try {
      const regId = `conf_${Date.now()}`;
      const isEfectivo = values.paymentMethod === "EFECTIVO";
      const regCost = Number(values.registrationCost);
      const finalStatus = isEfectivo ? "INSCRITO" : "POR_VALIDAR";
      const finalAmountPaid = isEfectivo ? regCost : 0;
      const finalPaymentStatus = isEfectivo ? (regCost >= establishedLimit ? "PAGADO" : "PARCIAL") : "PENDIENTE";

      const regData = {
        fullName: values.fullName || "", ciNumber: values.ciNumber || "", phone: values.phone || "",
        birthDate: values.birthDate || "", age: values.age || 0, sexo: values.sexo || "",
        photoUrl: values.photoUrl || null, paymentMethod: values.paymentMethod,
        lastPaymentMethod: values.paymentMethod === "SIN_PAGO" ? null : values.paymentMethod,
        paymentProofUrl: values.paymentProofUrl || null, motherName: values.motherName || null,
        motherPhone: values.motherPhone || null, fatherName: values.fatherName || null,
        fatherPhone: values.fatherPhone || null, catechesisYear: values.catechesisYear,
        attendanceDay: values.attendanceDay, hasBaptism: !!values.hasBaptism,
        hasFirstCommunion: !!values.hasFirstCommunion, baptismParish: values.baptismParish || null,
        baptismBook: values.baptismBook || null, baptismFolio: values.baptismFolio || null,
        baptismCertificatePhotoUrl: values.baptismCertificatePhotoUrl || null,
        userId: user?.uid || (isPublic ? "public_registration" : "manual"),
        status: finalStatus, paymentStatus: finalPaymentStatus, amountPaid: finalAmountPaid,
        registrationCost: regCost, isArchived: false, createdAt: serverTimestamp()
      }

      // USO DE TRANSACCIÓN PARA ASEGURAR INTEGRIDAD DE ESTADÍSTICAS
      await runTransaction(db, async (transaction) => {
        const statsRef = doc(db, "settings", "stats");
        transaction.set(doc(db, "confirmations", regId), regData);
        
        const updateObj: any = { total: increment(1) };
        if (regData.catechesisYear === "PRIMER_AÑO") {
          updateObj.firstYear = increment(1);
          if (regData.attendanceDay === "SABADO") updateObj.firstYearSabado = increment(1); else updateObj.firstYearDomingo = increment(1);
        } else if (regData.catechesisYear === "SEGUNDO_AÑO") {
          updateObj.secondYear = increment(1);
          if (regData.attendanceDay === "SABADO") updateObj.secondYearSabado = increment(1); else updateObj.secondYearDomingo = increment(1);
        } else if (regData.catechesisYear === "ADULTOS") {
          updateObj.adults = increment(1);
          if (regData.attendanceDay === "SABADO") updateObj.adultsSabado = increment(1); else updateObj.adultsDomingo = increment(1);
        }
        transaction.update(statsRef, updateObj);
      });

      setSubmittedData({ ...regData, id: regId, timestamp: new Date() });
      setIsSubmittedSuccessfully(true);
      toast({ title: "Inscripción exitosa" });
    } catch (e) { toast({ variant: "destructive", title: "Error" }); }
    finally { setLoading(false); }
  }

  const ImageInputSection = ({ title, preview, onCamera, onFile, target, isCircle = false }: any) => (
    <div className="space-y-2">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{title}</p>
      <div className={cn("relative group mx-auto", isCircle ? "w-40 h-40" : "w-full")}>
        <div className={cn("w-full h-full border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden flex flex-col items-center justify-center cursor-pointer shadow-inner", isCircle ? "rounded-full" : "h-40 rounded-3xl")} onClick={onCamera}>
          {preview ? <img src={preview} className="h-full w-full object-cover" /> : <div className="text-center space-y-2"><Camera className="h-8 w-8 text-slate-300 mx-auto" /><p className="text-[8px] font-bold text-slate-400 uppercase">Tocar para capturar</p></div>}
        </div>
        <div className="flex justify-center gap-2 mt-2">
          <Button type="button" variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase rounded-xl" onClick={onCamera}><Camera className="h-3.5 w-3.5 mr-1.5" /> Cámara</Button>
          <Button type="button" variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase rounded-xl" onClick={onFile}><ImageIcon className="h-3.5 w-3.5 mr-1.5" /> Galería</Button>
        </div>
      </div>
    </div>
  )

  if (isSubmittedSuccessfully) {
    return (
      <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden max-w-2xl mx-auto animate-in zoom-in-95 duration-500 no-print">
        <div className="bg-primary p-12 text-center text-white space-y-6">
          <div className="h-24 w-24 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/30 animate-bounce"><CheckCircle2 className="h-12 w-12 text-white" /></div>
          <div className="space-y-2"><h2 className="text-4xl font-headline font-black tracking-tight uppercase">¡REGISTRO EXITOSO!</h2><p className="text-white/80 font-medium">Ficha enviada al Santuario.</p></div>
        </div>
        <CardContent className="p-10 space-y-8">
          <div className="p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-center space-y-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">N° de Comprobante Provisional</p>
            <p className="text-2xl font-black text-primary font-mono">{submittedData?.id.split('_')[1]}</p>
            <div className="h-px w-20 bg-slate-200 mx-auto"></div>
            <p className="text-sm font-bold text-slate-600 uppercase">{submittedData?.fullName}</p>
          </div>
        </CardContent>
        <CardFooter className="bg-slate-50 p-8">
          <Button className="w-full h-14 rounded-2xl font-black gap-2 bg-slate-900 text-white" asChild><Link href={isPublic ? "/" : "/dashboard"}>FINALIZAR <ChevronRight className="h-5 w-5" /></Link></Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden max-w-4xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleRegistration)}>
          <CardHeader className="bg-primary text-white p-8"><CardTitle className="text-2xl font-headline font-bold">Ficha de Inscripción 2026</CardTitle></CardHeader>
          <CardContent className="p-8 space-y-12">
            <ImageInputSection title="Foto del Postulante" preview={photoPreview} onCamera={() => startCamera("STUDENT_PHOTO")} onFile={() => fileInputRef.current?.click()} target="STUDENT_PHOTO" isCircle={true} />
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "photoUrl")} />
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2"><UserPlus className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg">Datos Personales</h3></div>
              <div className="grid gap-6 md:grid-cols-2">
                <FormField control={form.control} name="ciNumber" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">N° de C.I. *</FormLabel><div className="flex gap-2"><FormControl><Input placeholder="Sin puntos" {...field} className="h-12 rounded-xl" /></FormControl><Button type="button" onClick={() => handleLookupCi(field.value)} disabled={isSearchingCi} className="h-12 px-6 rounded-xl font-bold bg-primary">{isSearchingCi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button></div><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="fullName" render={({ field }) => (<FormItem><FormLabel className="font-bold">Nombre Completo *</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl uppercase font-bold" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel className="font-bold">Celular *</FormLabel><FormControl><Input placeholder="09XX XXX XXX" {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="birthDate" render={({ field }) => (<FormItem><FormLabel className="font-bold">Nacimiento *</FormLabel><FormControl><Input type="date" {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="sexo" render={({ field }) => (<FormItem><FormLabel className="font-bold">Sexo *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Femenino</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2"><Church className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg">Inscripción Académica</h3></div>
              <div className="grid gap-6 md:grid-cols-2">
                <FormField control={form.control} name="catechesisYear" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">Nivel *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Nivel" /></SelectTrigger></FormControl><SelectContent><SelectItem value="PRIMER_AÑO">1° Año</SelectItem><SelectItem value="SEGUNDO_AÑO">2° Año</SelectItem><SelectItem value="ADULTOS">Adultos</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="attendanceDay" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">Horario *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Horario" /></SelectTrigger></FormControl><SelectContent><SelectItem value="SABADO">Sábados (15:30)</SelectItem><SelectItem value="DOMINGO">Domingos (08:00)</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2"><Wallet className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg">Método de Pago</h3></div>
              <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                <FormItem className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {!isPublic && (<div onClick={() => field.onChange("EFECTIVO")} className={cn("cursor-pointer p-4 rounded-2xl border-2 flex flex-col items-center gap-2", field.value === "EFECTIVO" ? "border-primary bg-primary/5" : "border-slate-100")}><Banknote className={cn("h-6 w-6", field.value === "EFECTIVO" ? "text-primary" : "text-slate-400")} /><span className="text-xs font-bold uppercase">Efectivo</span></div>)}
                  <div onClick={() => field.onChange("TRANSFERENCIA")} className={cn("cursor-pointer p-4 rounded-2xl border-2 flex flex-col items-center gap-2", field.value === "TRANSFERENCIA" ? "border-primary bg-primary/5" : "border-slate-100", isPublic && "sm:col-span-3")}><ArrowRightLeft className={cn("h-6 w-6", field.value === "TRANSFERENCIA" ? "text-primary" : "text-slate-400")} /><span className="text-xs font-bold uppercase">Transferencia</span></div>
                  {!isPublic && (<div onClick={() => field.onChange("SIN_PAGO")} className={cn("cursor-pointer p-4 rounded-2xl border-2 flex flex-col items-center gap-2", field.value === "SIN_PAGO" ? "border-primary bg-primary/5" : "border-slate-100")}><Clock className={cn("h-6 w-6", field.value === "SIN_PAGO" ? "text-primary" : "text-slate-400")} /><span className="text-xs font-bold uppercase">Sin pago</span></div>)}
                </FormItem>
              )} />
            </div>
          </CardContent>
          <CardFooter className="bg-slate-50 p-10 flex flex-col gap-6">
            <Button type="submit" disabled={loading} className="w-full h-16 bg-primary text-white rounded-2xl text-xl font-bold shadow-2xl active:scale-95 transition-all">
              {loading ? <Loader2 className="animate-spin h-6 w-6 mr-2" /> : <><UserPlus className="mr-2 h-6 w-6" /> ENVIAR INSCRIPCIÓN</>}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  )
}
