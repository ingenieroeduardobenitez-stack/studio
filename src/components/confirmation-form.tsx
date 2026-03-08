
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
    const cleanCi = ciValue.replace(/\./g, "").trim();
    const cleanCiForDoc = cleanCi.replace(/[^0-9]/g, '');

    try {
      try {
        const existingQuery = query(collection(db, "confirmations"), where("ciNumber", "==", ciValue));
        const existingSnap = await getDocs(existingQuery);
        
        if (!existingSnap.empty) {
          form.setError("ciNumber", { type: "manual", message: "Esa persona ya se encuentra inscripta" });
          toast({ variant: "destructive", title: "Inscripción Duplicada", description: "Esta persona ya se encuentra registrada." });
          setIsSearchingCi(false);
          return;
        }
      } catch (e) {}

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
        
        toast({ title: "Datos encontrados", description: "Campos precargados con éxito." });
      }
    } catch (error) {
      console.error("Error al buscar C.I:", error);
    } finally {
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

    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
      URL.revokeObjectURL(objectUrl);
      return;
    }

    compressImage(objectUrl)
      .then(setPreview)
      .catch((err) => {
        const reader = new FileReader();
        reader.onload = () => setPreview(reader.result as string);
        reader.readAsDataURL(file);
      })
      .finally(() => {
        URL.revokeObjectURL(objectUrl);
        if (e.target) e.target.value = "";
      });
  }

  const handleRegistration = async (values: FormValues, immediatePayment = false, amount = 0) => {
    if (!db || !treasuryRef) return;
    
    if (immediatePayment) setLoadingWithPayment(true);
    else setLoading(true);

    try {
      const regId = `conf_${Date.now()}`
      const regRef = doc(db, "confirmations", regId)
      const catechistName = profile ? `${profile.firstName} ${profile.lastName}` : (isPublic ? "Inscripción Pública" : "Sistema")
      
      const amountToRegister = immediatePayment ? amount : 0
      const paymentStatus = amountToRegister >= totalCost ? "PAGADO" : (amountToRegister > 0 ? "PARCIAL" : "PENDIENTE")
      
      let assignedReceiptNumber = "";

      if (isPublic && !immediatePayment) {
        const registrationData = {
          userId: "public_registration",
          ...values,
          status: "POR_VALIDAR",
          attendanceStatus: "PENDIENTE",
          needsRecovery: false,
          registrationCost: totalCost,
          amountPaid: 0,
          paymentStatus: "PENDIENTE",
          validatedAt: null,
          validatedBy: "Sistema",
          receiptNumber: "",
          lastPaymentMethod: null,
          createdAt: serverTimestamp()
        }
        await setDoc(regRef, registrationData);
        
        await addDoc(collection(db, "audit_logs"), {
          userId: "public",
          userName: "Postulante",
          action: "Envío de Inscripción",
          module: "inscripcion",
          details: `Inscripción pública de ${values.fullName}`,
          timestamp: serverTimestamp()
        });

        form.reset();
        setPhotoPreview(null);
        setProofPreview(null);
        setBaptismPreview(null);
        toast({ title: "¡Éxito!", description: "Inscripción enviada para validación." });
      } else {
        await runTransaction(db, async (transaction) => {
          const treasurySnap = await transaction.get(treasuryRef);
          if (!treasurySnap.exists()) throw "Settings not found";
          
          if (immediatePayment) {
            const currentNext = treasurySnap.data()?.nextReceiptNumber || 1;
            assignedReceiptNumber = `001-001-${String(currentNext).padStart(7, '0')}`;
            transaction.update(treasuryRef, { nextReceiptNumber: currentNext + 1 });
          }

          const registrationData = {
            userId: user?.uid || "admin_registration",
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
            userId: user?.uid || "system",
            userName: catechistName,
            action: immediatePayment ? `Inscripción con Pago (${paymentType})` : "Registro Manual",
            module: "inscripcion",
            details: `${immediatePayment ? `Pago verificado. ` : ''}Inscripción de ${values.fullName}`,
            timestamp: serverTimestamp()
          });

          if (immediatePayment) {
            setSubmittedData({ ...registrationData, id: regId, createdAt: new Date().toISOString() });
          }
        });
        
        if (immediatePayment) {
          setIsSubmittedSuccessfully(true);
        } else {
          form.reset();
          setPhotoPreview(null);
          setProofPreview(null);
          setBaptismPreview(null);
          toast({ title: "¡Éxito!", description: "Inscripción registrada correctamente." });
        }
      }
    } catch (error: any) {
      console.error("Error en registro:", error);
      toast({ variant: "destructive", title: "Error en el servidor", description: "No se pudo completar la operación." });
    } finally {
      setLoading(false)
      setLoadingWithPayment(false)
    }
  }

  const renderFilePreview = (preview: string | null) => {
    if (!preview) return null;
    if (preview.startsWith("data:application/pdf")) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-slate-100 gap-3">
          <div className="p-4 bg-red-100 rounded-2xl"><FileText className="h-12 w-12 text-red-600" /></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Documento PDF</span>
        </div>
      );
    }
    return <img src={preview} alt="Vista Previa" className="w-full h-full object-cover" />;
  };

  const handleShareReceipt = () => {
    if (!submittedData) return;
    
    let phone = submittedData.phone || "";
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
    if (!cleanPhone.startsWith('595')) cleanPhone = '595' + cleanPhone;

    const amount = submittedData.amountPaid || 0;
    const receiptNum = submittedData.receiptNumber || `001-001-${submittedData.id?.slice(-7).padStart(7, '0')}`;
    const message = encodeURIComponent(`⛪ *SANTUARIO NACIONAL NSPS*\n\n¡Hola *${submittedData.fullName}*! Tu inscripción para la *Catequesis de Confirmación 2026* ha sido registrada.\n\n*Recibo Oficial N°:* ${receiptNum}\n*Monto:* ${amount.toLocaleString('es-PY')} Gs.\n\n_Secretaría de Catequesis_`)
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank')
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
        backgroundColor: "#ffffff",
        width: 650,
        windowWidth: 650,
        onclone: (doc) => {
          const el = doc.getElementById("receipt-area");
          if (el) {
            el.style.width = "650px";
            el.style.maxWidth = "650px";
            el.style.margin = "0 auto";
            el.style.padding = "15px";
          }
        }
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      const yPos = (pdf.internal.pageSize.getHeight() - pdfHeight) / 4;
      pdf.addImage(imgData, "PNG", 0, Math.max(10, yPos), pdfWidth, pdfHeight);
      pdf.save(`Recibo-NSPS-${submittedData?.fullName?.replace(/\s+/g, '-')}.pdf`);
      toast({ title: "Descarga completada" });
    } catch (err) {
      toast({ variant: "destructive", title: "Error al generar PDF" });
    } finally {
      setIsGeneratingPDF(false);
    }
  }

  const handleDownloadImage = async () => {
    const element = document.getElementById("receipt-area");
    if (!element) return;
    setIsGeneratingPDF(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: "#ffffff",
        width: 650,
        windowWidth: 650,
        onclone: (doc) => {
          const el = doc.getElementById("receipt-area");
          if (el) {
            el.style.width = "650px";
            el.style.maxWidth = "650px";
            el.style.margin = "0 auto";
            el.style.padding = "15px";
          }
        }
      });
      const url = canvas.toDataURL("image/png");

      // SOPORTE PARA COMPARTIR IMAGEN NATIVA
      if (navigator.share && navigator.canShare) {
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], `Recibo-${submittedData?.fullName?.split(' ')[0] || 'NSPS'}.png`, { type: 'image/png' });
        
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'Recibo de Inscripción',
              text: `Recibo de Pago - ${submittedData?.fullName}`,
            });
            setIsGeneratingPDF(false);
            return;
          } catch (shareErr) {
            console.log("Share failed or cancelled");
          }
        }
      }

      // Fallback
      const link = document.createElement("a");
      link.download = `Recibo-NSPS-${submittedData?.fullName?.replace(/\s+/g, '-')}.png`;
      link.href = url;
      link.click();
      toast({ title: "Imagen generada" });
    } catch (err) {
      toast({ variant: "destructive", title: "Error al generar imagen" });
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
            <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center shadow-inner"><CheckCircle2 className="h-8 w-8 text-green-600" /></div>
          </div>
          <div className="space-y-2 text-center no-print">
            <h2 className="text-2xl font-headline font-bold text-slate-900 uppercase">Inscripción Completada</h2>
            <Badge className={cn("rounded-lg h-7 font-black text-[10px]", submittedData?.paymentStatus === 'PAGADO' ? 'bg-green-500' : 'bg-orange-500 text-white')}>{submittedData?.paymentStatus}</Badge>
          </div>
          <ScrollArea className="max-h-[75vh] md:max-h-none print:overflow-visible flex justify-center">
            <div className="p-4 bg-white flex justify-center">
              <div className="bg-white p-6 md:p-10 border-2 border-slate-900 text-slate-900 space-y-4 font-serif w-full max-w-[650px] shadow-sm" id="receipt-area">
                <div className="grid grid-cols-3 gap-4 items-center mb-1">
                  <div className="col-span-2 border-2 border-slate-900 p-3 min-h-[80px] flex items-center justify-center relative bg-white">
                    <img src="/logo.png" alt="Santuario Nacional NSPS" className="max-h-16 object-contain" />
                  </div>
                  <div className="flex flex-col gap-1.5 h-full justify-between">
                    <div className="border-2 border-slate-900 p-1.5 text-center bg-slate-50"><p className="text-[7px] font-black uppercase">Gs.</p><p className="text-base font-black">{amount.toLocaleString('es-PY')}</p></div>
                    <div className="border-2 border-slate-900 p-1 text-center bg-white"><p className="text-[6px] font-bold uppercase">Recibo N°</p><p className="text-[9px] font-black">{receiptNum}</p></div>
                  </div>
                </div>
                <div className="text-center border-b-2 border-slate-900 pb-0.5 mb-1"><h1 className="text-xl font-black italic tracking-tighter uppercase">RECIBO</h1></div>
                <div className="space-y-4 text-xs">
                  <div className="flex items-baseline gap-2 py-0.5"><span className="whitespace-nowrap font-bold shrink-0 tracking-wide text-[10px]">Recibí(mos) de:</span><div className="flex-1 border-b border-dotted border-slate-400 font-bold uppercase pb-0.5 px-2 leading-relaxed truncate text-[10px]">{submittedData?.fullName}</div></div>
                  <div className="flex items-baseline gap-2 py-0.5"><span className="whitespace-nowrap font-bold shrink-0 tracking-wide text-[10px]">la cantidad de:</span><div className="flex-1 border-b border-dotted border-slate-400 pb-0.5 px-2 italic leading-relaxed text-[10px]">{amount.toLocaleString('es-PY')} Guaraníes</div></div>
                  <div className="space-y-1"><div className="flex flex-col gap-1.5 py-0.5"><span className="font-bold tracking-wide text-[10px]">en concepto de:</span><div className="w-full border-2 border-slate-900 px-3 py-2 font-bold text-[10px] bg-slate-50 uppercase leading-relaxed text-center">Inscripción Catequesis de Confirmación - {submittedData?.catechesisYear?.replace('_', ' ')}</div></div></div>
                  <div className="flex items-baseline gap-2 py-0.5"><span className="whitespace-nowrap font-bold shrink-0 tracking-wide text-[10px]">Observación:</span><div className="flex-1 border-b border-dotted border-slate-400 pb-0.5 px-2 text-[9px] text-slate-700 font-medium italic leading-relaxed">Saldo Pendiente: {pending.toLocaleString('es-PY')} Gs.</div></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <div className="flex flex-col justify-end space-y-1"><p className="text-[10px] italic font-medium">Asunción, {currentDateInfo.day} de {currentDateInfo.month} de {currentDateInfo.year}</p><div className="flex flex-col items-start pt-1"><div className="w-32 border-t border-slate-900"></div><p className="text-[6px] font-bold uppercase mt-0.5 tracking-widest">(Firma y aclaración)</p></div></div>
                  <div className="flex items-center flex-col md:items-end gap-2">
                    <div className="p-1 border border-slate-900 rounded-lg bg-white shadow-sm"><QRCodeCanvas value={`VERIFICADO-NSPS-${submittedData?.id}-${amount}-${receiptNum}`} size={60} level="H" /></div>
                    <div className="text-right"><p className="text-[6px] font-black uppercase text-primary tracking-widest leading-none">Firma Digitalizada</p><p className="text-[9px] font-bold text-slate-900 uppercase mt-0.5">{submittedData?.validatedBy || 'Secretaría del Santuario'}</p><p className="text-[6px] text-slate-500 font-bold uppercase">Catequesis de Confirmación</p></div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 no-print mt-6">
            <Button className="h-14 rounded-2xl font-black bg-slate-900 text-white gap-3 shadow-xl" onClick={handleDownloadPDF} disabled={isGeneratingPDF}>{isGeneratingPDF ? <Loader2 className="h-6 w-6 animate-spin" /> : <Download className="h-6 w-6" />} DESCARGAR PDF</Button>
            <Button className="h-14 rounded-2xl font-black bg-blue-600 text-white gap-3 shadow-xl" onClick={handleDownloadImage} disabled={isGeneratingPDF}><Share2 className="h-6 w-6" /> IMAGEN / COMPARTIR</Button>
            <Button variant="outline" className="h-14 rounded-2xl font-black bg-green-600 text-white border-none gap-3 shadow-xl" onClick={handleShareReceipt}><MessageCircle className="h-6 w-6" /> WHATSAPP</Button>
            <Button asChild variant="ghost" className="h-14 rounded-xl font-bold text-slate-400"><Link href={isPublic ? "/" : "/dashboard"}>Finalizar Gestión</Link></Button>
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
                <div className="relative h-14 w-14 bg-white rounded-2xl shadow-xl flex items-center justify-center overflow-hidden p-1.5 shrink-0"><Image src="/logo.png" alt="Santuario Nacional" fill className="object-contain" priority /></div>
                <div><CardTitle className="text-2xl font-headline font-bold">Registro de Confirmación 2026</CardTitle><CardDescription className="text-white/80 font-medium">Santuario Nacional Nuestra Señora del Perpetuo Socorro</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-12">
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <Avatar className="h-40 w-40 border-4 border-slate-100 shadow-xl overflow-hidden bg-slate-50">
                    <AvatarImage src={photoPreview || undefined} className="object-cover w-full h-full" />
                    <AvatarFallback className="bg-slate-50 text-slate-300">{photoPreview ? renderFilePreview(photoPreview) : <User className="h-20 w-20" />}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 -right-2 flex gap-2">
                    <button type="button" onClick={() => startCamera("STUDENT_PHOTO")} className="h-10 w-10 bg-primary rounded-full flex items-center justify-center text-white border-4 border-white shadow-lg"><Camera className="h-5 w-5" /></button>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="h-10 w-10 bg-accent rounded-full flex items-center justify-center text-white border-4 border-white shadow-lg"><ImageIcon className="h-5 w-5" /></button>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "photoUrl")} />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Foto del Confirmando</p>
              </div>
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2"><UserPlus className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg text-slate-800">Datos del Confirmando</h3></div>
                <div className="space-y-4">
                  <p className="text-sm font-bold text-primary italic">Inicie la inscripción insertando el número de cédula del postulante</p>
                  <FormField control={form.control} name="ciNumber" render={({ field }) => (
                    <FormItem><FormLabel className="font-bold">N° de C.I.</FormLabel><div className="flex gap-2 items-center"><div className="relative w-full max-w-[250px]"><FormControl><Input placeholder="Ej. 1234567" {...field} maxLength={9} className="h-12 rounded-xl" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleLookupCi(field.value); } }} /></FormControl><div className="absolute right-3 top-1/2 -translate-y-1/2">{isSearchingCi && <Loader2 className="h-4 w-4 animate-spin text-primary" />}</div></div><Button type="button" onClick={() => handleLookupCi(field.value)} className="h-12 px-6 rounded-xl font-bold bg-primary" disabled={isSearchingCi}>{isSearchingCi ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Search className="h-4 w-4 mr-2" />} BUSCAR</Button></div><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="fullName" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">Nombre Completo</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl uppercase" onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid gap-6 md:grid-cols-4">
                  <FormField control={form.control} name="birthDate" render={({ field }) => (<FormItem><FormLabel className="font-bold">Fecha Nacimiento</FormLabel><FormControl><Input type="date" {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="age" render={({ field }) => (<FormItem><FormLabel className="font-bold">Edad</FormLabel><FormControl><Input type="number" readOnly {...field} className="h-12 rounded-xl bg-slate-50" /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="sexo" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Sexo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 rounded-xl">
                            <SelectValue placeholder="Seleccione sexo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="M">Masculino</SelectItem>
                          <SelectItem value="F">Femenino</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel className="font-bold">Celular (WhatsApp)</FormLabel><FormControl><Input placeholder="09XX-XXX-XXX" {...field} className="h-12 rounded-xl" inputMode="numeric" type="tel" onChange={(e) => handlePhoneChange(e, "phone")} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>
              <Separator />
              <div className="space-y-8">
                <div className="flex items-center gap-3 mb-2"><User className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg text-slate-800">Familia y Tutores</h3></div>
                <div className="grid gap-6 grid-cols-1">
                  <div className="p-6 bg-slate-50 rounded-2xl space-y-4 border">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest border-b pb-2">Información de la Madre</p>
                    <FormField control={form.control} name="motherName" render={({ field }) => (<FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input {...field} className="h-12 bg-white uppercase" onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="motherPhone" render={({ field }) => (<FormItem><Label>Celular</Label><FormControl><Input {...field} className="h-12 bg-white" placeholder="09XX-XXX-XXX" inputMode="numeric" type="tel" onChange={(e) => handlePhoneChange(e, "motherPhone")} /></FormControl></FormItem>)} />
                  </div>
                  <div className="p-6 bg-slate-50 rounded-2xl space-y-4 border">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest border-b pb-2">Información del Padre</p>
                    <FormField control={form.control} name="fatherName" render={({ field }) => (<FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input {...field} className="h-12 bg-white uppercase" onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="fatherPhone" render={({ field }) => (<FormItem><Label>Celular</Label><FormControl><Input {...field} className="h-12 bg-white" placeholder="09XX-XXX-XXX" inputMode="numeric" type="tel" onChange={(e) => handlePhoneChange(e, "fatherPhone")} /></FormControl></FormItem>)} />
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-8">
                <div className="flex items-center gap-3"><BookOpen className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg text-slate-800">Sacramentos Previos</h3></div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="flex flex-col gap-4">
                    <FormField control={form.control} name="hasBaptism" render={({ field }) => (<FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-2xl border p-4 bg-slate-50"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel className="font-bold text-primary">Tiene Sacramento de Bautismo</FormLabel></div></FormItem>)} />
                    <FormField control={form.control} name="hasFirstCommunion" render={({ field }) => (<FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-2xl border p-4 bg-slate-50"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel className="font-bold text-primary">Tiene Primera Comunión</FormLabel><FormDescription className="text-[10px]">Marca si ya realizó su primera comunión</FormDescription></div></FormItem>)} />
                  </div>
                  {hasBaptism && (
                    <div className="animate-in slide-in-from-right duration-300 space-y-4 p-6 border-2 border-dashed border-primary/20 rounded-3xl bg-primary/[0.02]">
                      <FormField control={form.control} name="baptismParish" render={({ field }) => (<FormItem><FormLabel>Parroquia de Bautismo</FormLabel><FormControl><Input {...field} className="h-10 bg-white uppercase" onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl></FormItem>)} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="baptismBook" render={({ field }) => (<FormItem><FormLabel>Libro</FormLabel><FormControl><Input {...field} className="h-10 bg-white" /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="baptismFolio" render={({ field }) => (<FormItem><FormLabel>Folio</FormLabel><FormControl><Input {...field} className="h-10 bg-white" /></FormControl></FormItem>)} />
                      </div>
                      <FormField control={form.control} name="baptismCertificatePhotoUrl" render={({ field }) => (
                        <FormItem><FormLabel className="font-bold">Foto del Certificado</FormLabel><FormControl><div className={cn("border-2 border-dashed rounded-2xl h-32 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden", (baptismPreview || field.value) ? "border-green-500 bg-green-50" : "border-slate-300 bg-white")}>{(baptismPreview || field.value) ? <div className="w-full h-full relative group">{renderFilePreview(baptismPreview || field.value || null)}<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2"><button type="button" onClick={() => startCamera("BAPTISM_CERT")} className="h-8 w-8 bg-white/40 rounded-full flex items-center justify-center text-white"><Camera className="h-4 w-4" /></button></div></div> : <div className="flex flex-col items-center" onClick={() => startCamera("BAPTISM_CERT")}><ImageIcon className="h-8 w-8 text-slate-300 mb-1" /><span className="text-[10px] text-slate-400 font-bold">Subir Constancia</span></div>}</div></FormControl><input type="file" ref={baptismInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, "baptismCertificatePhotoUrl")} /></FormItem>
                      )} />
                    </div>
                  )}
                </div>
              </div>
              <Separator />
              <div className="space-y-8">
                <div className="flex items-center gap-3"><Clock className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg text-slate-800">Nivel y Horario</h3></div>
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField control={form.control} name="catechesisYear" render={({ field }) => (<FormItem><FormLabel className="font-bold">Nivel *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccione el año" /></SelectTrigger></FormControl><SelectContent><SelectItem value="PRIMER_AÑO">1er Año</SelectItem><SelectItem value="SEGUNDO_AÑO">2do Año</SelectItem><SelectItem value="ADULTOS">Adultos</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="attendanceDay" render={({ field }) => (<FormItem><FormLabel className="font-bold">Horario *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccione su preference" /></SelectTrigger></FormControl><SelectContent><SelectItem value="SABADO">Sábados (15:30 a 18:30)</SelectItem><SelectItem value="DOMINGO">Domingos (08:00 a 11:00)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
              </div>
              <Separator />
              <div className="space-y-8">
                <div className="flex items-center gap-3"><Wallet className="h-6 w-6 text-primary" /><h3 className="text-lg font-headline font-bold text-slate-900">Información de Pago</h3></div>
                <div className="grid gap-6 md:grid-cols-2 bg-slate-50 p-8 rounded-[2rem] border">
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Arancel del Nivel</p>
                    <p className="text-3xl font-black text-primary">{mounted ? totalCost.toLocaleString('es-PY') : "..."} Gs.</p>
                    <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">{costs?.paymentMethod === "ALIAS" ? "Alias SIPAP:" : "N° de Cuenta:"}</div>
                      {costs?.paymentMethod === "ALIAS" && <span className="block text-[8px] text-primary font-black mt-0.5">TIPO DE ALIAS: CÉDULA</span>}
                      <div className="flex items-center justify-between"><span className="text-lg font-black text-slate-900">{costs?.paymentMethod === "ALIAS" ? costs?.alias : costs?.accountNumber}</span><Button type="button" variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(costs?.paymentMethod === "ALIAS" ? (costs?.alias || "") : (costs?.accountNumber || "")); toast({title: "Copiado"}); }}><Copy className="h-4 w-4 text-primary" /></Button></div>
                      <p className="text-xs text-slate-500 font-medium">{costs?.accountOwner}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center space-y-4">
                    {isPublic && (
                      <FormField control={form.control} name="paymentProofUrl" render={({ field }) => (
                        <FormItem className="w-full"><FormLabel className="text-center block font-bold text-[10px] uppercase">Adjuntar Comprobante</FormLabel><FormControl><div className={cn("border-2 border-dashed rounded-3xl h-48 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden", (proofPreview || field.value) ? "border-green-500 bg-green-50" : "border-slate-300 bg-white")}>{(proofPreview || field.value) ? <div className="w-full h-full relative group">{renderFilePreview(proofPreview || field.value || null)}<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2"><Button type="button" variant="secondary" className="rounded-xl h-10 font-bold" onClick={() => startCamera("PAYMENT_PROOF")}><Camera className="h-4 w-4" /> RECAPTURAR</Button></div></div> : <div className="flex flex-col items-center text-center p-4" onClick={() => startCamera("PAYMENT_PROOF")}><ImageIcon className="h-10 w-10 text-slate-300 mb-2" /><span className="text-[10px] font-black text-slate-400">Capturar o Subir Archivo</span></div>}</div></FormControl><input type="file" ref={proofInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, "paymentProofUrl")} /><FormMessage /></FormItem>
                      )} />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 p-10 border-t flex flex-col items-center justify-end gap-8">
              {!isPublic && (
                <div className="w-full space-y-6"><div className="flex flex-col md:flex-row items-center justify-center gap-8 bg-white p-8 rounded-[2.5rem] border shadow-sm">
                  <div className="flex flex-col gap-2 min-w-[220px]"><Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Monto Recibido</Label><div className="relative"><CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input type="text" value={formatNumberWithDots(customPaymentAmount)} onChange={(e) => handleAmountChange(e.target.value)} className="flex h-14 w-full rounded-2xl border px-3 py-2 pl-10 text-xl font-black text-primary" /></div></div>
                  <div className="h-16 w-px bg-slate-100 hidden md:block" />
                  <div className="flex flex-col gap-3 flex-1 max-w-md"><Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Discriminación</Label><RadioGroup value={paymentType} onValueChange={(v: any) => setPaymentType(v)} className="grid grid-cols-2 gap-4"><div className="relative"><RadioGroupItem value="EFECTIVO" id="type-cash" className="sr-only" /><Label htmlFor="type-cash" className={cn("flex flex-col items-center justify-center p-4 border-2 rounded-2xl cursor-pointer h-full", paymentType === "EFECTIVO" ? "border-primary bg-primary/5" : "border-slate-100 bg-white")}><Banknote className={cn("h-6 w-6", paymentType === "EFECTIVO" ? "text-primary" : "text-slate-400")} /><span className="text-[10px] font-black uppercase">Efectivo</span></Label></div><div className="relative"><RadioGroupItem value="TRANSFERENCIA" id="type-bank" className="sr-only" /><Label htmlFor="type-bank" className={cn("flex flex-col items-center justify-center p-4 border-2 rounded-2xl cursor-pointer h-full", paymentType === "TRANSFERENCIA" ? "border-primary bg-primary/5" : "border-slate-100 bg-white")}><ArrowRightLeft className={cn("h-6 w-6", paymentType === "TRANSFERENCIA" ? "text-primary" : "text-slate-400")} /><span className="text-[10px] font-black uppercase">Transf.</span></Label></div></RadioGroup></div>
                </div></div>
              )}
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                {!isPublic && <Button type="button" variant="outline" disabled={loading || loadingWithPayment} className="h-16 border-green-600 text-green-700 rounded-2xl px-10 font-bold gap-3" onClick={form.handleSubmit((v) => handleRegistration(v, true, customPaymentAmount))}>{loadingWithPayment ? <Loader2 className="animate-spin h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />} Confirmar Pago y Registrar</Button>}
                <Button type="submit" disabled={loading || loadingWithPayment} className="h-16 bg-primary text-white rounded-2xl px-12 font-bold shadow-2xl">{loading ? <Loader2 className="animate-spin h-6 w-6" /> : <span>Completar Inscripción</span>}</Button>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
      <Dialog open={showCamera} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-primary text-white"><DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Capturar Foto</DialogTitle></DialogHeader>
          <div className="relative bg-black aspect-[3/4] max-h-[60vh] mx-auto flex items-center justify-center overflow-hidden"><video ref={onVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" /><canvas ref={canvasRef} className="hidden" />{hasCameraPermission === false && <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-white bg-slate-900/90 gap-4"><X className="h-12 w-12 text-red-500" /><p className="font-bold">Acceso a cámara requerido</p></div>}</div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-col gap-4">{devices.length > 1 && <div className="flex items-center gap-2 w-full"><FlipHorizontal className="h-4 w-4 text-slate-400" /><Select value={selectedDeviceId} onValueChange={(val) => { setSelectedDeviceId(val); startCamera(captureTarget, val); }}><SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Cambiar Cámara" /></SelectTrigger><SelectContent>{devices.map((device) => (<SelectItem key={device.deviceId} value={device.deviceId}>{device.label || `Cámara ${device.deviceId.slice(0, 5)}`}</SelectItem>))}</SelectContent></Select></div>}<div className="flex gap-3 w-full"><Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={stopCamera}>Cancelar</Button><Button className="flex-1 h-12 rounded-xl bg-primary font-bold gap-2" onClick={takePhoto}><Camera className="h-5 w-5" /> Tomar Foto</Button></div></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
