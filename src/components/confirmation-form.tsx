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
  UserPlus,
  Search,
  Banknote,
  ArrowRightLeft,
  Clock,
  ChevronRight,
  Heart,
  Phone,
  FileText,
  X,
  FlipHorizontal,
  Plus,
  Info,
  Calendar
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
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase"
import { doc, setDoc, getDoc, getDocs, query, where, serverTimestamp, collection } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

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

const compressImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new (window as any).Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 600;
      const MAX_HEIGHT = 600;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
  });
};

export function ConfirmationForm({ isPublic = false }: { isPublic?: boolean }) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isSearchingCi, setIsSearchingCi] = useState(false)
  const [isSubmittedSuccessfully, setIsSubmittedSuccessfully] = useState(false)
  const [submittedData, setSubmittedData] = useState<any>(null)

  const [showCamera, setShowCamera] = useState(false)
  const [cameraTarget, setCameraTarget] = useState<"photoUrl" | "paymentProofUrl" | "baptismCertificatePhotoUrl" | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null)
  
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()

  useEffect(() => { setMounted(true) }, [])

  const treasuryRef = useMemoFirebase(() => db ? doc(db, "settings", "treasury") : null, [db])
  const { data: costs } = useDoc(treasuryRef)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "", ciNumber: "", phone: "", birthDate: "", age: 0, sexo: "",
      photoUrl: "", paymentMethod: isPublic ? "TRANSFERENCIA" : "EFECTIVO",
      registrationCost: 35000, catechesisYear: "PRIMER_AÑO", attendanceDay: "SABADO",
      hasBaptism: false, hasFirstCommunion: false,
      motherName: "", motherPhone: "", fatherName: "", fatherPhone: "", tutorName: "", tutorPhone: ""
    },
  })

  const { watch, setValue, setError, clearErrors } = form
  const birthDate = watch("birthDate")
  const catechesisYear = watch("catechesisYear")
  const hasBaptism = watch("hasBaptism")
  const paymentMethod = watch("paymentMethod")

  const establishedLimit = catechesisYear === "ADULTOS" ? (costs?.adultCost || 50000) : (costs?.juvenileCost || 35000)

  useEffect(() => {
    if (paymentMethod === "SIN_PAGO") {
      setValue("registrationCost", 0);
    } else {
      setValue("registrationCost", establishedLimit);
    }
  }, [paymentMethod, establishedLimit, setValue])

  useEffect(() => {
    if (birthDate) {
      const birth = new Date(birthDate); 
      const now = new Date();
      let calculatedAge = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) calculatedAge--;
      setValue("age", calculatedAge >= 0 ? calculatedAge : 0);
    }
  }, [birthDate, setValue])

  const handleLookupCi = async (ciValue: string) => {
    if (!db || !ciValue || ciValue.length < 5) return;
    setIsSearchingCi(true); 
    clearErrors("ciNumber");
    
    try {
      // 1. VERIFICACIÓN EN LA COLECCIÓN confirmations
      const confirmationsCol = collection(db, "confirmations");
      const ciQuery = query(
        confirmationsCol, 
        where("ciNumber", "==", ciValue)
      );
      
      const existingSnapshot = await getDocs(ciQuery);
      
      if (!existingSnapshot.empty) {
        setError("ciNumber", { 
          type: "manual", 
          message: "Esta persona ya está registrado" 
        });
        toast({ 
          variant: "destructive", 
          title: "Inscripción Duplicada", 
          description: "Esta persona ya está registrado" 
        });
        setIsSearchingCi(false);
        return;
      }

      // 2. Si no es duplicado, buscar datos en el padrón de cédulas
      const cleanCi = ciValue.replace(/[^0-9]/g, '');
      const docSnap = await getDoc(doc(db, "cedulas", cleanCi));
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.NOMBRE && data.APELLIDO) setValue("fullName", `${data.NOMBRE} ${data.APELLIDO}`.toUpperCase());
        if (data.NOM_MADRE) setValue("motherName", data.NOM_MADRE.toUpperCase());
        if (data.NOM_PADRE) setValue("fatherName", data.NOM_PADRE.toUpperCase());
        if (data.FECHA_NACI) setValue("birthDate", data.FECHA_NACI);
        if (data.SEXO) { 
          const s = String(data.SEXO).toUpperCase(); 
          if (s.startsWith('M')) setValue("sexo", "M"); 
          else if (s.startsWith('F')) setValue("sexo", "F"); 
        }
        toast({ title: "Se encontraron los datos" });
      } else {
        toast({ 
          title: "Cédula no encontrada", 
          description: "Por favor, completa los campos manualmente." 
        });
      }
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `confirmations`,
          operation: 'list',
        }));
      }
    } finally { 
      setIsSearchingCi(false); 
    }
  }

  const onVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node && currentStream) {
      if (node.srcObject !== currentStream) {
        node.srcObject = currentStream;
        node.play().catch(err => { if (err.name !== 'AbortError') console.error("Video play error:", err); });
      }
    }
    videoRef.current = node;
  }, [currentStream]);

  const startCamera = async (target: any, deviceId?: string) => {
    setCameraTarget(target)
    try {
      if (currentStream) currentStream.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      setCurrentStream(stream);
      const devices = await navigator.mediaDevices.enumerateDevices();
      setDevices(devices.filter(d => d.kind === 'videoinput'));
      setShowCamera(true);
    } catch (e) { toast({ variant: 'destructive', title: 'Error cámara' }); }
  }

  const takePhoto = async () => {
    if (videoRef.current && canvasRef.current && cameraTarget) {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const compressed = await compressImage(dataUrl);
      setValue(cameraTarget, compressed);
      setShowCamera(false);
      if (currentStream) currentStream.getTracks().forEach(t => t.stop());
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: any) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setValue(target, compressed);
      };
      reader.readAsDataURL(file);
    }
  }

  const handleRegistration = async (values: FormValues) => {
    if (!db) return;
    setLoading(true);
    try {
      const regId = `conf_${Date.now()}`;
      const isEfectivo = values.paymentMethod === "EFECTIVO";
      const regCost = Number(values.registrationCost);
      
      const regData = {
        ...values,
        userId: user?.uid || (isPublic ? "public_registration" : "manual"),
        status: isEfectivo ? "INSCRITO" : "POR_VALIDAR",
        paymentStatus: isEfectivo ? "PAGADO" : "PENDIENTE",
        amountPaid: isEfectivo ? regCost : 0,
        isArchived: false,
        createdAt: serverTimestamp()
      }

      await setDoc(doc(db, "confirmations", regId), regData);
      setSubmittedData({ ...regData, id: regId });
      setIsSubmittedSuccessfully(true);
      toast({ title: "Inscripción recibida correctamente" });
    } catch (e) { toast({ variant: "destructive", title: "Error al guardar" }); }
    finally { setLoading(false); }
  }

  if (isSubmittedSuccessfully) {
    return (
      <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden max-w-2xl mx-auto text-center">
        <div className="bg-primary p-12 text-white">
          <CheckCircle2 className="h-16 w-16 mx-auto mb-4" />
          <h2 className="text-3xl font-black uppercase">¡Registro Exitoso!</h2>
        </div>
        <CardContent className="p-10 space-y-4">
          <p className="text-slate-500">La ficha de <strong>{submittedData?.fullName}</strong> ha sido enviada correctamente al Santuario.</p>
          <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed font-mono text-2xl font-bold text-primary">
            N° {submittedData?.id.split('_')[1]}
          </div>
          <p className="text-xs text-slate-400">Guarda este número para cualquier consulta sobre tu inscripción.</p>
        </CardContent>
        <CardFooter className="p-8 bg-slate-50">
          <Button className="w-full h-14 rounded-2xl font-black bg-slate-900" asChild>
            <Link href={isPublic ? "/" : "/dashboard"}>FINALIZAR</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (!mounted) return null;

  return (
    <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden max-w-4xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleRegistration)}>
          <CardHeader className="bg-primary text-white p-8">
            <CardTitle className="text-2xl font-bold">Ficha de Inscripción 2026</CardTitle>
            <CardDescription className="text-white/70">Completa todos los campos obligatorios marcados con asterisco (*)</CardDescription>
          </CardHeader>
          
          <CardContent className="p-8 space-y-12">
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <h3 className="font-bold uppercase text-xs tracking-widest text-slate-500">1. Identidad del Postulante</h3>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="md:col-span-2 flex flex-col items-center justify-center space-y-4 py-4">
                  <Label className="font-bold text-slate-700">Foto de Perfil (Frente) *</Label>
                  <div className="relative group">
                    <Avatar className="h-32 w-32 border-4 border-slate-100 shadow-lg">
                      <AvatarImage src={watch("photoUrl")} className="object-cover" />
                      <AvatarFallback className="bg-slate-50 text-slate-300"><User className="h-12 w-12" /></AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-2 -right-2 flex gap-2">
                      <Button type="button" size="icon" className="h-10 w-10 rounded-full bg-primary shadow-lg" onClick={() => startCamera("photoUrl")}><Camera className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="secondary" className="h-10 w-10 rounded-full shadow-lg" onClick={() => fileInputRef.current?.click()}><ImageIcon className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "photoUrl")} />
                </div>

                <FormField control={form.control} name="ciNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">N° de C.I. *</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input 
                          placeholder="Solo números" 
                          {...field} 
                          className="h-12 rounded-xl" 
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleLookupCi(field.value);
                            }
                          }}
                        />
                      </FormControl>
                      <Button type="button" onClick={() => handleLookupCi(field.value)} disabled={isSearchingCi} className="h-12 px-6 rounded-xl bg-primary">
                        {isSearchingCi ? <Loader2 className="animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="fullName" render={({ field }) => (<FormItem><FormLabel className="font-bold">Nombre Completo *</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl uppercase font-bold" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel className="font-bold">Celular *</FormLabel><FormControl><Input placeholder="09XX" {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="birthDate" render={({ field }) => (<FormItem><FormLabel className="font-bold">Nacimiento *</FormLabel><FormControl><div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input type="date" {...field} className="pl-10 h-12 rounded-xl" /></div></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="sexo" render={({ field }) => (<FormItem><FormLabel className="font-bold">Sexo *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Femenino</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2">
                <Heart className="h-5 w-5 text-pink-500" />
                <h3 className="font-bold uppercase text-xs tracking-widest text-slate-500">2. Datos de los Padres / Tutor</h3>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4 p-6 bg-slate-50 rounded-[2rem] border">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Madre</p>
                  <FormField control={form.control} name="motherName" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold">Nombre Completo</FormLabel><FormControl><Input {...field} className="h-10 rounded-lg bg-white uppercase font-medium" /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="motherPhone" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold">Celular</FormLabel><FormControl><Input {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>)} />
                </div>
                <div className="space-y-4 p-6 bg-slate-50 rounded-[2rem] border">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Padre</p>
                  <FormField control={form.control} name="fatherName" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold">Nombre Completo</FormLabel><FormControl><Input {...field} className="h-10 rounded-lg bg-white uppercase font-medium" /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="fatherPhone" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold">Celular</FormLabel><FormControl><Input {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>)} />
                </div>
                <div className="md:col-span-2 space-y-4 p-6 bg-slate-50 rounded-[2rem] border">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tutor Responsable (Si no son los padres)</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField control={form.control} name="tutorName" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold">Nombre del Tutor</FormLabel><FormControl><Input {...field} className="h-10 rounded-lg bg-white uppercase font-medium" /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="tutorPhone" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold">Celular del Tutor</FormLabel><FormControl><Input {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2">
                <Church className="h-5 w-5 text-primary" />
                <h3 className="font-bold uppercase text-xs tracking-widest text-slate-500">3. Nivel y Horario de Asistencia</h3>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <FormField control={form.control} name="catechesisYear" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Año de Catequesis *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="PRIMER_AÑO">PRIMER AÑO</SelectItem>
                        <SelectItem value="SEGUNDO_AÑO">SEGUNDO AÑO</SelectItem>
                        <SelectItem value="ADULTOS">CURSO PARA ADULTOS</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="attendanceDay" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Día de Asistencia *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="SABADO">SÁBADOS (15:30 hs)</SelectItem>
                        <SelectItem value="DOMINGO">DOMINGOS (08:00 hs)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2">
                <FileText className="h-5 w-5 text-orange-500" />
                <h3 className="font-bold uppercase text-xs tracking-widest text-slate-500">4. Sacramentos Recibidos</h3>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <FormField control={form.control} name="hasBaptism" render={({ field }) => (<FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-xl bg-slate-50/50"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel className="font-bold">¿Ya recibió el Bautismo?</FormLabel></div></FormItem>)} />
                  <FormField control={form.control} name="hasFirstCommunion" render={({ field }) => (<FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-xl bg-slate-50/50"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel className="font-bold">¿Ya hizo la Primera Comunión?</FormLabel></div></FormItem>)} />
                </div>

                {hasBaptism && (
                  <div className="space-y-4 p-6 bg-orange-50/30 rounded-[2rem] border border-orange-100 animate-in zoom-in-95">
                    <p className="text-[10px] font-black uppercase text-orange-600 tracking-widest">Datos de Bautismo</p>
                    <FormField control={form.control} name="baptismParish" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold">Parroquia</FormLabel><FormControl><Input {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>)} />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="baptismBook" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold">Libro N°</FormLabel><FormControl><Input {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>)} />
                      <FormField control={form.control} name="baptismFolio" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold">Folio N°</FormLabel><FormControl><Input {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>)} />
                    </div>
                    <div className="space-y-2 pt-2">
                      <Label className="text-xs font-bold">Foto del Certificado</Label>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" className="flex-1 h-10 rounded-lg gap-2" onClick={() => startCamera("baptismCertificatePhotoUrl")}><Camera className="h-4 w-4" /> Cámara</Button>
                        <input type="file" id="cert-upload" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "baptismCertificatePhotoUrl")} />
                        <Button type="button" variant="outline" className="flex-1 h-10 rounded-lg gap-2" onClick={() => document.getElementById('cert-upload')?.click()}><ImageIcon className="h-4 w-4" /> Galería</Button>
                      </div>
                      {watch("baptismCertificatePhotoUrl") && (
                        <div className="relative h-32 w-full rounded-xl overflow-hidden border-2 border-orange-200 mt-2">
                          <img src={watch("baptismCertificatePhotoUrl")} className="w-full h-full object-cover" />
                          <button type="button" className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full" onClick={() => setValue("baptismCertificatePhotoUrl", "")}><X className="h-3 w-3" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2">
                <Wallet className="h-5 w-5 text-primary" />
                <h3 className="font-bold uppercase text-xs tracking-widest text-slate-500">5. Pago de Inscripción</h3>
              </div>
              
              <div className="grid gap-6 md:grid-cols-2 items-center">
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-dashed flex flex-col items-center justify-center space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Arancel del Ciclo Lectivo:</p>
                  <p className="text-4xl font-black text-primary tracking-tighter">{establishedLimit.toLocaleString('es-PY')} Gs.</p>
                </div>

                <FormField control={form.control} name="registrationCost" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Monto a Registrar (Gs)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        className="h-14 text-2xl font-black rounded-2xl bg-white border-primary/20 text-primary text-center"
                        disabled={paymentMethod === "SIN_PAGO"}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (val > establishedLimit) {
                            field.onChange(establishedLimit);
                            toast({ 
                              variant: "destructive", 
                              title: "Monto excedido", 
                              description: `El arancel máximo para este nivel es ${establishedLimit.toLocaleString('es-PY')} Gs.` 
                            });
                          } else {
                            field.onChange(val);
                          }
                        }}
                      />
                    </FormControl>
                    <p className="text-[9px] text-slate-400 italic text-center mt-1">
                      {paymentMethod === "SIN_PAGO" ? "Monto bloqueado para pago en caja." : "Puedes modificar si el pago es parcial."}
                    </p>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                <FormItem className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {!isPublic && (
                    <div onClick={() => field.onChange("EFECTIVO")} className={cn("cursor-pointer p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all", field.value === "EFECTIVO" ? "border-primary bg-primary/5 shadow-inner" : "border-slate-100 hover:bg-slate-50")}>
                      <Banknote className={cn("h-8 w-8", field.value === "EFECTIVO" ? "text-primary" : "text-slate-300")} />
                      <span className="text-xs font-black uppercase">Efectivo (Caja)</span>
                    </div>
                  )}
                  <div onClick={() => field.onChange("TRANSFERENCIA")} className={cn("cursor-pointer p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all", field.value === "TRANSFERENCIA" ? "border-primary bg-primary/5 shadow-inner" : "border-slate-100 hover:bg-slate-50")}>
                    <ArrowRightLeft className={cn("h-8 w-8", field.value === "TRANSFERENCIA" ? "text-primary" : "text-slate-300")} />
                    <span className="text-xs font-black uppercase">Transferencia</span>
                  </div>
                  <div onClick={() => field.onChange("SIN_PAGO")} className={cn("cursor-pointer p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all", field.value === "SIN_PAGO" ? "border-primary bg-primary/5 shadow-inner" : "border-slate-100 hover:bg-slate-50")}>
                    <Clock className={cn("h-8 w-8", field.value === "SIN_PAGO" ? "text-primary" : "text-slate-300")} />
                    <span className="text-xs font-black uppercase text-center">Pagar en caja el día de catequesis</span>
                  </div>
                </FormItem>
              )} />

              {paymentMethod === "TRANSFERENCIA" && (
                <div className="space-y-4 p-8 bg-blue-50/50 rounded-[2.5rem] border border-blue-100 animate-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-3 mb-2">
                    <Info className="h-5 w-5 text-blue-600" />
                    <p className="text-sm font-bold text-blue-900">Instrucciones de Transferencia</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cuenta del Santuario:</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div><p className="text-[9px] font-bold text-slate-500 uppercase">Banco</p><p className="text-sm font-black text-slate-900">{costs?.bankName || "ueno bank"}</p></div>
                      <div><p className="text-[9px] font-bold text-slate-500 uppercase">Titular</p><p className="text-sm font-black text-slate-900">{costs?.accountOwner || "Santuario Nacional NSPS"}</p></div>
                      <div className="col-span-2 bg-blue-50 p-3 rounded-xl"><p className="text-[9px] font-bold text-blue-600 uppercase">Alias SIPAP</p><p className="text-lg font-black text-blue-700">{costs?.alias || "parroquia.ps"}</p></div>
                    </div>
                  </div>
                  <div className="space-y-3 pt-4">
                    <Label className="font-bold text-blue-900">Comprobante de Pago (Foto) *</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button type="button" variant="outline" className="h-12 rounded-xl bg-white gap-2 font-bold" onClick={() => startCamera("paymentProofUrl")}><Camera className="h-4 w-4" /> Cámara</Button>
                      <input type="file" id="proof-upload" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "paymentProofUrl")} />
                      <Button type="button" variant="outline" className="h-12 rounded-xl bg-white gap-2 font-bold" onClick={() => document.getElementById('proof-upload')?.click()}><ImageIcon className="h-4 w-4" /> Galería</Button>
                    </div>
                    {watch("paymentProofUrl") && (
                      <div className="relative h-48 w-full rounded-2xl overflow-hidden border-2 border-blue-200 mt-2 shadow-lg">
                        <img src={watch("paymentProofUrl")} className="w-full h-full object-cover" alt="Comprobante" />
                        <button type="button" className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg" onClick={() => setValue("paymentProofUrl", "")}><X className="h-4 w-4" /></button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="bg-slate-50 p-10">
            <Button type="submit" disabled={loading} className="w-full h-20 bg-primary hover:bg-primary/90 text-white rounded-3xl text-2xl font-black shadow-2xl active:scale-95 transition-all">
              {loading ? <Loader2 className="animate-spin h-8 w-8 mr-3" /> : <><Plus className="h-8 w-8 mr-3" /> ENVIAR MI INSCRIPCIÓN</>}
            </Button>
          </CardFooter>
        </form>
      </Form>

      <Dialog open={showCamera} onOpenChange={(open) => { 
        if(!open && currentStream) currentStream.getTracks().forEach(t => t.stop()); 
        setShowCamera(open); 
      }}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <DialogTitle className="text-center uppercase font-black text-sm tracking-widest">Capturar Fotografía</DialogTitle>
          </DialogHeader>
          <div className="relative bg-black aspect-square flex items-center justify-center overflow-hidden">
            <video ref={onVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-col gap-4">
            {devices.length > 1 && (
              <Select value={selectedDeviceId} onValueChange={(val) => { setSelectedDeviceId(val); startCamera(cameraTarget, val); }}>
                <SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue placeholder="Cambiar Cámara" /></SelectTrigger>
                <SelectContent>
                  {devices.map((d) => (<SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Cámara ${d.deviceId.slice(0,5)}`}</SelectItem>))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1 h-14 rounded-2xl font-black text-xs uppercase" onClick={() => { if(currentStream) currentStream.getTracks().forEach(t=>t.stop()); setShowCamera(false); }}>CANCELAR</Button>
              <Button type="button" className="flex-1 h-14 bg-primary text-white font-black text-xs uppercase shadow-xl" onClick={takePhoto}>CAPTURAR AHORA</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}