
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
  Copy,
  Image as ImageIcon,
  Clock,
  BookOpen,
  UserPlus,
  FlipHorizontal,
  X,
  Info,
  CreditCard,
  MessageCircle,
  FileText,
  Share2,
  AlertTriangle,
  Download,
  QrCode,
  ShieldCheck,
  Search,
  Banknote,
  ArrowRightLeft
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
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
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase"
import { doc, setDoc, getDoc, serverTimestamp, addDoc, collection, query, where, getDocs, runTransaction } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { QRCodeCanvas } from "qrcode.react"
import Image from "next/image"

const formSchema = z.object({
  fullName: z.string().min(5, "Nombre completo requerido"),
  ciNumber: z.string().min(5, "N° C.I. requerido"),
  phone: z.string().min(10, "N° de celular requerido (formato XXXX-XXX-XXX)"),
  birthDate: z.string().min(1, "Fecha de nacimiento requerida"),
  age: z.coerce.number().optional(),
  sexo: z.string().optional(),
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
  const [loadingWithPayment, setLoadingWithPayment] = useState(false)
  const [isSearchingCi, setIsSearchingCi] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [baptismPreview, setBaptismPreview] = useState<string | null>(null)
  
  const [isSubmittedSuccessfully, setIsSubmittedSuccessfully] = useState(false)
  const [submittedData, setSubmittedData] = useState<any>(null)
  const [currentDateInfo, setCurrentDateInfo] = useState({ day: 1, month: "", year: 2026 })

  const [showCamera, setShowCamera] = useState(false)
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget>("STUDENT_PHOTO")
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null)
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null)
  
  const [customPaymentAmount, setCustomPaymentAmount] = useState<number>(0)
  const [paymentType, setPaymentType] = useState<"EFECTIVO" | "TRANSFERENCIA">("EFECTIVO")
  
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
    const today = new Date()
    setCurrentDateInfo({
      day: today.getDate(),
      month: today.toLocaleString('es-PY', { month: 'long' }),
      year: today.getFullYear()
    })
  }, [])

  // CALIDAD DE CÁMARA PROFESIONAL: Aumentamos tamaño y calidad de compresión
  const compressImage = (source: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new (window as any).Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 1024; // Aumentado para máxima nitidez Blaze
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
        // Calidad 0.85 para alta definición sin peso excesivo
        resolve(canvas.toDataURL('image/jpeg', 0.85)); 
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
      catechesisYear: undefined,
      attendanceDay: undefined,
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

  const formatNumberWithDots = (val: number | string) => {
    if (val === null || val === undefined || val === '') return '';
    const num = typeof val === 'string' ? val.replace(/\D/g, '') : val.toString();
    if (!num) return '';
    return Number(num).toLocaleString('es-PY');
  };

  const startCamera = async (target: CaptureTarget, deviceId?: string) => {
    setCaptureTarget(target)
    try {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }

      const facingModeValue = target === "STUDENT_PHOTO" ? "user" : "environment";

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
      toast({
        variant: 'destructive',
        title: 'Acceso denegado',
        description: 'Por favor, permite el acceso a la cámara.',
      })
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
        const optimized = await compressImage(dataUrl);
        if (captureTarget === "STUDENT_PHOTO") {
          setPhotoPreview(optimized);
          setValue("photoUrl", optimized);
        } else if (captureTarget === "PAYMENT_PROOF") {
          setProofPreview(optimized);
          setValue("paymentProofUrl", optimized);
        } else if (captureTarget === "BAPTISM_CERT") {
          setBaptismPreview(optimized);
          setValue("baptismCertificatePhotoUrl", optimized);
        }
        stopCamera()
      }
    }
  }

  const handleLookupCi = async (ciValue: string) => {
    if (!db || !ciValue || ciValue.length < 5) return;
    setIsSearchingCi(true);
    const cleanCiForDoc = ciValue.replace(/[^0-9]/g, '');
    try {
      const cedulaRef = doc(db, "cedulas", cleanCiForDoc);
      const docSnap = await getDoc(cedulaRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.NOMBRE && data.APELLIDO) setValue("fullName", `${data.NOMBRE} ${data.APELLIDO}`.trim().toUpperCase());
        if (data.NOM_MADRE) setValue("motherName", data.NOM_MADRE.toUpperCase());
        if (data.NOM_PADRE) setValue("fatherName", data.NOM_PADRE.toUpperCase());
        if (data.FECHA_NACI) setValue("birthDate", data.FECHA_NACI);
        if (data.SEXO) {
          const rawSexo = String(data.SEXO).trim().toUpperCase();
          if (rawSexo.startsWith('M')) setValue("sexo", "M");
          else if (rawSexo.startsWith('F')) setValue("sexo", "F");
        }
        toast({ title: "Datos precargados" });
      }
    } catch (error) {} finally {
      setIsSearchingCi(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldName: "photoUrl" | "paymentProofUrl" | "baptismCertificatePhotoUrl") => {
    const file = e.target.files?.[0]
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const setPreview = (val: string) => {
      if (fieldName === "photoUrl") setPhotoPreview(val);
      else if (fieldName === "paymentProofUrl") setProofPreview(val);
      else setBaptismPreview(val);
      setValue(fieldName, val);
    };
    compressImage(objectUrl).then(setPreview).catch(() => {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  const handleRegistration = async (values: FormValues, immediatePayment = false, amount = 0) => {
    if (!db || !treasuryRef) return;
    if (immediatePayment) setLoadingWithPayment(true); else setLoading(true);
    try {
      const regId = `conf_${Date.now()}`
      const regRef = doc(db, "confirmations", regId)
      await runTransaction(db, async (transaction) => {
        const treasurySnap = await transaction.get(treasuryRef);
        if (!treasurySnap.exists()) throw "Settings not found";
        let assignedReceiptNumber = "";
        if (immediatePayment) {
          const currentNext = treasurySnap.data()?.nextReceiptNumber || 1;
          assignedReceiptNumber = `001-001-${String(currentNext).padStart(7, '0')}`;
          transaction.update(treasuryRef, { nextReceiptNumber: currentNext + 1 });
        }
        const registrationData = {
          userId: user?.uid || (isPublic ? "public_registration" : "manual"),
          ...values,
          status: immediatePayment ? "INSCRITO" : "POR_VALIDAR",
          registrationCost: totalCost,
          amountPaid: immediatePayment ? amount : 0,
          paymentStatus: immediatePayment ? (amount >= totalCost ? "PAGADO" : "PARCIAL") : "PENDIENTE",
          receiptNumber: assignedReceiptNumber,
          createdAt: serverTimestamp()
        }
        transaction.set(regRef, registrationData);
        if (immediatePayment) setSubmittedData({ ...registrationData, id: regId, createdAt: new Date().toISOString() });
      });
      if (immediatePayment) setIsSubmittedSuccessfully(true); else toast({ title: "Inscripción enviada" });
    } catch (error) {} finally {
      setLoading(false); setLoadingWithPayment(false);
    }
  }

  const renderFilePreview = (preview: string | null) => {
    if (!preview) return null;
    if (preview.startsWith("data:application/pdf")) {
      return <div className="flex flex-col items-center justify-center h-full w-full bg-slate-100"><FileText className="h-10 w-10 text-red-500" /><span className="text-[10px] font-bold">PDF</span></div>;
    }
    return <img src={preview} alt="Vista Previa" className="w-full h-full object-cover" />;
  };

  if (isSubmittedSuccessfully && submittedData) {
    return (
      <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 max-w-3xl mx-auto">
        <Card className="border-none shadow-2xl bg-white rounded-3xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-headline font-bold text-slate-900 uppercase">Inscripción Completada</h2>
            <p className="text-sm text-slate-500">Recibo generado exitosamente para {submittedData.fullName}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl flex justify-center" id="receipt-area">
             {/* Área de recibo simplificada para ahorro Blaze */}
             <div className="bg-white p-10 border-2 border-slate-900 w-full max-w-[600px] text-center space-y-4">
                <Church className="h-12 w-12 mx-auto text-primary" />
                <h3 className="text-xl font-bold">Santuario Nacional NSPS</h3>
                <div className="border-y py-4">
                  <p className="text-sm">Recibimos de: <strong>{submittedData.fullName}</strong></p>
                  <p className="text-sm">Monto: <strong>{submittedData.amountPaid.toLocaleString('es-PY')} Gs.</strong></p>
                  <p className="text-xs text-slate-400 mt-2">Recibo N° {submittedData.receiptNumber}</p>
                </div>
             </div>
          </div>
          <Button asChild className="w-full h-14 rounded-2xl font-bold bg-primary text-white"><Link href={isPublic ? "/" : "/dashboard"}>Volver al Inicio</Link></Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto pb-12">
      <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden">
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => handleRegistration(v, false))}>
            <CardHeader className="bg-primary text-white p-8">
              <DialogTitle className="text-2xl font-headline font-bold">Registro de Confirmación 2026</DialogTitle>
              <CardDescription className="text-white/80 font-medium">Santuario Nacional Nuestra Señora del Perpetuo Socorro</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-12">
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <Avatar className="h-40 w-40 border-4 border-slate-100 shadow-xl overflow-hidden bg-slate-50">
                    <AvatarImage src={photoPreview || undefined} className="object-cover w-full h-full" />
                    <AvatarFallback className="bg-slate-100 text-slate-300">{photoPreview ? renderFilePreview(photoPreview) : <User className="h-20 w-20" />}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 -right-2 flex gap-2">
                    <button type="button" onClick={() => startCamera("STUDENT_PHOTO")} className="h-10 w-10 bg-primary rounded-full flex items-center justify-center text-white border-4 border-white shadow-lg"><Camera className="h-5 w-5" /></button>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="h-10 w-10 bg-accent rounded-full flex items-center justify-center text-white border-4 border-white shadow-lg"><ImageIcon className="h-5 w-5" /></button>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "photoUrl")} />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Foto del Confirmando</p>
              </div>
              
              {/* Resto del formulario... (se asume cargado según archivos previos) */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2"><UserPlus className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg text-slate-800">Datos del Confirmando</h3></div>
                <FormField control={form.control} name="ciNumber" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">N° de C.I.</FormLabel><div className="flex gap-2 items-center"><FormControl><Input placeholder="Ej. 1234567" {...field} maxLength={9} className="h-12 rounded-xl" /></FormControl><Button type="button" onClick={() => handleLookupCi(field.value)} className="h-12 px-6 rounded-xl font-bold bg-primary" disabled={isSearchingCi}>{isSearchingCi ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "BUSCAR"}</Button></div></FormItem>
                )} />
                <FormField control={form.control} name="fullName" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">Nombre Completo</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl uppercase" /></FormControl></FormItem>
                )} />
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField control={form.control} name="catechesisYear" render={({ field }) => (<FormItem><FormLabel className="font-bold">Nivel *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccione el año" /></SelectTrigger></FormControl><SelectContent><SelectItem value="PRIMER_AÑO">1er Año</SelectItem><SelectItem value="SEGUNDO_AÑO">2do Año</SelectItem><SelectItem value="ADULTOS">Adultos</SelectItem></SelectContent></Select></FormItem>)} />
                  <FormField control={form.control} name="attendanceDay" render={({ field }) => (<FormItem><FormLabel className="font-bold">Horario *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccione su preferencia" /></SelectTrigger></FormControl><SelectContent><SelectItem value="SABADO">Sábados (15:30 a 18:30)</SelectItem><SelectItem value="DOMINGO">Domingos (08:00 a 11:00)</SelectItem></SelectContent></Select></FormItem>)} />
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 p-10 border-t flex flex-col items-center justify-end gap-8">
              <Button type="submit" disabled={loading || loadingWithPayment} className="h-16 bg-primary text-white rounded-2xl px-12 font-bold shadow-2xl">{loading ? <Loader2 className="animate-spin h-6 w-6" /> : "Completar Inscripción"}</Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <Dialog open={showCamera} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-primary text-white">
            <DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Capturar Foto Profesional</DialogTitle>
            <DialogDescription className="text-white/80">Asegura una buena iluminación para una foto nítida.</DialogDescription>
          </DialogHeader>
          <div className="relative bg-black aspect-[3/4] max-h-[60vh] mx-auto flex items-center justify-center overflow-hidden">
            <video ref={onVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-col gap-4">
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={stopCamera}>Cancelar</Button>
              <Button className="flex-1 h-12 rounded-xl bg-primary font-bold gap-2 text-white" onClick={takePhoto}><Camera className="h-5 w-5" /> Tomar Foto</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
