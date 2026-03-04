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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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

  const formatNumberWithDots = (val: number | string) => {
    if (val === null || val === undefined || val === '') return '';
    const num = typeof val === 'string' ? val.replace(/\D/g, '') : val.toString();
    if (!num) return '';
    return Number(num).toLocaleString('es-PY');
  };

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
    const cleanVal = val.replace(/\D/g, '');
    if (cleanVal === '') {
      setCustomPaymentAmount(0);
      return;
    }
    const num = Number(cleanVal);
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
        video: {
          ...deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" },
          aspectRatio: { ideal: 0.75 }
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
      
      const targetRatio = 3 / 4;
      let sourceWidth = video.videoWidth;
      let sourceHeight = video.videoHeight;
      let sourceX = 0;
      let sourceY = 0;

      if (sourceWidth / sourceHeight > targetRatio) {
        const newWidth = sourceHeight * targetRatio;
        sourceX = (sourceWidth - newWidth) / 2;
        sourceWidth = newWidth;
      } else {
        const newHeight = sourceWidth / targetRatio;
        sourceY = (sourceHeight - newHeight) / 2;
        sourceHeight = newHeight;
      }

      canvas.width = 480;
      canvas.height = 640;
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)
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

  const handleLookupCi = async (ciValue: string) => {
    if (!db || !ciValue || ciValue.length < 5) return;
    
    setIsSearchingCi(true);
    const cleanCi = ciValue.replace(/\./g, "").trim();
    const cleanCiForDoc = cleanCi.replace(/[^0-9]/g, '');

    try {
      const existingQuery = query(collection(db, "confirmations"), where("ciNumber", "==", ciValue));
      const existingSnap = await getDocs(existingQuery);
      
      if (!existingSnap.empty) {
        form.setError("ciNumber", { 
          type: "manual", 
          message: "Esa persona ya se encuentra inscripta" 
        });
        toast({
          variant: "destructive",
          title: "Inscripción Duplicada",
          description: "Esta persona ya se encuentra registrada en el sistema."
        });
        setIsSearchingCi(false);
        return;
      } else {
        form.clearErrors("ciNumber");
      }

      const cedulaRef = doc(db, "cedulas", cleanCiForDoc);
      const docSnap = await getDoc(cedulaRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.NOMBRE && data.APELLIDO) setValue("fullName", `${data.NOMBRE} ${data.APELLIDO}`.trim().toUpperCase());
        if (data.NOM_MADRE) setValue("motherName", data.NOM_MADRE.toUpperCase());
        if (data.NOM_PADRE) setValue("fatherName", data.NOM_PADRE.toUpperCase());
        if (data.FECHA_NACI) setValue("birthDate", data.FECHA_NACI);
        toast({ title: "Datos encontrados", description: "Campos precargados con éxito." });
      } else {
        toast({ variant: "outline", title: "Sin coincidencias", description: "No se encontraron datos para este C.I. en el repositorio." });
      }
    } catch (error) {
      console.error("Error al buscar C.I:", error);
    } finally {
      setIsSearchingCi(false);
    }
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
    if (!db || !treasuryRef) return;
    
    if (immediatePayment) setLoadingWithPayment(true);
    else setLoading(true);

    try {
      const existingQuery = query(collection(db, "confirmations"), where("ciNumber", "==", values.ciNumber));
      const existingSnap = await getDocs(existingQuery);
      
      if (!existingSnap.empty) {
        toast({
          variant: "destructive",
          title: "Error de Duplicidad",
          description: "Esta persona ya se encuentra inscripta. No se puede duplicar el registro."
        });
        setLoading(false);
        setLoadingWithPayment(false);
        return;
      }

      const regId = `conf_${Date.now()}`
      const regRef = doc(db, "confirmations", regId)
      const catechistName = profile ? `${profile.firstName} ${profile.lastName}` : (isPublic ? "Secretaría del Santuario" : "Sistema")
      
      const amountToRegister = immediatePayment ? amount : 0
      const paymentStatus = amountToRegister >= totalCost ? "PAGADO" : (amountToRegister > 0 ? "PARCIAL" : "PENDIENTE")
      
      let assignedReceiptNumber = "";

      await runTransaction(db, async (transaction) => {
        const treasurySnap = await transaction.get(treasuryRef);
        if (!treasurySnap.exists()) throw "Settings not found";
        
        if (immediatePayment) {
          const currentNext = treasurySnap.data()?.nextReceiptNumber || 1;
          assignedReceiptNumber = `001-001-${String(currentNext).padStart(7, '0')}`;
          transaction.update(treasuryRef, { nextReceiptNumber: currentNext + 1 });
        }

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
          receiptNumber: assignedReceiptNumber,
          lastPaymentMethod: immediatePayment ? paymentType : null,
          createdAt: serverTimestamp()
        }

        transaction.set(regRef, registrationData);

        const logRef = doc(collection(db, "audit_logs"));
        transaction.set(logRef, {
          userId: user?.uid || "public",
          userName: catechistName,
          action: immediatePayment ? `Inscripción con Pago (${paymentType})` : "Envío de Inscripción",
          module: "inscripcion",
          details: `${immediatePayment ? `Pago ${paymentStatus} de ${amountToRegister.toLocaleString('es-PY')} Gs. verificado (${assignedReceiptNumber}). ` : ''}Inscripción completa de ${values.fullName}`,
          timestamp: serverTimestamp()
        });

        if (immediatePayment) {
          setSubmittedData({ 
            ...registrationData, 
            id: regId, 
            createdAt: new Date().toISOString() 
          });
        }
      });
      
      if (immediatePayment) {
        toast({ 
          title: "Inscripción y Pago registrados", 
          description: "Los datos han sido guardados correctamente." 
        });
        setTimeout(() => setIsSubmittedSuccessfully(true), 100);
      } else {
        // Inscripción sin pago inmediato
        form.reset();
        setPhotoPreview(null);
        setProofPreview(null);
        setBaptismPreview(null);
        toast({ 
          title: "¡Éxito!", 
          description: "Se ha inscripto satisfactoriamente.",
        });
        // Permanecemos en el módulo (isSubmittedSuccessfully sigue en false)
      }
    } catch (error: any) {
      console.error("Error en registro:", error);
      const permissionError = new FirestorePermissionError({
        path: "confirmations",
        operation: 'create',
        requestResourceData: values,
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
    const receiptNum = submittedData.receiptNumber || `001-001-${submittedData.id?.slice(-7).padStart(7, '0')}`;
    const message = encodeURIComponent(`⛪ *SANTUARIO NACIONAL NTRA. SRA. DEL PERPETUO SOCORRO*\n\n¡Hola *${submittedData.fullName}*! Tu inscripción para la *Catequesis de Confirmación 2026* ha sido registrada.\n\n*Recibo Oficial N°:* ${receiptNum}\n*Monto entregado:* ${amount.toLocaleString('es-PY')} Gs.\n*Saldo Pendiente:* ${pending.toLocaleString('es-PY')} Gs.\n*Estado:* ${submittedData.paymentStatus === 'PAGADO' ? '✅ RECIBIDO' : '⏳ PARCIAL / PENDIENTE'}\n\n_Secretaría de Catequesis_`)
    window.open(`https://wa.me/${submittedData.phone?.replace(/[^0-9]/g, '')}?text=${message}`, '_blank')
  }

  const handleDownloadPDF = async () => {
    const element = document.getElementById("receipt-area");
    if (!element) return;
    
    setIsGeneratingPDF(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Recibo-Santuario-NSPS-${submittedData?.fullName?.replace(/\s+/g, '-')}.pdf`);
      
      toast({ title: "Descarga completada", description: "El PDF ha sido generado correctamente." });
    } catch (err) {
      console.error("PDF Error:", err);
      toast({ variant: "destructive", title: "Error al generar PDF" });
    } finally {
      setIsGeneratingPDF(false);
    }
  }

  if (isSubmittedSuccessfully && submittedData) {
    const amount = submittedData?.amountPaid || 0;
    const pending = (submittedData?.registrationCost || 0) - amount;
    const receiptNum = submittedData.receiptNumber || `001-001-${submittedData.id?.slice(-7).padStart(7, '0')}`;

    return (
      <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 max-w-3xl mx-auto print:max-w-none print:m-0">
        <Card className="border-none shadow-2xl bg-white rounded-3xl p-4 md:p-8 space-y-6 overflow-hidden print:shadow-none print:p-0">
          <div className="flex justify-center no-print">
            <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center shadow-inner">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          
          <div className="space-y-2 text-center no-print">
            <h2 className="text-2xl font-headline font-bold text-slate-900 uppercase">Inscripción Completada</h2>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge className={cn("rounded-lg h-7 font-black text-[10px]", submittedData?.paymentStatus === 'PAGADO' ? 'bg-green-500' : 'bg-orange-500 text-white')}>
                {submittedData?.paymentStatus}
              </Badge>
            </div>
          </div>

          <ScrollArea className="max-h-[75vh] md:max-h-none print:overflow-visible flex justify-center">
            <div 
              className="bg-white p-6 md:p-10 border-2 border-slate-900 text-slate-900 space-y-10 font-serif print:border-slate-900 print:p-12 m-2 w-full max-w-[700px] transform scale-[0.95] md:scale-100 origin-top" 
              id="receipt-area"
            >
              <div className="grid grid-cols-3 gap-4 items-center mb-4">
                <div className="col-span-2 border-2 border-slate-900 p-4 min-h-[120px] flex items-center justify-center relative bg-white">
                  <div className="absolute top-1 right-2 text-[7px] font-black uppercase tracking-tighter text-slate-400 text-right">Santuario Nacional<br/>Nuestra Señora del Perpetuo Socorro</div>
                  <img 
                    src="/logo.png" 
                    alt="Santuario Nacional NSPS" 
                    className="max-h-24 object-contain"
                  />
                </div>
                <div className="flex flex-col gap-2 h-full justify-between">
                  <div className="border-2 border-slate-900 p-2 text-center bg-slate-50">
                    <p className="text-[10px] font-black uppercase">Gs.</p>
                    <p className="text-xl font-black">{amount.toLocaleString('es-PY')}</p>
                  </div>
                  <div className="border-2 border-slate-900 p-2 text-center bg-white">
                    <p className="text-[8px] font-bold uppercase">Recibo N°</p>
                    <p className="text-xs font-black">{receiptNum}</p>
                  </div>
                </div>
              </div>

              <div className="text-center border-b-2 border-slate-900 pb-2 mb-4">
                <h1 className="text-3xl font-black italic tracking-tighter uppercase">RECIBO</h1>
              </div>

              <div className="space-y-10 text-sm md:text-base">
                <div className="flex items-baseline gap-2 py-1">
                  <span className="whitespace-nowrap font-bold shrink-0 tracking-wide">Recibí(mos) de:</span>
                  <div className="flex-1 border-b border-dotted border-slate-400 font-bold uppercase pb-1 px-2 leading-relaxed truncate">
                    {submittedData?.fullName}
                  </div>
                </div>

                <div className="flex items-baseline gap-2 py-1">
                  <span className="whitespace-nowrap font-bold shrink-0 tracking-wide">la cantidad de:</span>
                  <div className="flex-1 border-b border-dotted border-slate-400 pb-1 px-2 italic leading-relaxed">
                    {amount.toLocaleString('es-PY')} Guaraníes
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-baseline gap-2 py-1">
                    <span className="whitespace-nowrap font-bold shrink-0 tracking-wide">en concepto de:</span>
                    <div className="flex-1 border-2 border-slate-900 px-4 py-2 font-bold text-xs bg-slate-50 uppercase leading-relaxed">
                      Inscripción Catequesis de Confirmación - {submittedData?.catechesisYear?.replace('_', ' ')}
                    </div>
                  </div>
                </div>

                <div className="flex items-baseline gap-2 py-1">
                  <span className="whitespace-nowrap font-bold shrink-0 tracking-wide">en concepto de:</span>
                  <div className="flex-1 border-b border-dotted border-slate-400 pb-1 px-2 text-sm text-slate-700 font-medium italic leading-relaxed">
                    Saldo Pendiente: {pending.toLocaleString('es-PY')} Gs.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-10">
                <div className="flex flex-col justify-end space-y-3">
                  <p className="text-sm italic font-medium">
                    Asunción, {currentDateInfo.day} de {currentDateInfo.month} de {currentDateInfo.year}
                  </p>
                  <div className="flex flex-col items-start pt-4">
                    <div className="w-48 border-t border-slate-900"></div>
                    <p className="text-[8px] font-bold uppercase mt-1 tracking-widest">(Firma y aclaración)</p>
                  </div>
                </div>

                <div className="flex flex-col items-center md:items-end gap-3">
                  <div className="p-1.5 border border-slate-900 rounded-lg bg-white shadow-sm">
                    <QRCodeCanvas 
                      value={`VERIFICADO-NSPS-${submittedData?.id}-${amount}-${receiptNum}`}
                      size={80}
                      level="H"
                    />
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black uppercase text-primary tracking-widest leading-none">Firma Digitalizada</p>
                    <p className="text-xs font-bold text-slate-900 uppercase mt-1">{submittedData?.validatedBy || 'Secretaría del Santuario'}</p>
                    <p className="text-[8px] text-slate-500 font-bold uppercase">Catequesis de Confirmación</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 no-print mt-6">
            <Button 
              type="button"
              className="h-14 rounded-2xl font-black bg-slate-900 hover:bg-slate-800 text-white gap-3 shadow-xl transition-all active:scale-95 group" 
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
            >
              {isGeneratingPDF ? <Loader2 className="h-6 w-6 animate-spin" /> : <Download className="h-6 w-6 transition-transform group-hover:scale-110" />} 
              DESCARGAR PDF
            </Button>
            <Button 
              type="button"
              className="h-14 rounded-2xl font-black bg-green-600 hover:bg-green-700 text-white gap-3 shadow-xl active:scale-95 group" 
              onClick={handleShareReceipt}
            >
              <MessageCircle className="h-6 w-6 transition-transform group-hover:scale-110" /> WHATSAPP
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
      <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden">
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => handleRegistration(v, false))}>
            <CardHeader className="bg-primary text-white p-8">
              <div className="flex items-center gap-4">
                <div className="relative h-14 w-14 bg-white rounded-2xl shadow-xl flex items-center justify-center overflow-hidden p-1.5 shrink-0">
                  <Image 
                    src="/logo.png" 
                    alt="Santuario Nacional" 
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <div>
                  <CardTitle className="text-2xl font-headline font-bold">Registro de Confirmación 2026</CardTitle>
                  <CardDescription className="text-white/80 font-medium">Santuario Nacional Nuestra Señora del Perpetuo Socorro</CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-8 space-y-12">
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <Avatar className="h-40 w-40 border-4 border-slate-100 shadow-xl overflow-hidden bg-slate-50">
                    <AvatarImage src={photoPreview || undefined} className="object-cover w-full h-full" />
                    <AvatarFallback className="bg-slate-50 text-slate-300">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Confirmando" className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-20 w-20" />
                      )}
                    </AvatarFallback>
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
                  <h3 className="font-headline font-bold text-lg text-slate-800">Datos del Confirmando</h3>
                </div>
                
                <div className="space-y-4">
                  <p className="text-sm font-bold text-primary italic">
                    Inicie la inscripción insertando el número de cédula del postulante a la confirmación a inscribir
                  </p>
                  <FormField control={form.control} name="ciNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">N° de C.I.</FormLabel>
                      <div className="flex gap-2 items-center">
                        <div className="relative w-full max-w-[250px]">
                          <FormControl>
                            <Input 
                              placeholder="Ej. 1234567" 
                              {...field} 
                              maxLength={9}
                              className="h-12 rounded-xl" 
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleLookupCi(field.value);
                                }
                              }}
                            />
                          </FormControl>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {isSearchingCi && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                          </div>
                        </div>
                        <Button 
                          type="button" 
                          onClick={() => handleLookupCi(field.value)}
                          className="h-12 px-6 rounded-xl font-bold bg-primary hover:bg-primary/90"
                          disabled={isSearchingCi}
                        >
                          {isSearchingCi ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                          BUSCAR
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="fullName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Nombre Completo</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        className="h-12 rounded-xl uppercase" 
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

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
                  <h3 className="font-headline font-bold text-lg text-slate-800">Familia y Tutores</h3>
                </div>

                <div className="grid gap-6 grid-cols-1">
                  <div className="p-6 bg-slate-50 rounded-2xl space-y-4 border">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest border-b pb-2">Información de la Madre</p>
                    <FormField control={form.control} name="motherName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre Completo</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="h-12 bg-white uppercase" 
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          />
                        </FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="motherPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Celular</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="h-12 bg-white" 
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
                      <FormItem>
                        <FormLabel>Nombre Completo</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="h-12 bg-white uppercase" 
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          />
                        </FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="fatherPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Celular</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="h-12 bg-white" 
                            placeholder="09XX-XXX-XXX"
                            inputMode="numeric"
                            type="tel"
                            onChange={(e) => handlePhoneChange(e, "fatherPhone")}
                          />
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>

                  <div className="p-6 bg-slate-50 rounded-2xl space-y-4 border border-dashed border-primary/30">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest border-b pb-2 flex items-center gap-2"><ShieldCheck className="h-3 w-3" /> Información del Tutor</p>
                    <FormField control={form.control} name="tutorName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Tutor</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="h-12 bg-white uppercase" 
                            placeholder="OPCIONAL" 
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          />
                        </FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="tutorPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Celular del Tutor</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="h-12 bg-white" 
                            placeholder="09XX-XXX-XXX"
                            inputMode="numeric"
                            type="tel"
                            onChange={(e) => handlePhoneChange(e, "tutorPhone")}
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
                        <FormItem>
                          <FormLabel>Parroquia de Bautismo</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="h-10 bg-white uppercase" 
                              placeholder="SANTUARIO NACIONAL NSPS" 
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            />
                          </FormControl>
                        </FormItem>
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
                                (baptismPreview || field.value) ? "border-green-500 bg-green-50" : "border-slate-300 bg-white hover:border-primary"
                              )}
                            >
                              {(baptismPreview || field.value) ? (
                                <div className="w-full h-full relative group">
                                  <img src={baptismPreview || field.value} alt="Certificado" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button type="button" onClick={() => startCamera("BAPTISM_CERT")} className="h-8 w-8 bg-white/40 rounded-full flex items-center justify-center text-white hover:bg-white/60"><Camera className="h-4 w-4" /></button>
                                    <button type="button" onClick={() => baptismInputRef.current?.click()} className="h-8 w-8 bg-white/40 rounded-full flex items-center justify-center text-white hover:bg-white/60"><ImageIcon className="h-4 w-4" /></button>
                                  </div>
                                </div>
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
                    {isPublic && (
                      <FormField control={form.control} name="paymentProofUrl" render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel className="text-center block font-bold text-slate-700">Adjuntar Comprobante (Foto)</FormLabel>
                          <FormControl>
                            <div 
                              className={cn(
                                "border-2 border-dashed rounded-3xl h-48 flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden",
                                (proofPreview || field.value) ? "border-green-500 bg-green-50" : "border-slate-300 bg-white hover:border-primary"
                              )}
                            >
                              {(proofPreview || field.value) ? (
                                <div className="w-full h-full relative group">
                                  <img src={proofPreview || field.value} alt="Comprobante de Pago" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <Button type="button" variant="secondary" className="rounded-xl h-10 gap-2 font-bold" onClick={() => startCamera("PAYMENT_PROOF")}><Camera className="h-4 w-4" /> RECAPTURAR</Button>
                                    <Button type="button" variant="destructive" className="h-10 w-10 rounded-xl" onClick={(e) => { e.stopPropagation(); setProofPreview(null); setValue("paymentProofUrl", ""); }}><X className="h-4 w-4" /></Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center text-center p-4">
                                  <ImageIcon className="h-10 w-10 text-slate-300 mb-2" />
                                  <span className="text-xs text-slate-400 font-medium mb-4">Opcional: Adjunta el comprobante si ya pagaste</span>
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
                    )}
                    {!isPublic && (
                      <div className="p-6 bg-white border border-dashed rounded-3xl text-center w-full">
                        <Info className="h-8 w-8 text-primary/40 mx-auto mb-2" />
                        <p className="text-xs text-slate-500 font-medium">Usa el selector del pie de página para confirmar la recepción del dinero.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="bg-slate-50 p-10 border-t flex flex-col items-center justify-end gap-8">
              {!isPublic && (
                <div className="w-full space-y-6 animate-in slide-in-from-bottom-2 duration-500">
                  <div className="flex flex-col md:flex-row items-center justify-center gap-8 bg-white p-8 rounded-[2.5rem] border shadow-sm">
                    <div className="flex flex-col gap-2 min-w-[220px]">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Monto Recibido (Gs.)</Label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input 
                          type="text" 
                          value={formatNumberWithDots(customPaymentAmount)} 
                          onChange={(e) => handleAmountChange(e.target.value)}
                          className={cn(
                            "flex h-14 w-full rounded-2xl border bg-slate-50 px-3 py-2 pl-10 text-xl font-black text-primary transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            customPaymentAmount > totalCost ? "border-red-500 ring-2 ring-red-100" : "border-primary/20"
                          )}
                        />
                      </div>
                      {customPaymentAmount >= totalCost && (
                        <p className="text-[9px] text-green-600 font-bold text-center uppercase tracking-tighter flex items-center justify-center gap-1">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Arancel cubierto al 100%
                        </p>
                      )}
                    </div>

                    <div className="h-16 w-px bg-slate-100 hidden md:block" />

                    <div className="flex flex-col gap-3 flex-1 max-w-md">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Discriminación de Pago</Label>
                      
                      <RadioGroup 
                        value={paymentType} 
                        onValueChange={(v: "EFECTIVO" | "TRANSFERENCIA") => setPaymentType(v)} 
                        className="grid grid-cols-2 gap-4"
                      >
                        <div className="relative">
                          <RadioGroupItem value="EFECTIVO" id="type-cash" className="sr-only" />
                          <Label 
                            htmlFor="type-cash"
                            className={cn(
                              "flex flex-col items-center justify-center p-4 border-2 rounded-2xl cursor-pointer transition-all gap-2 h-full",
                              paymentType === "EFECTIVO" ? "border-primary bg-primary/5 shadow-sm" : "border-slate-100 hover:border-slate-200 bg-white"
                            )}
                          >
                            <Banknote className={cn("h-6 w-6", paymentType === "EFECTIVO" ? "text-primary" : "text-slate-400")} />
                            <span className={cn("text-[10px] font-black uppercase", paymentType === "EFECTIVO" ? "text-primary" : "text-slate-500")}>Efectivo</span>
                          </Label>
                        </div>
                        
                        <div className="relative">
                          <RadioGroupItem value="TRANSFERENCIA" id="type-bank" className="sr-only" />
                          <Label 
                            htmlFor="type-bank"
                            className={cn(
                              "flex flex-col items-center justify-center p-4 border-2 rounded-2xl cursor-pointer transition-all gap-2 h-full",
                              paymentType === "TRANSFERENCIA" ? "border-primary bg-primary/5 shadow-sm" : "border-slate-100 hover:border-slate-200 bg-white"
                            )}
                          >
                            <ArrowRightLeft className={cn("h-6 w-6", paymentType === "TRANSFERENCIA" ? "text-primary" : "text-slate-400")} />
                            <span className={cn("text-[10px] font-black uppercase", paymentType === "TRANSFERENCIA" ? "text-primary" : "text-slate-500")}>Transferencia</span>
                          </Label>
                        </div>
                      </RadioGroup>

                      {/* DESPLIEGUE DINÁMICO DE COMPROBANTE */}
                      {paymentType === "TRANSFERENCIA" && (
                        <div className="mt-4 animate-in zoom-in-95 fade-in slide-in-from-top-2 duration-300">
                          <FormField control={form.control} name="paymentProofUrl" render={({ field }) => (
                            <FormItem className="w-full">
                              <FormLabel className="text-center block font-bold text-slate-700 text-[10px] uppercase tracking-widest">Adjuntar Comprobante (Foto)</FormLabel>
                              <FormControl>
                                <div 
                                  className={cn(
                                    "border-2 border-dashed rounded-2xl h-32 flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden bg-slate-50/50",
                                    (proofPreview || field.value) ? "border-green-500 bg-green-50" : "border-slate-200 hover:border-primary"
                                  )}
                                >
                                  {(proofPreview || field.value) ? (
                                    <div className="w-full h-full relative group">
                                      <img src={proofPreview || field.value} alt="Comprobante" className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <Button type="button" size="sm" variant="secondary" className="rounded-lg font-bold" onClick={() => startCamera("PAYMENT_PROOF")}><Camera className="h-3 w-3 mr-1" /> RECAPTURAR</Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center text-center p-2" onClick={() => startCamera("PAYMENT_PROOF")}>
                                      <ImageIcon className="h-6 w-6 text-slate-300 mb-1" />
                                      <p className="text-[9px] text-slate-400 font-bold uppercase">Adjuntar Foto de Transferencia</p>
                                      <div className="flex gap-2 mt-2">
                                        <Button type="button" size="sm" variant="outline" className="h-7 text-[8px] rounded-lg" onClick={(e) => { e.stopPropagation(); startCamera("PAYMENT_PROOF"); }}>CÁMARA</Button>
                                        <Button type="button" size="sm" variant="outline" className="h-7 text-[8px] rounded-lg" onClick={(e) => { e.stopPropagation(); proofInputRef.current?.click(); }}>ARCHIVO</Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </FormControl>
                              <input type="file" ref={proofInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "paymentProofUrl")} />
                            </FormItem>
                          )} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                {!isPublic && (
                  <Button 
                    type="button" 
                    variant="outline"
                    disabled={loading || loadingWithPayment} 
                    className="h-16 border-green-600 text-green-700 hover:bg-green-50 rounded-2xl px-10 font-bold gap-3 transition-all active:scale-95 shadow-xl group"
                    onClick={form.handleSubmit((v) => handleRegistration(v, true, customPaymentAmount))}
                  >
                    {loadingWithPayment ? <Loader2 className="animate-spin h-6 w-6" /> : <><CheckCircle2 className="h-6 w-6 group-hover:scale-110 transition-transform" /> Confirmar Pago y Registrar</>}
                  </Button>
                )}
                
                <Button 
                  type="submit" 
                  disabled={loading || loadingWithPayment} 
                  className="h-16 bg-primary hover:bg-primary/90 text-white rounded-2xl px-12 font-bold shadow-2xl transition-all active:scale-95"
                >
                  {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <span>Completar Inscripción</span>}
                </Button>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <Dialog open={showCamera} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-primary text-white">
            <DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Capturar Foto</DialogTitle>
          </DialogHeader>
          
          <div className="relative bg-black aspect-[3/4] max-h-[60vh] mx-auto flex items-center justify-center overflow-hidden">
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
