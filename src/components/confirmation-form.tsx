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
  MessageCircle
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
import { doc, setDoc, getDoc, serverTimestamp, collection } from "firebase/firestore"
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
      fullName: "",
      ciNumber: "",
      phone: "",
      birthDate: "",
      age: 0,
      sexo: "",
      photoUrl: "",
      paymentMethod: isPublic ? "TRANSFERENCIA" : "EFECTIVO",
      registrationCost: 35000,
      paymentProofUrl: "",
      motherName: "",
      motherPhone: "",
      fatherName: "",
      fatherPhone: "",
      tutorName: "",
      tutorPhone: "",
      hasBaptism: false,
      hasFirstCommunion: false,
      baptismParish: "",
      baptismBook: "",
      baptismFolio: "",
      baptismCertificatePhotoUrl: "",
    },
  })

  const { watch, setValue } = form
  const birthDate = watch("birthDate")
  const hasBaptism = watch("hasBaptism")
  const catechesisYear = watch("catechesisYear")
  const paymentMethod = watch("paymentMethod")
  const registrationCost = watch("registrationCost")

  const establishedLimit = catechesisYear === "ADULTOS" ? (costs?.adultCost || 50000) : (costs?.juvenileCost || 35000)

  useEffect(() => {
    if (catechesisYear) {
      setValue("registrationCost", establishedLimit)
    }
  }, [catechesisYear, establishedLimit, setValue])

  useEffect(() => {
    if (registrationCost > establishedLimit) {
      setValue("registrationCost", establishedLimit)
      toast({
        title: "Límite superado",
        description: `El monto máximo para esta categoría es de ${establishedLimit.toLocaleString('es-PY')} Gs.`,
      })
    }
  }, [registrationCost, establishedLimit, setValue, toast])

  useEffect(() => {
    if (birthDate) {
      const birth = new Date(birthDate)
      const now = new Date()
      let calculatedAge = now.getFullYear() - birth.getFullYear()
      const m = now.getMonth() - birth.getMonth()
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
        calculatedAge--
      }
      setValue("age", calculatedAge >= 0 ? calculatedAge : 0)
    }
  }, [birthDate, setValue])

  const compressImage = (source: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new (window as any).Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 1024;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
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
        video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1920 }, height: { ideal: 1080 } }
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
      if (captureTarget === "STUDENT_PHOTO") { setPhotoPreview(optimized); setValue("photoUrl", optimized); }
      else if (captureTarget === "PAYMENT_PROOF") { setProofPreview(optimized); setValue("paymentProofUrl", optimized); }
      else if (captureTarget === "BAPTISM_CERT") { setBaptismPreview(optimized); setValue("baptismCertificatePhotoUrl", optimized); }
      stopCamera()
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof FormValues) => {
    const file = e.target.files?.[0]
    if (file) {
      const objectUrl = URL.createObjectURL(file)
      try {
        const optimized = await compressImage(objectUrl)
        if (fieldName === "photoUrl") {
          setPhotoPreview(optimized)
          setValue("photoUrl", optimized)
        } else if (fieldName === "paymentProofUrl") {
          setProofPreview(optimized)
          setValue("paymentProofUrl", optimized)
        } else if (fieldName === "baptismCertificatePhotoUrl") {
          setBaptismPreview(optimized)
          setValue("baptismCertificatePhotoUrl", optimized)
        }
      } catch (err) {
        console.error("Error al procesar imagen:", err)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }

  const handleLookupCi = async (ciValue: string) => {
    if (!db || !ciValue || ciValue.length < 5) return;
    setIsSearchingCi(true);
    const cleanCi = ciValue.replace(/[^0-9]/g, '');
    try {
      const docSnap = await getDoc(doc(db, "cedulas", cleanCi));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.NOMBRE && data.APELLIDO) setValue("fullName", `${data.NOMBRE} ${data.APELLIDO}`.toUpperCase());
        if (data.NOM_MADRE) setValue("motherName", data.NOM_MADRE.toUpperCase());
        if (data.NOM_PADRE) setValue("fatherName", data.NOM_PADRE.toUpperCase());
        if (data.FECHA_NACI) setValue("birthDate", data.FECHA_NACI);
        if (data.SEXO) {
          const s = String(data.SEXO).trim().toUpperCase();
          if (s.startsWith('M')) setValue("sexo", "M"); else if (s.startsWith('F')) setValue("sexo", "F");
        }
        toast({ title: "Datos precargados" });
      } else {
        toast({ variant: "destructive", title: "No encontrado", description: "La cédula no figura en la base de datos." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo realizar la búsqueda." });
    } finally { setIsSearchingCi(false); }
  }

  const handleRegistration = async (values: FormValues) => {
    if (!db) return;
    setLoading(true);
    try {
      const regId = `conf_${Date.now()}`;
      
      const cleanData = (obj: any) => {
        const newObj: any = {};
        Object.keys(obj).forEach(key => {
          if (obj[key] !== undefined) newObj[key] = obj[key];
        });
        return newObj;
      };

      const isEfectivo = values.paymentMethod === "EFECTIVO";
      const regCost = Number(values.registrationCost);
      
      const finalStatus = isEfectivo ? "INSCRITO" : "POR_VALIDAR";
      const finalAmountPaid = isEfectivo ? regCost : 0;
      const finalPaymentStatus = isEfectivo 
        ? (regCost >= establishedLimit ? "PAGADO" : "PARCIAL") 
        : "PENDIENTE";

      const regData = cleanData({
        fullName: values.fullName || "",
        ciNumber: values.ciNumber || "",
        phone: values.phone || "",
        birthDate: values.birthDate || "",
        age: values.age || 0,
        sexo: values.sexo || "",
        photoUrl: values.photoUrl || null,
        paymentMethod: values.paymentMethod,
        lastPaymentMethod: values.paymentMethod === "SIN_PAGO" ? null : values.paymentMethod,
        paymentProofUrl: values.paymentProofUrl || null,
        motherName: values.motherName || null,
        motherPhone: values.motherPhone || null,
        fatherName: values.fatherName || null,
        fatherPhone: values.fatherPhone || null,
        tutorName: values.tutorName || null,
        tutorPhone: values.tutorPhone || null,
        catechesisYear: values.catechesisYear,
        attendanceDay: values.attendanceDay,
        hasBaptism: !!values.hasBaptism,
        hasFirstCommunion: !!values.hasFirstCommunion,
        baptismParish: values.baptismParish || null,
        baptismBook: values.baptismBook || null,
        baptismFolio: values.baptismFolio || null,
        baptismCertificatePhotoUrl: values.baptismCertificatePhotoUrl || null,
        userId: user?.uid || (isPublic ? "public_registration" : "manual"),
        status: finalStatus,
        paymentStatus: finalPaymentStatus,
        amountPaid: finalAmountPaid,
        registrationCost: regCost,
        createdAt: serverTimestamp()
      })

      await setDoc(doc(db, "confirmations", regId), regData);
      setSubmittedData({ ...regData, id: regId, timestamp: new Date() });
      setIsSubmittedSuccessfully(true);
      toast({ title: "Inscripción enviada exitosamente" });
    } catch (e) {
      console.error("Error al registrar:", e);
      toast({ variant: "destructive", title: "Error al inscribir", description: "Ocurrió un problema al guardar los datos." });
    } finally { setLoading(false); }
  }

  const onInvalid = (errors: any) => {
    const fieldLabels: Record<string, string> = {
      fullName: "Nombre Completo",
      ciNumber: "N° de C.I.",
      phone: "Celular",
      birthDate: "Fecha de Nacimiento",
      sexo: "Sexo",
      paymentMethod: "Método de Pago",
      catechesisYear: "Nivel (Año)",
      attendanceDay: "Horario de Preferencia",
      registrationCost: "Monto de Inscripción"
    };

    const errorFields = Object.keys(errors)
      .map(key => fieldLabels[key] || key);

    if (errorFields.length > 0) {
      toast({
        variant: "destructive",
        title: "Formulario Incompleto",
        description: `Por favor, completa los siguientes campos obligatorios: ${errorFields.join(", ")}.`,
      });
    }
  }

  const shareViaWhatsApp = () => {
    if (!submittedData) return;
    const msg = `*INSCRIPCIÓN EXITOSA - SANTUARIO NSPS*\n\n` +
                `*Provisorio:* ${submittedData.id.split('_')[1]}\n` +
                `*Confirmando:* ${submittedData.fullName}\n` +
                `*Monto:* ${submittedData.registrationCost.toLocaleString('es-PY')} Gs.\n` +
                `*Año:* ${submittedData.catechesisYear.replace('_', ' ')}\n\n` +
                `Por favor, conserva este mensaje como comprobante de tu trámite.`;
    
    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  }

  if (isSubmittedSuccessfully) {
    const hasPaid = submittedData?.paymentMethod !== "SIN_PAGO";
    const dateDay = submittedData?.timestamp?.getDate();
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const monthName = months[submittedData?.timestamp?.getMonth() || 0];

    return (
      <>
        <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden max-w-2xl mx-auto animate-in zoom-in-95 duration-500 no-print">
          <div className="bg-primary p-12 text-center text-white space-y-6">
            <div className="h-24 w-24 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/30 animate-bounce">
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="text-4xl font-headline font-black tracking-tight">¡REGISTRO EXITOSO!</h2>
              <p className="text-white/80 font-medium text-lg">Tu ficha ha sido enviada correctamente al Santuario.</p>
            </div>
          </div>
          <CardContent className="p-10 space-y-8">
            <div className="p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-center space-y-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">N° de Comprobante Provisional</p>
              <p className="text-2xl font-black text-primary font-mono">{submittedData?.id.split('_')[1]}</p>
              <div className="h-px w-20 bg-slate-200 mx-auto"></div>
              <p className="text-sm font-bold text-slate-600 uppercase">{submittedData?.fullName}</p>
            </div>

            {hasPaid && (
              <div className="flex flex-col items-center gap-4 bg-slate-50 p-6 rounded-3xl no-print">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vista Previa de Recibo</p>
                <div className="w-full overflow-hidden border rounded-2xl bg-white shadow-sm h-[300px] flex justify-center">
                  <div className="origin-top scale-[0.5] sm:scale-[0.6]">
                    <ReceiptOfficialContent submittedData={submittedData} dateDay={dateDay} monthName={monthName} />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="bg-slate-50 p-8 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
              {hasPaid && (
                <>
                  <Button variant="outline" className="h-14 rounded-2xl font-black gap-2 border-slate-200 text-slate-600" onClick={() => window.print()}>
                    <Printer className="h-5 w-5" /> IMPRIMIR
                  </Button>
                  <Button variant="secondary" className="h-14 rounded-2xl font-black gap-2 bg-green-50 text-green-700 border-green-200" onClick={shareViaWhatsApp}>
                    <MessageCircle className="h-5 w-5" /> WHATSAPP
                  </Button>
                </>
              )}
              <Button className={cn("h-14 rounded-2xl font-black gap-2 bg-slate-900 text-white", !hasPaid ? "col-span-3" : "col-span-1")} asChild>
                <Link href={isPublic ? "/" : "/dashboard"}>
                  FINALIZAR <ChevronRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </CardFooter>
        </Card>
        {hasPaid && (
          <div className="hidden print:block">
            <ReceiptOfficialContent submittedData={submittedData} dateDay={dateDay} monthName={monthName} />
          </div>
        )}
      </>
    )
  }

  return (
    <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden max-w-4xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleRegistration, onInvalid)}>
          <CardHeader className="bg-primary text-white p-8">
            <CardTitle className="text-2xl font-headline font-bold">Ficha de Inscripción 2026</CardTitle>
            <CardDescription className="text-white/80">Catequesis de Confirmación - Santuario Nacional NSPS</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-12">
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <Avatar className="h-32 w-32 border-4 border-slate-50 shadow-xl">
                  <AvatarImage src={photoPreview || undefined} className="object-cover" />
                  <AvatarFallback className="bg-slate-100 text-slate-300"><User className="h-16 w-16" /></AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-2 -right-2 flex gap-2">
                  <button type="button" onClick={() => startCamera("STUDENT_PHOTO")} className="h-9 w-9 bg-primary text-white rounded-full flex items-center justify-center border-2 border-white shadow-lg active:scale-95 transition-transform"><Camera className="h-4 w-4" /></button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="h-9 w-9 bg-accent text-white rounded-full flex items-center justify-center border-2 border-white shadow-lg active:scale-95 transition-transform"><ImageIcon className="h-4 w-4" /></button>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "photoUrl")} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Foto del Postulante</p>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2"><UserPlus className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg">Datos del Confirmando</h3></div>
              <div className="grid gap-6 md:grid-cols-2">
                <FormField control={form.control} name="ciNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">N° de C.I. *</FormLabel>
                    <div className="flex gap-2">
                      <FormControl><Input placeholder="Sin puntos" {...field} className="h-12 rounded-xl" /></FormControl>
                      <Button type="button" onClick={() => handleLookupCi(field.value)} disabled={isSearchingCi} className="h-12 px-6 rounded-xl font-bold bg-primary shadow-lg shadow-primary/20"><Search className="h-4 w-4" /></Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="fullName" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">Nombre Completo *</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl uppercase font-bold" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">Celular *</FormLabel><FormControl><Input placeholder="09XX XXX XXX" {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="birthDate" render={({ field }) => (
                    <FormItem><FormLabel className="font-bold">Nacimiento *</FormLabel><FormControl><Input type="date" {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="sexo" render={({ field }) => (
                    <FormItem><FormLabel className="font-bold">Sexo *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Femenino</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )} />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2"><Users className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg">Padres / Tutores</h3></div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Madre</p>
                  <FormField control={form.control} name="motherName" render={({ field }) => (<FormItem><FormControl><Input placeholder="Nombre" {...field} className="h-10 rounded-lg uppercase" /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="motherPhone" render={({ field }) => (<FormItem><FormControl><Input placeholder="Celular" {...field} className="h-10 rounded-lg" /></FormControl></FormItem>)} />
                </div>
                <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Padre</p>
                  <FormField control={form.control} name="fatherName" render={({ field }) => (<FormItem><FormControl><Input placeholder="Nombre" {...field} className="h-10 rounded-lg uppercase" /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="fatherPhone" render={({ field }) => (<FormItem><FormControl><Input placeholder="Celular" {...field} className="h-10 rounded-lg" /></FormControl></FormItem>)} />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2"><Church className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg">Inscripción Académica</h3></div>
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="catechesisYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Nivel *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 rounded-xl">
                            <SelectValue placeholder="Seleccione el nivel" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PRIMER_AÑO">1° Año (Inicial)</SelectItem>
                          <SelectItem value="SEGUNDO_AÑO">2° Año (Confirmación)</SelectItem>
                          <SelectItem value="ADULTOS">Adultos (Intensivo)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="attendanceDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Horario de Preferencia *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 rounded-xl">
                            <SelectValue placeholder="Seleccione horario" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="SABADO">Sábados (15:30 a 18:30)</SelectItem>
                          <SelectItem value="DOMINGO">Domingos (08:00 a 11:00)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2"><BookOpen className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg">Vida Sacramental</h3></div>
              <FormField control={form.control} name="hasBaptism" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-2xl border p-4 bg-slate-50/50"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 rounded-md" /></FormControl><div className="space-y-1 leading-none"><FormLabel className="font-black text-xs uppercase cursor-pointer">¿Tiene el Bautismo?</FormLabel></div></FormItem>
              )} />
              {hasBaptism && (
                <div className="animate-in slide-in-from-top-2 duration-300 space-y-6 p-6 border-2 border-primary/10 border-dashed rounded-3xl bg-slate-50/30">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="baptismParish" render={({ field }) => (<FormItem><FormControl><Input placeholder="Parroquia" {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="baptismBook" render={({ field }) => (<FormItem><FormControl><Input placeholder="Libro" {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="baptismFolio" render={({ field }) => (<FormItem><FormControl><Input placeholder="Folio" {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>)} />
                  </div>
                  <div className="border-2 border-dashed rounded-3xl h-40 flex flex-col items-center justify-center bg-white cursor-pointer overflow-hidden" onClick={() => startCamera("BAPTISM_CERT")}>
                    {baptismPreview ? <img src={baptismPreview} className="w-full h-full object-cover" /> : <><Book className="h-10 w-10 text-slate-300 mb-2" /><span className="text-xs font-bold text-slate-400 uppercase">Foto Certificado</span></>}
                  </div>
                  <input type="file" ref={baptismInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "baptismCertificatePhotoUrl")} />
                </div>
              )}
              <FormField control={form.control} name="hasFirstCommunion" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-2xl border p-4 bg-slate-50/50"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 rounded-md" /></FormControl><div className="space-y-1 leading-none"><FormLabel className="font-black text-xs uppercase cursor-pointer">¿Hizo la Primera Comunión?</FormLabel></div></FormItem>
              )} />
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2"><Wallet className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg">Método de Pago</h3></div>
              <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                <FormItem className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {!isPublic && (
                      <div onClick={() => field.onChange("EFECTIVO")} className={cn("cursor-pointer p-4 rounded-2xl border-2 flex flex-col items-center gap-2", field.value === "EFECTIVO" ? "border-primary bg-primary/5" : "border-slate-100")}>
                        <Banknote className={cn("h-6 w-6", field.value === "EFECTIVO" ? "text-primary" : "text-slate-400")} /><span className="text-xs font-bold uppercase">Efectivo</span>
                      </div>
                    )}
                    <div onClick={() => field.onChange("TRANSFERENCIA")} className={cn("cursor-pointer p-4 rounded-2xl border-2 flex flex-col items-center gap-2", field.value === "TRANSFERENCIA" ? "border-primary bg-primary/5" : "border-slate-100", isPublic && "sm:col-span-3")}>
                      <ArrowRightLeft className={cn("h-6 w-6", field.value === "TRANSFERENCIA" ? "text-primary" : "text-slate-400")} /><span className="text-xs font-bold uppercase">Transferencia</span>
                    </div>
                    {!isPublic && (
                      <div onClick={() => field.onChange("SIN_PAGO")} className={cn("cursor-pointer p-4 rounded-2xl border-2 flex flex-col items-center gap-2", field.value === "SIN_PAGO" ? "border-primary bg-primary/5" : "border-slate-100")}>
                        <Clock className={cn("h-6 w-6", field.value === "SIN_PAGO" ? "text-primary" : "text-slate-400")} /><span className="text-xs font-bold uppercase">Sin pago</span>
                      </div>
                    )}
                  </div>
                </FormItem>
              )} />
              {paymentMethod === "TRANSFERENCIA" && (
                <div className="space-y-6 p-6 border-2 border-primary/10 border-dashed rounded-3xl bg-slate-50/30">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase">Titular</p><p className="text-sm font-bold text-slate-700">{costs?.accountOwner || "Santuario NSPS"}</p></div>
                    {costs?.alias && (<div className="p-4 bg-white rounded-2xl border-2 border-primary/20 flex items-center justify-between"><p className="text-lg font-black text-primary">{costs.alias}</p><Button type="button" size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(costs.alias || "")}><Copy className="h-4 w-4" /></Button></div>)}
                  </div>
                  <div className="relative border-2 border-dashed rounded-3xl h-40 flex flex-col items-center justify-center bg-white cursor-pointer" onClick={() => proofInputRef.current?.click()}>
                    {proofPreview ? <img src={proofPreview} className="w-full h-full object-cover" /> : <><ImageIcon className="h-10 w-10 text-slate-300" /><span className="text-xs font-bold text-slate-400 uppercase">Cargar Comprobante</span></>}
                    <div className="absolute bottom-2 right-2 flex gap-2">
                      <button type="button" onClick={(e) => { e.stopPropagation(); startCamera("PAYMENT_PROOF"); }} className="h-8 w-8 bg-primary text-white rounded-full flex items-center justify-center shadow-lg"><Camera className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <input type="file" ref={proofInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "paymentProofUrl")} />
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="bg-slate-50 p-10 flex flex-col gap-6">
            <div className="flex items-center justify-between bg-white px-6 py-3 rounded-2xl border w-full max-w-xs">
              <span className="text-[10px] font-black text-slate-400 uppercase">Monto a abonar:</span>
              <FormField control={form.control} name="registrationCost" render={({ field }) => (
                <FormItem className="space-y-0"><FormControl><div className="flex items-center gap-1"><Input type="number" {...field} className="w-20 h-8 p-0 border-none text-right font-black text-primary focus-visible:ring-0" /><span className="font-black text-primary">Gs.</span></div></FormControl></FormItem>
              )} />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-16 bg-primary text-white rounded-2xl text-xl font-bold shadow-2xl active:scale-95 transition-all">
              {loading ? <Loader2 className="animate-spin h-6 w-6 mr-2" /> : <><UserPlus className="mr-2 h-6 w-6" /> ENVIAR INSCRIPCIÓN</>}
            </Button>
          </CardFooter>
        </form>
      </Form>

      <Dialog open={showCamera} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-3xl">
          <DialogHeader className="p-6 bg-primary text-white"><DialogTitle>Capturar Foto</DialogTitle></DialogHeader>
          <div className="relative bg-black aspect-[3/4] flex items-center justify-center overflow-hidden"><video ref={onVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" /><canvas ref={canvasRef} className="hidden" /></div>
          <DialogFooter className="p-6 bg-slate-50 flex gap-3">
            <Button type="button" variant="outline" className="flex-1 h-12" onClick={stopCamera}>CANCELAR</Button>
            <Button type="button" className="flex-1 h-12 bg-primary text-white" onClick={takePhoto}>TOMAR FOTO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function ReceiptOfficialContent({ submittedData, dateDay, monthName }: { submittedData: any, dateDay: any, monthName: any }) {
  const provId = submittedData?.id?.includes('_') ? submittedData.id.split('_')[1] : (submittedData?.id || '---');
  
  return (
    <div id="receipt-content-official" className="bg-white p-10 text-black font-serif border-[4px] border-black w-[800px] h-auto min-h-[1000px] mx-auto">
      <div className="flex gap-4 mb-8">
        <div className="flex-1 border-[2px] border-black p-4 flex items-center justify-between">
          <div className="relative h-16 w-16"><Image src="/logo.png" fill alt="Logo" className="object-contain" /></div>
          <div className="text-right"><p className="text-[11px] font-black leading-none">SANTUARIO NACIONAL</p><p className="text-[9px] font-bold leading-tight uppercase">NSPS</p></div>
        </div>
        <div className="w-[220px] flex flex-col gap-2">
          <div className="border-[2px] border-black p-2 text-center h-[60%] flex flex-col justify-center"><p className="text-[10px] font-black uppercase">GS.</p><p className="text-2xl font-black">{submittedData?.registrationCost?.toLocaleString('es-PY')}</p></div>
          <div className="border-[2px] border-black p-1 text-center flex-1"><p className="text-[8px] font-bold uppercase">RECIBO PROV.</p><p className="text-xs font-black font-mono">{provId}</p></div>
        </div>
      </div>
      <div className="text-center mb-10"><h2 className="text-4xl font-black italic tracking-[0.2em] border-b-[3px] border-black inline-block px-16 pb-1">RECIBO</h2></div>
      <div className="space-y-8 text-[15px]">
        <div className="flex items-baseline gap-2"><span className="font-bold">Recibí de:</span><span className="flex-1 border-b border-dotted border-black px-2 uppercase font-black">{submittedData?.fullName}</span></div>
        <div className="flex items-baseline gap-2"><span className="font-bold">La cantidad de:</span><span className="flex-1 border-b border-dotted border-black px-2 italic">{submittedData?.registrationCost?.toLocaleString('es-PY')} Gs.</span></div>
        <div className="space-y-3"><span className="font-bold">Concepto:</span><div className="border-[2px] border-black p-5 text-center font-black uppercase">INSCRIPCIÓN CATEQUESIS - {submittedData?.catechesisYear?.replace('_', ' ')}</div></div>
      </div>
      <div className="mt-16 space-y-12">
        <div><p className="italic border-b border-black inline-block pr-16 text-sm">Asunción, {dateDay} de {monthName} de 2026</p></div>
        <div className="flex flex-col items-center">
          <div className="p-1 border border-slate-100 rounded-lg"><QRCodeCanvas value={`NSPS-PROV-${submittedData?.id}`} size={90} level="M" /></div>
          <p className="text-[9px] font-black text-blue-700 uppercase mt-2">Firma Digitalizada: LILIANA MUÑOZ</p>
        </div>
      </div>
    </div>
  )
}
