
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
  Users
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

const formSchema = z.object({
  fullName: z.string().min(5, "Nombre completo requerido"),
  ciNumber: z.string().min(5, "N° C.I. requerido"),
  phone: z.string().min(6, "N° de celular requerido"),
  birthDate: z.string().min(1, "Fecha de nacimiento requerida"),
  age: z.coerce.number().optional(),
  sexo: z.string().min(1, "Seleccione sexo"),
  photoUrl: z.string().optional(),
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

  const totalCost = catechesisYear === "ADULTOS" ? (costs?.adultCost || 50000) : (costs?.juvenileCost || 35000)

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
        const MAX_SIZE = 800;
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
        resolve(canvas.toDataURL('image/jpeg', 0.7)); 
      };
      img.onerror = (e: any) => reject(e);
      img.src = source;
    });
  };

  const onVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node && currentStream) {
      node.srcObject = currentStream;
      node.play().catch(console.error);
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
      canvas.getContext('2d')?.drawImage(video, 0, 0)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
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
      }
    } catch (e) {} finally { setIsSearchingCi(false); }
  }

  const handleRegistration = async (values: FormValues) => {
    if (!db) return;
    setLoading(true);
    try {
      const regId = `conf_${Date.now()}`;
      const regData = {
        ...values,
        userId: user?.uid || (isPublic ? "public_registration" : "manual"),
        status: "POR_VALIDAR",
        paymentStatus: "PENDIENTE",
        amountPaid: 0,
        registrationCost: totalCost,
        createdAt: serverTimestamp()
      }
      await setDoc(doc(db, "confirmations", regId), regData);
      setSubmittedData({ ...regData, id: regId });
      setIsSubmittedSuccessfully(true);
      toast({ title: "Inscripción enviada exitosamente" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al inscribir" });
    } finally { setLoading(false); }
  }

  if (!mounted) return null;

  if (isSubmittedSuccessfully) {
    return (
      <Card className="border-none shadow-2xl bg-white rounded-3xl p-10 text-center space-y-6 max-w-2xl mx-auto">
        <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h2 className="text-3xl font-headline font-bold text-slate-900">¡INSCRIPCIÓN RECIBIDA!</h2>
        <p className="text-slate-500 font-medium">Se ha generado la ficha de pre-inscripción para <strong>{submittedData?.fullName}</strong>.</p>
        <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200 text-sm space-y-2">
          <p className="font-bold text-primary uppercase">Próximos Pasos:</p>
          <ul className="text-slate-600 space-y-1 text-left inline-block">
            <li>• Presentarse en Secretaría del Santuario para validar el pago.</li>
            <li>• Entregar copia de Cédula de Identidad.</li>
            <li>• Entregar copia de Certificado de Bautismo (si no fue adjuntado).</li>
          </ul>
        </div>
        <Button asChild className="w-full h-14 rounded-xl font-bold bg-primary shadow-lg">
          <Link href={isPublic ? "/" : "/dashboard"}>FINALIZAR</Link>
        </Button>
      </Card>
    )
  }

  return (
    <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden max-w-4xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleRegistration)}>
          <CardHeader className="bg-primary text-white p-8">
            <CardTitle className="text-2xl font-headline font-bold">Ficha de Inscripción 2026</CardTitle>
            <CardDescription className="text-white/80">Catequesis de Confirmación - Santuario Nacional NSPS</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-12">
            
            {/* FOTO DE PERFIL */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <Avatar className="h-32 w-32 border-4 border-slate-50 shadow-xl">
                  <AvatarImage src={photoPreview || undefined} className="object-cover" />
                  <AvatarFallback className="bg-slate-50 text-slate-300"><User className="h-16 w-16" /></AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-2 -right-2 flex gap-2">
                  <button type="button" onClick={() => startCamera("STUDENT_PHOTO")} className="h-9 w-9 bg-primary text-white rounded-full flex items-center justify-center border-2 border-white shadow-lg"><Camera className="h-4 w-4" /></button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="h-9 w-9 bg-accent text-white rounded-full flex items-center justify-center border-2 border-white shadow-lg"><ImageIcon className="h-4 w-4" /></button>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "photoUrl")} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Foto del Postulante</p>
            </div>

            {/* SECCIÓN 1: DATOS PERSONALES */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2"><UserPlus className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg">Datos del Confirmando</h3></div>
              <div className="grid gap-6 md:grid-cols-2">
                <FormField control={form.control} name="ciNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">N° de C.I. *</FormLabel>
                    <div className="flex gap-2">
                      <FormControl><Input placeholder="Sin puntos" {...field} className="h-12 rounded-xl" /></FormControl>
                      <Button type="button" onClick={() => handleLookupCi(field.value)} disabled={isSearchingCi} className="h-12 px-6 rounded-xl font-bold bg-primary">{isSearchingCi ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}</Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="fullName" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">Nombre Completo *</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl uppercase" /></FormControl><FormMessage /></FormItem>
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

            {/* SECCIÓN 2: FAMILIA */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2"><Users className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg">Información de Padres / Tutores</h3></div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-primary uppercase">Datos de la Madre</p>
                  <FormField control={form.control} name="motherName" render={({ field }) => (<FormItem><FormControl><Input placeholder="Nombre de la Madre" {...field} className="h-10 rounded-lg uppercase" /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="motherPhone" render={({ field }) => (<FormItem><FormControl><Input placeholder="Celular" {...field} className="h-10 rounded-lg" /></FormControl></FormItem>)} />
                </div>
                <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-primary uppercase">Datos del Padre</p>
                  <FormField control={form.control} name="fatherName" render={({ field }) => (<FormItem><FormControl><Input placeholder="Nombre del Padre" {...field} className="h-10 rounded-lg uppercase" /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="fatherPhone" render={({ field }) => (<FormItem><FormControl><Input placeholder="Celular" {...field} className="h-10 rounded-lg" /></FormControl></FormItem>)} />
                </div>
                <div className="md:col-span-2 space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-primary uppercase">Tutor / Responsable Alternativo (Opcional)</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="tutorName" render={({ field }) => (<FormItem><FormControl><Input placeholder="Nombre del Tutor" {...field} className="h-10 rounded-lg uppercase" /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="tutorPhone" render={({ field }) => (<FormItem><FormControl><Input placeholder="Celular" {...field} className="h-10 rounded-lg" /></FormControl></FormItem>)} />
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: CATEQUESIS */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2"><Church className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg">Inscripción Académica</h3></div>
              <div className="grid gap-6 md:grid-cols-2">
                <FormField control={form.control} name="catechesisYear" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">Nivel *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccione el año" /></SelectTrigger></FormControl><SelectContent><SelectItem value="PRIMER_AÑO">1° Año (Inicial)</SelectItem><SelectItem value="SEGUNDO_AÑO">2° Año (Confirmación)</SelectItem><SelectItem value="ADULTOS">Adultos (Intensivo)</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="attendanceDay" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">Horario de Preferencia *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccione su horario" /></SelectTrigger></FormControl><SelectContent><SelectItem value="SABADO">Sábados (15:30 a 18:30)</SelectItem><SelectItem value="DOMINGO">Domingos (08:00 a 11:00)</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            {/* SECCIÓN 4: SACRAMENTOS */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2"><BookOpen className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg">Vida Sacramental</h3></div>
              <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-4">
                  <FormField control={form.control} name="hasBaptism" render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-2xl border p-4 bg-slate-50/50 shadow-sm"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 rounded-md" /></FormControl><div className="space-y-1 leading-none"><FormLabel className="font-black text-xs uppercase cursor-pointer">¿Tiene el Bautismo?</FormLabel><p className="text-[10px] text-slate-400">Marcar si ya fue bautizado.</p></div></FormItem>
                  )} />
                  {hasBaptism && (
                    <div className="animate-in slide-in-from-top-2 duration-300 space-y-4 pt-2">
                      <FormField control={form.control} name="baptismParish" render={({ field }) => (<FormItem><FormControl><Input placeholder="Parroquia de Bautismo" {...field} className="h-10 rounded-lg" /></FormControl></FormItem>)} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="baptismBook" render={({ field }) => (<FormItem><FormControl><Input placeholder="Libro N°" {...field} className="h-10 rounded-lg" /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="baptismFolio" render={({ field }) => (<FormItem><FormControl><Input placeholder="Folio N°" {...field} className="h-10 rounded-lg" /></FormControl></FormItem>)} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <FormField control={form.control} name="hasFirstCommunion" render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-2xl border p-4 bg-slate-50/50 shadow-sm"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 rounded-md" /></FormControl><div className="space-y-1 leading-none"><FormLabel className="font-black text-xs uppercase cursor-pointer">¿Hizo la Primera Comunión?</FormLabel><p className="text-[10px] text-slate-400">Marcar si ya recibió el sacramento.</p></div></FormItem>
                  )} />
                </div>
              </div>
            </div>

            {/* SECCIÓN 5: DOCUMENTOS ADJUNTOS */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2"><FileText className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg">Documentación y Pagos</h3></div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <Label className="font-bold text-slate-700">Comprobante de Pago (Seña o Total)</Label>
                  <div className="border-2 border-dashed rounded-2xl h-40 flex flex-col items-center justify-center bg-slate-50 cursor-pointer overflow-hidden group hover:bg-slate-100 transition-colors" onClick={() => startCamera("PAYMENT_PROOF")}>
                    {proofPreview ? <img src={proofPreview} className="w-full h-full object-cover" /> : <><CreditCard className="h-8 w-8 text-slate-300 mb-2 group-hover:scale-110 transition-transform" /><span className="text-[10px] font-bold text-slate-400 uppercase">Cargar Foto de Comprobante</span></>}
                  </div>
                  <input type="file" ref={proofInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "paymentProofUrl")} />
                </div>
                <div className="space-y-3">
                  <Label className="font-bold text-slate-700">Certificado de Bautismo</Label>
                  <div className="border-2 border-dashed rounded-2xl h-40 flex flex-col items-center justify-center bg-slate-50 cursor-pointer overflow-hidden group hover:bg-slate-100 transition-colors" onClick={() => startCamera("BAPTISM_CERT")}>
                    {baptismPreview ? <img src={baptismPreview} className="w-full h-full object-cover" /> : <><Book className="h-8 w-8 text-slate-300 mb-2 group-hover:scale-110 transition-transform" /><span className="text-[10px] font-bold text-slate-400 uppercase">Cargar Certificado</span></>}
                  </div>
                  <input type="file" ref={baptismInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "baptismCertificatePhotoUrl")} />
                </div>
              </div>
            </div>

          </CardContent>
          <CardFooter className="bg-slate-50 p-10 border-t flex flex-col items-center gap-6">
            <div className="flex items-center gap-2 bg-white px-6 py-2 rounded-full border shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Inscripción Total:</span>
              <span className="text-lg font-black text-primary">{totalCost.toLocaleString('es-PY')} Gs.</span>
            </div>
            <Button type="submit" disabled={loading} className="w-full h-16 bg-primary text-white rounded-2xl text-xl font-bold shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">
              {loading ? <Loader2 className="animate-spin h-6 w-6 mr-2" /> : <><UserPlus className="mr-2 h-6 w-6" /> ENVIAR INSCRIPCIÓN</>}
            </Button>
            <p className="text-[10px] text-slate-400 text-center font-medium italic">
              Al enviar este formulario, declaro que todos los datos proporcionados son verídicos y acepto los términos de la catequesis del Santuario Nacional.
            </p>
          </CardFooter>
        </form>
      </Form>

      {/* DIÁLOGO DE CÁMARA */}
      <Dialog open={showCamera} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-primary text-white">
            <DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Capturar Foto</DialogTitle>
            <DialogDescription className="text-white/80">Asegura una buena iluminación.</DialogDescription>
          </DialogHeader>
          <div className="relative bg-black aspect-[3/4] max-h-[60vh] mx-auto flex items-center justify-center overflow-hidden">
            <video ref={onVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            {hasCameraPermission === false && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-white bg-slate-900/90 gap-4">
                <X className="h-12 w-12 text-red-500" />
                <p className="font-bold">Acceso denegado</p>
              </div>
            )}
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-col gap-4">
            {devices.length > 1 && (
              <div className="space-y-2">
                <Label className="text-xs text-slate-500 uppercase font-bold">Cambiar Cámara</Label>
                <Select value={selectedDeviceId} onValueChange={(v) => { setSelectedDeviceId(v); startCamera(captureTarget, v); }}>
                  <SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{devices.map(d => (<SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Cámara ${d.deviceId.slice(0, 5)}`}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-3 w-full">
              <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={stopCamera}>CANCELAR</Button>
              <Button type="button" className="flex-1 h-12 rounded-xl bg-primary text-white font-bold" onClick={takePhoto}>TOMAR FOTO</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
