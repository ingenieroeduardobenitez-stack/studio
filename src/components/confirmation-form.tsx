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
  QrCode
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
import { doc, setDoc, getDoc, serverTimestamp, addDoc, collection } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { ScrollArea } from "@/components/ui/scroll-area"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { QRCodeCanvas } from "qrcode.react"

const formSchema = z.object({
  fullName: z.string().min(5, "Nombre completo requerido"),
  ciNumber: z.string().min(5, "N° C.I. requerido"),
  phone: z.string().min(10, "N° de celular requerido (formato XXXX-XXX-XXX)"),
  birthDate: z.string().min(1, "Fecha de nacimiento requerida"),
  age: z.coerce.number().optional(),
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
  
  const [customPaymentAmount, setCustomPaymentAmount] = useState<number>(0)
  
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

  const onVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node && currentStream) {
      if (node.srcObject !== currentStream) {
        node.srcObject = currentStream;
        const playPromise = node.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            if (err.name !== 'AbortError') {
              console.error("Error auto-playing video:", err);
            }
          });
        }
      }
    }
    videoRef.current = node;
  }, [currentStream]);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user?.uid) return null
    return doc(db, "users", user.uid)
  }, [db, user?.uid])
  const { data: profile } = useDoc(userProfileRef)

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

  useEffect(() => {
    if (!isPublic && totalCost > 0) {
      setCustomPaymentAmount(totalCost)
    }
  }, [totalCost, isPublic])

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: any) => {
    const formatted = formatPhone(e.target.value);
    setValue(fieldName, formatted);
  };

  const handleAmountChange = (val: string) => {
    const num = Number(val);
    if (num > totalCost) {
      setCustomPaymentAmount(totalCost);
      toast({
        variant: "destructive",
        title: "Monto excedido",
        description: `El monto no puede superar el arancel de ${totalCost.toLocaleString('es-PY')} Gs.`,
      });
    } else {
      setCustomPaymentAmount(num);
    }
  };

  const startCamera = async (target: CaptureTarget, deviceId?: string) => {
    setCaptureTarget(target)
    try {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" }
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
        description: 'Por favor, permite el acceso a la cámara en tu navegador.',
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

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        
        if (captureTarget === "STUDENT_PHOTO") {
          setPhotoPreview(dataUrl)
          setValue("photoUrl", dataUrl)
        } else if (captureTarget === "PAYMENT_PROOF") {
          setProofPreview(dataUrl)
          setValue("paymentProofUrl", dataUrl)
        } else if (captureTarget === "BAPTISM_CERT") {
          setBaptismPreview(dataUrl)
          setValue("baptismCertificatePhotoUrl", dataUrl)
        }
        
        stopCamera()
      }
    }
  }

  const handleLookupCi = (ciValue: string) => {
    if (!db || !ciValue || ciValue.length < 5) return;
    setIsSearchingCi(true);
    const cleanCi = ciValue.replace(/\./g, "").trim();
    const cleanCiForDoc = cleanCi.replace(/[^0-9]/g, '');
    const cedulaRef = doc(db, "cedulas", cleanCiForDoc);
    getDoc(cedulaRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.NOMBRE && data.APELLIDO) setValue("fullName", `${data.NOMBRE} ${data.APELLIDO}`.trim());
          if (data.NOM_MADRE) setValue("motherName", data.NOM_MADRE);
          if (data.NOM_PADRE) setValue("fatherName", data.NOM_PADRE);
          if (data.FECHA_NACI) setValue("birthDate", data.FECHA_NACI);
          toast({ title: "Datos encontrados", description: "Campos precargados con éxito." });
        }
      })
      .finally(() => setIsSearchingCi(false));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldName: "photoUrl" | "paymentProofUrl" | "baptismCertificatePhotoUrl") => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        if (fieldName === "photoUrl") setPhotoPreview(base64String);
        else if (fieldName === "paymentProofUrl") setProofPreview(base64String);
        else setBaptismPreview(base64String);
        setValue(fieldName, base64String)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRegistration = async (values: FormValues, immediatePayment = false, amount = 0) => {
    if (!db) return;
    
    if (isPublic && !values.paymentProofUrl) {
      form.setError("paymentProofUrl", { type: "manual", message: "Debe adjuntar la foto de su comprobante" });
      return;
    }

    if (immediatePayment) setLoadingWithPayment(true);
    else setLoading(true);

    const regId = `conf_${Date.now()}`
    const regRef = doc(db, "confirmations", regId)
    const catechistName = profile ? `${profile.firstName} ${profile.lastName}` : (isPublic ? "Secretaría Parroquial" : "Sistema")
    
    const amountToRegister = immediatePayment ? amount : 0
    const paymentStatus = amountToRegister >= totalCost ? "PAGADO" : (amountToRegister > 0 ? "PARCIAL" : "PENDIENTE")
    
    const registrationData = {
      userId: user?.uid || "public_registration",
      ...values,
      status: immediatePayment ? "INSCRITO" : "POR_VALIDAR",
      attendanceStatus: "PENDIENTE",
      needsRecovery: false,
      registrationCost: totalCost,
      amountPaid: amountToRegister,
      paymentStatus: paymentStatus,
      validatedAt: immediatePayment ? serverTimestamp() : null,
      validatedBy: catechistName,
      createdAt: serverTimestamp()
    }

    try {
      await setDoc(regRef, registrationData)
      await addDoc(collection(db, "audit_logs"), {
        userId: user?.uid || "public",
        userName: catechistName,
        action: immediatePayment ? "Inscripción con Pago" : "Envío de Inscripción",
        module: "inscripcion",
        details: `${immediatePayment ? `Pago ${paymentStatus} de ${amountToRegister.toLocaleString('es-PY')} Gs. confirmado. ` : ''}Inscripción completa de ${values.fullName}`,
        timestamp: serverTimestamp()
      })
      
      toast({ 
        title: immediatePayment ? "Inscripción y Pago registrados" : "Inscripción registrada", 
        description: "Los datos han sido guardados correctamente." 
      });
      
      setSubmittedData({ ...registrationData, id: regId, createdAt: new Date().toISOString() })
      setIsSubmittedSuccessfully(true)
    } catch (error: any) {
      const permissionError = new FirestorePermissionError({
        path: regRef.path,
        operation: 'create',
        requestResourceData: registrationData,
      })
      errorEmitter.emit('permission-error', permissionError)
    } finally {
      setLoading(false)
      setLoadingWithPayment(false)
    }
  }

  const handleShareReceipt = () => {
    if (!submittedData) return
    const amount = submittedData.amountPaid || 0;
    const pending = (submittedData.registrationCost || 0) - amount;
    const message = encodeURIComponent(`⛪ *Parroquia Perpetuo Socorro*\n\n¡Hola *${submittedData.fullName}*! Tu inscripción para la *Catequesis de Confirmación 2026* ha sido registrada.\n\n*Recibo de Pago N°:* ${submittedData.id?.slice(-6).toUpperCase()}\n*Monto entregado:* ${amount.toLocaleString('es-PY')} Gs.\n*Saldo Pendiente:* ${pending.toLocaleString('es-PY')} Gs.\n*Estado:* ${submittedData.paymentStatus === 'PAGADO' ? '✅ RECIBIDO' : '⏳ PARCIAL / PENDIENTE'}\n\n_Secretaría de Catequesis_`)
    window.open(`https://wa.me/${submittedData.phone?.replace(/[^0-9]/g, '')}?text=${message}`, '_blank')
  }

  const handlePrintPDF = () => {
    setTimeout(() => {
      window.print();
    }, 500);
  }

  if (isSubmittedSuccessfully) {
    const amount = submittedData?.amountPaid || 0;
    const pending = (submittedData?.registrationCost || 0) - amount;
    const today = new Date();
    const day = today.getDate();
    const month = today.toLocaleString('es-PY', { month: 'long' });
    const year = today.getFullYear();

    return (
      <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 max-w-3xl mx-auto print:max-w-none print:m-0">
        <Card className="border-none shadow-2xl bg-white rounded-3xl p-8 space-y-6 overflow-hidden print:shadow-none print:p-0">
          <div className="flex justify-center no-print">
            <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center shadow-inner">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          
          <div className="space-y-2 text-center no-print">
            <h2 className="text-2xl font-headline font-bold text-slate-900 uppercase">Inscripción Completada</h2>
            <p className="text-sm text-slate-500">Se ha generado el recibo oficial de <b>{submittedData?.fullName}</b>.</p>
          </div>

          {/* ÁREA DE RECIBO MODELO ACTUALIZADO */}
          <ScrollArea className="max-h-[70vh] md:max-h-none print:overflow-visible">
            <div className="bg-white p-8 md:p-12 border-2 border-slate-900 text-slate-900 space-y-8 font-serif print:border-slate-900 print:p-12 m-2" id="receipt-area">
              {/* Cabecera Logo Recuadro */}
              <div className="border-2 border-slate-900 p-6 min-h-[160px] flex items-center justify-center relative bg-white">
                <img 
                  src="/logo-recibo.png" 
                  alt="Parroquia Perpetuo Socorro" 
                  className="max-h-32 object-contain"
                  onError={(e) => { e.currentTarget.src = "/logo.png" }}
                />
                <div className="absolute top-2 right-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Parroquia Perpetuo Socorro</div>
              </div>

              {/* Titulo y Monto en Recuadro */}
              <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
                <h1 className="text-5xl font-black italic tracking-tighter">RECIBO</h1>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-bold">Gs.</span>
                  <div className="border-2 border-slate-900 px-8 py-3 min-w-[240px] text-right font-black text-3xl bg-slate-50">
                    {amount.toLocaleString('es-PY')}
                  </div>
                </div>
              </div>

              {/* Campos del Recibo */}
              <div className="space-y-10 text-xl">
                <div className="flex items-baseline gap-4">
                  <span className="whitespace-nowrap font-bold">Recibí(mos) de:</span>
                  <div className="flex-1 border-b border-dotted border-slate-400 font-bold uppercase pb-1 px-4 leading-tight">
                    {submittedData?.fullName}
                  </div>
                </div>

                <div className="flex items-baseline gap-4">
                  <span className="whitespace-nowrap font-bold">la cantidad de:</span>
                  <div className="flex-1 border-b border-dotted border-slate-400 pb-1 px-4 italic leading-tight">
                    {amount.toLocaleString('es-PY')} Guaraníes
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-baseline gap-4">
                    <span className="whitespace-nowrap font-bold">en concepto de:</span>
                    <div className="flex-1 border-2 border-slate-900 px-6 py-3 font-bold text-lg bg-slate-50 uppercase leading-tight">
                      Inscripción Catequesis de Confirmación - {submittedData?.catechesisYear?.replace('_', ' ')}
                    </div>
                  </div>
                  <div className="w-full border-b border-dotted border-slate-400 h-8"></div>
                </div>

                <div className="flex items-baseline gap-4">
                  <span className="whitespace-nowrap font-bold">y en contraprestación de:</span>
                  <div className="flex-1 border-b border-dotted border-slate-400 pb-1 px-4 text-sm text-slate-500 italic leading-tight">
                    {pending > 0 ? `Saldo Pendiente: ${pending.toLocaleString('es-PY')} Gs.` : 'Totalmente cancelado.'}
                  </div>
                </div>
                <div className="w-full border-b border-dotted border-slate-400 h-8"></div>
              </div>

              {/* Pie de Recibo con QR Signature */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-16">
                <div className="flex flex-col justify-end space-y-4">
                  <p className="text-xl italic font-medium">
                    Asunción, a los {day} días de {month} de {year}
                  </p>
                  <div className="flex flex-col items-start">
                    <div className="w-64 border-t-2 border-slate-900"></div>
                    <p className="text-xs font-bold uppercase mt-3 tracking-widest">(Firma y aclaración)</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-2">Recibo N° {submittedData?.id?.slice(-8).toUpperCase()}</p>
                  </div>
                </div>

                <div className="flex flex-col items-center md:items-end gap-4">
                  <div className="p-2 border-2 border-slate-900 rounded-xl bg-white shadow-sm">
                    <QRCodeCanvas 
                      value={`VERIFICADO-PS-${submittedData?.id}-${amount}`}
                      size={120}
                      level="H"
                    />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest">Firma Digitalizada</p>
                    <p className="text-sm font-bold text-slate-900 uppercase">{submittedData?.validatedBy || 'Secretaría Parroquial'}</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase">Catequesis de Confirmación</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Botones de Acción */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 no-print mt-6">
            <Button 
              type="button"
              className="h-14 rounded-2xl font-black bg-slate-900 hover:bg-slate-800 text-white gap-3 shadow-xl transition-all active:scale-95 group" 
              onClick={handlePrintPDF}
            >
              <Download className="h-6 w-6 transition-transform group-hover:scale-110" /> DESCARGAR PDF
            </Button>
            <Button 
              type="button"
              className="h-14 rounded-2xl font-black bg-green-600 hover:bg-green-700 text-white gap-3 shadow-xl active:scale-95 group" 
              onClick={handleShareReceipt}
            >
              <MessageCircle className="h-6 w-6 transition-transform group-hover:scale-110" /> ENVIAR WHATSAPP
            </Button>
            <Button asChild variant="ghost" className="h-12 rounded-xl font-bold col-span-1 sm:col-span-2 text-slate-400 hover:text-primary">
              <Link href={isPublic ? "/" : "/dashboard"}>Finalizar Gestión</Link>
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto pb-12">
      <Card className="border-none shadow-2xl bg-white rounded-3xl overflow-hidden">
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => handleRegistration(v, false))}>
            <CardHeader className="bg-primary text-white p-8">
              <div className="flex items-center gap-3">
                <Church className="h-8 w-8 text-white/80" />
                <div>
                  <CardTitle className="text-2xl font-headline font-bold">Registro de Confirmación 2026</CardTitle>
                  <CardDescription className="text-white/80 font-medium">Parroquia Perpetuo Socorro</CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-8 space-y-12">
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <Avatar className="h-40 w-40 border-4 border-slate-100 shadow-xl">
                    <AvatarImage src={photoPreview || undefined} className="object-cover" />
                    <AvatarFallback className="bg-slate-50 text-slate-300"><User className="h-20 w-20" /></AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 -right-2 flex gap-2">
                    <button type="button" onClick={() => startCamera("STUDENT_PHOTO")} className="h-10 w-10 bg-primary rounded-full flex items-center justify-center text-white border-4 border-white shadow-lg hover:scale-110 transition-transform"><Camera className="h-5 w-5" /></button>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="h-10 w-10 bg-accent rounded-full flex items-center justify-center text-white border-4 border-white shadow-lg hover:scale-110 transition-transform"><ImageIcon className="h-5 w-5" /></button>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "photoUrl")} />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Foto del Confirmando</p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  <h3 className="font-headline font-bold text-lg text-slate-800">Datos del Alumno</h3>
                </div>
                
                <div className="grid gap-6 md:grid-cols-3">
                  <FormField control={form.control} name="ciNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">N° de C.I.</FormLabel>
                      <div className="relative">
                        <FormControl><Input placeholder="Ej. 1234567" {...field} className="h-12 rounded-xl" onBlur={(e) => handleLookupCi(e.target.value)} /></FormControl>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">{isSearchingCi && <Loader2 className="h-4 w-4 animate-spin text-primary" />}</div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="fullName" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel className="font-bold">Nombre Completo</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  <FormField control={form.control} name="birthDate" render={({ field }) => (
                    <FormItem><FormLabel className="font-bold">Fecha Nacimiento</FormLabel><FormControl><Input type="date" {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="age" render={({ field }) => (
                    <FormItem><FormLabel className="font-bold">Edad</FormLabel><FormControl><Input type="number" readOnly {...field} className="h-12 rounded-xl bg-slate-50" /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Celular (WhatsApp)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="09XX-XXX-XXX" 
                          {...field} 
                          className="h-12 rounded-xl" 
                          inputMode="numeric"
                          type="tel"
                          onChange={(e) => handlePhoneChange(e, "phone")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <Separator />

              <div className="space-y-8">
                <div className="flex items-center gap-3 mb-2">
                  <User className="h-5 w-5 text-primary" />
                  <h3 className="font-headline font-bold text-lg text-slate-800">Padres y Tutores</h3>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                  <div className="p-6 bg-slate-50 rounded-2xl space-y-4 border">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest border-b pb-2">Información de la Madre</p>
                    <FormField control={form.control} name="motherName" render={({ field }) => (
                      <FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input {...field} className="h-10 bg-white" /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="motherPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Celular</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="h-10 bg-white" 
                            placeholder="09XX-XXX-XXX"
                            inputMode="numeric"
                            type="tel"
                            onChange={(e) => handlePhoneChange(e, "motherPhone")}
                          />
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>

                  <div className="p-6 bg-slate-50 rounded-2xl space-y-4 border">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest border-b pb-2">Información del Padre</p>
                    <FormField control={form.control} name="fatherName" render={({ field }) => (
                      <FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input {...field} className="h-10 bg-white" /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="fatherPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Celular</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="h-10 bg-white" 
                            placeholder="09XX-XXX-XXX"
                            inputMode="numeric"
                            type="tel"
                            onChange={(e) => handlePhoneChange(e, "fatherPhone")}
                          />
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-8">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <h3 className="font-headline font-bold text-lg text-slate-800">Sacramentos Previos</h3>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="flex flex-col gap-4">
                    <FormField control={form.control} name="hasBaptism" render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-2xl border p-4 bg-slate-50">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-bold text-primary">Tiene Sacramento de Bautismo</FormLabel>
                          <FormDescription className="text-[10px]">Marca si ya fue bautizado.</FormDescription>
                        </div>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="hasFirstCommunion" render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-2xl border p-4 bg-slate-50">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-bold text-primary">Tiene Primera Comunión</FormLabel>
                          <FormDescription className="text-[10px]">Indispensable para 2° año.</FormDescription>
                        </div>
                      </FormItem>
                    )} />
                  </div>

                  {hasBaptism && (
                    <div className="animate-in slide-in-from-right duration-300 space-y-4 p-6 border-2 border-dashed border-primary/20 rounded-3xl bg-primary/[0.02]">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Datos del Acta de Bautismo</p>
                      <FormField control={form.control} name="baptismParish" render={({ field }) => (
                        <FormItem><FormLabel>Parroquia de Bautismo</FormLabel><FormControl><Input {...field} className="h-10 bg-white" placeholder="Ej. Parroquia San Lorenzo" /></FormControl></FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="baptismBook" render={({ field }) => (
                          <FormItem><FormLabel>N° de Libro</FormLabel><FormControl><Input {...field} className="h-10 bg-white" /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="baptismFolio" render={({ field }) => (
                          <FormItem><FormLabel>N° de Folio</FormLabel><FormControl><Input {...field} className="h-10 bg-white" /></FormControl></FormItem>
                        )} />
                      </div>
                      <FormField control={form.control} name="baptismCertificatePhotoUrl" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold">Foto del Certificado de Bautismo</FormLabel>
                          <FormControl>
                            <div 
                              className={cn(
                                "border-2 border-dashed rounded-2xl h-32 flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden",
                                field.value ? "border-green-500 bg-green-50" : "border-slate-300 bg-white hover:border-primary"
                              )}
                            >
                              {baptismPreview ? (
                                <>
                                  <img src={baptismPreview} alt="Certificado" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <Button type="button" size="icon" variant="secondary" className="rounded-full h-8 w-8" onClick={() => startCamera("BAPTISM_CERT")}><Camera className="h-4 w-4" /></Button>
                                    <Button type="button" size="icon" variant="secondary" className="rounded-full h-8 w-8" onClick={() => baptismInputRef.current?.click()}><ImageIcon className="h-4 w-4" /></Button>
                                  </div>
                                </>
                              ) : (
                                <div className="flex flex-col items-center" onClick={() => startCamera("BAPTISM_CERT")}>
                                  <ImageIcon className="h-8 w-8 text-slate-300 mb-1" />
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Subir Foto de Constancia</span>
                                  <div className="flex gap-2 mt-2">
                                    <Button type="button" size="sm" variant="outline" className="h-6 text-[8px]" onClick={(e) => { e.stopPropagation(); startCamera("BAPTISM_CERT"); }}>CÁMARA</Button>
                                    <Button type="button" size="sm" variant="outline" className="h-6 text-[8px]" onClick={(e) => { e.stopPropagation(); baptismInputRef.current?.click(); }}>ARCHIVO</Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <input type="file" ref={baptismInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "baptismCertificatePhotoUrl")} />
                        </FormItem>
                      )} />
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-8">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-primary" />
                  <h3 className="font-headline font-bold text-lg text-slate-800">Elección de Nivel y Horario</h3>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <FormField control={form.control} name="catechesisYear" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Nivel de Catequesis *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccione el año" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="PRIMER_AÑO">1er Año (Juvenil)</SelectItem>
                          <SelectItem value="SEGUNDO_AÑO">2do Año (Juvenil)</SelectItem>
                          <SelectItem value="ADULTOS">Confirmación de Adultos</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="attendanceDay" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Día y Horario *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccione su preferencia" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="SABADO">Sábados (15:30 a 18:30 hs)</SelectItem>
                          <SelectItem value="DOMINGO">Domingos (08:00 a 11:00 hs)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <Separator />

              <div className="space-y-8">
                <div className="flex items-center gap-3">
                  <Wallet className="h-6 w-6 text-primary" />
                  <h3 className="text-lg font-headline font-bold text-slate-900">Información de Pago</h3>
                </div>

                <div className="grid gap-6 md:grid-cols-2 bg-slate-50 p-8 rounded-[2rem] border border-slate-200">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Arancel del Nivel</p>
                      <p className="text-3xl font-black text-primary">{mounted ? totalCost.toLocaleString('es-PY') : "..."} Gs.</p>
                    </div>
                    
                    <div className="space-y-3 pt-2">
                      <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{costs?.paymentMethod === "ALIAS" ? "Alias SIPAP:" : "N° de Cuenta:"}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-black text-slate-900">{costs?.paymentMethod === "ALIAS" ? costs?.alias : costs?.accountNumber}</span>
                          <Button type="button" variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(costs?.paymentMethod === "ALIAS" ? costs?.alias : costs?.accountNumber); toast({title: "Copiado"}); }}><Copy className="h-4 w-4 text-primary" /></Button>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">{costs?.accountOwner}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center space-y-4">
                    <FormField control={form.control} name="paymentProofUrl" render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className="text-center block font-bold text-slate-700">Adjuntar Comprobante (Foto)</FormLabel>
                        <FormControl>
                          <div 
                            className={cn(
                              "border-2 border-dashed rounded-3xl h-48 flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden",
                              field.value ? "border-green-500 bg-green-50" : "border-slate-300 bg-white hover:border-primary"
                            )}
                          >
                            {proofPreview ? (
                              <>
                                <img src={proofPreview} alt="Comprobante" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <Button type="button" variant="secondary" className="rounded-xl h-10 gap-2 font-bold" onClick={() => startCamera("PAYMENT_PROOF")}><Camera className="h-4 w-4" /> RECAPTURAR</Button>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center text-center p-4">
                                <ImageIcon className="h-10 w-10 text-slate-300 mb-2" />
                                <span className="text-xs text-slate-400 font-medium mb-4">Adjunta el comprobante SIPAP/Transferencia</span>
                                <div className="flex gap-2">
                                  <Button type="button" className="h-10 rounded-xl font-bold gap-2" onClick={() => startCamera("PAYMENT_PROOF")}><Camera className="h-4 w-4" /> CÁMARA</Button>
                                  <Button type="button" variant="outline" className="h-10 rounded-xl font-bold gap-2" onClick={() => proofInputRef.current?.click()}><ImageIcon className="h-4 w-4" /> ARCHIVO</Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <input type="file" ref={proofInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "paymentProofUrl")} />
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="bg-slate-50 p-10 border-t flex flex-col md:flex-row items-center justify-end gap-6">
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                {!isPublic && (
                  <div className="flex flex-col gap-2 min-w-[180px]">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Monto Recibido (Gs.)</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input 
                        type="number" 
                        value={customPaymentAmount} 
                        onChange={(e) => handleAmountChange(e.target.value)}
                        max={totalCost}
                        className={cn(
                          "flex h-14 w-full rounded-2xl border bg-white px-3 py-2 pl-10 text-lg font-black text-primary transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          customPaymentAmount > totalCost ? "border-red-500 ring-2 ring-red-100" : "border-primary/20"
                        )}
                      />
                    </div>
                    {customPaymentAmount >= totalCost && (
                      <p className="text-[9px] text-green-600 font-bold text-center uppercase tracking-tighter flex items-center justify-center gap-1">
                        <CheckCircle2 className="h-2 w-2" /> Arancel cubierto al 100%
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  {!isPublic && (
                    <Button 
                      type="button" 
                      variant="outline"
                      disabled={loading || loadingWithPayment} 
                      className="h-14 border-green-600 text-green-700 hover:bg-green-50 rounded-2xl px-8 font-bold gap-2 transition-all active:scale-95 shadow-sm"
                      onClick={form.handleSubmit((v) => handleRegistration(v, true, customPaymentAmount))}
                    >
                      {loadingWithPayment ? <Loader2 className="animate-spin h-5 w-5" /> : <><CheckCircle2 className="h-5 w-5" /> Confirmar Pago y Registrar</>}
                    </Button>
                  )}
                  
                  <Button 
                    type="submit" 
                    disabled={loading || loadingWithPayment} 
                    className="h-14 bg-primary hover:bg-primary/90 text-white rounded-2xl px-12 font-bold shadow-xl transition-all active:scale-95"
                  >
                    {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <span>Completar Inscripción</span>}
                  </Button>
                </div>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <Dialog open={showCamera} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary text-white">
            <DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Capturar Foto</DialogTitle>
          </DialogHeader>
          
          <div className="relative bg-black aspect-video flex items-center justify-center">
            <video 
              ref={onVideoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-cover" 
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {hasCameraPermission === false && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-white bg-slate-900/90 gap-4">
                <X className="h-12 w-12 text-red-500" />
                <p className="font-bold">Acceso a cámara requerido</p>
                <p className="text-xs text-slate-400">Para usar esta función debes habilitar los permisos en la configuración de tu navegador.</p>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-col gap-4">
            {devices.length > 1 && (
              <div className="flex items-center gap-2 w-full">
                <FlipHorizontal className="h-4 w-4 text-slate-400" />
                <Select value={selectedDeviceId} onValueChange={(val) => { setSelectedDeviceId(val); startCamera(captureTarget, val); }}>
                  <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="Cambiar Cámara" /></SelectTrigger>
                  <SelectContent>
                    {devices.map((device) => (<SelectItem key={device.deviceId} value={device.deviceId}>{device.label || `Cámara ${device.deviceId.slice(0, 5)}`}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={stopCamera}>Cancelar</Button>
              <Button className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 font-bold gap-2" onClick={takePhoto}>
                <Camera className="h-5 w-5" /> Tomar Foto
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
