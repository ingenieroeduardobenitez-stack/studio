
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
  ChevronRight
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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase"
import { doc, setDoc, getDoc, getDocs, query, where, serverTimestamp, collection } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { cn } from "@/lib/utils"
import Image from "next/image"

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

// OPTIMIZACIÓN: Función para comprimir imágenes antes de subir a Firestore
const compressImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new (window as any).Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 400; // Suficiente para documentos y perfil
      const MAX_HEIGHT = 400;
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
      resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compresión agresiva pero legible
    };
  });
};

export function ConfirmationForm({ isPublic = false }: { isPublic?: boolean }) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isSearchingCi, setIsSearchingCi] = useState(false)
  const [isSubmittedSuccessfully, setIsSubmittedSuccessfully] = useState(false)
  const [submittedData, setSubmittedData] = useState<any>(null)

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
      hasBaptism: false, hasFirstCommunion: false
    },
  })

  const { watch, setValue, setError, clearErrors } = form
  const birthDate = watch("birthDate")
  const catechesisYear = watch("catechesisYear")

  const establishedLimit = catechesisYear === "ADULTOS" ? (costs?.adultCost || 50000) : (costs?.juvenileCost || 35000)

  useEffect(() => {
    if (catechesisYear) setValue("registrationCost", establishedLimit)
  }, [catechesisYear, establishedLimit, setValue])

  useEffect(() => {
    if (birthDate) {
      const birth = new Date(birthDate); const now = new Date();
      let calculatedAge = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) calculatedAge--;
      setValue("age", calculatedAge >= 0 ? calculatedAge : 0);
    }
  }, [birthDate, setValue])

  const handleLookupCi = async (ciValue: string) => {
    if (!db || !ciValue || ciValue.length < 5) return;
    setIsSearchingCi(true); clearErrors("ciNumber");
    const cleanCi = ciValue.replace(/[^0-9]/g, '');
    try {
      const ciCheckQuery = query(collection(db, "confirmations"), where("ciNumber", "==", ciValue), where("isArchived", "==", false));
      const querySnapshot = await getDocs(ciCheckQuery);
      if (!querySnapshot.empty) {
        setError("ciNumber", { type: "manual", message: "Esta persona ya se encuentra registrada como inscripta." });
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
        toast({ title: "Datos recuperados del Padrón" });
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
      
      // OPTIMIZACIÓN: Comprimir fotos si existen antes de enviarlas a Firestore
      let finalPhotoUrl = values.photoUrl;
      let finalCertUrl = values.baptismCertificatePhotoUrl;

      if (values.photoUrl?.startsWith('data:image')) {
        finalPhotoUrl = await compressImage(values.photoUrl);
      }
      if (values.baptismCertificatePhotoUrl?.startsWith('data:image')) {
        finalCertUrl = await compressImage(values.baptismCertificatePhotoUrl);
      }

      const regData = {
        ...values,
        photoUrl: finalPhotoUrl || "",
        baptismCertificatePhotoUrl: finalCertUrl || "",
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
          <p className="text-slate-500">La ficha de <strong>{submittedData?.fullName}</strong> ha sido enviada.</p>
          <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed font-mono text-xl font-bold text-primary">
            N° {submittedData?.id.split('_')[1]}
          </div>
        </CardContent>
        <CardFooter className="p-8 bg-slate-50"><Button className="w-full h-14 rounded-2xl font-black bg-slate-900" asChild><Link href={isPublic ? "/" : "/dashboard"}>FINALIZAR</Link></Button></CardFooter>
      </Card>
    )
  }

  return (
    <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden max-w-4xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleRegistration)}>
          <CardHeader className="bg-primary text-white p-8"><CardTitle className="text-2xl font-bold">Ficha de Inscripción 2026</CardTitle></CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2"><UserPlus className="h-5 w-5 text-primary" /><h3 className="font-bold">Datos Personales</h3></div>
              <div className="grid gap-6 md:grid-cols-2">
                <FormField control={form.control} name="ciNumber" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">N° de C.I. *</FormLabel><div className="flex gap-2"><FormControl><Input placeholder="Solo números" {...field} className="h-12 rounded-xl" /></FormControl><Button type="button" onClick={() => handleLookupCi(field.value)} disabled={isSearchingCi} className="h-12 px-6 rounded-xl bg-primary">{isSearchingCi ? <Loader2 className="animate-spin" /> : <Search className="h-4 w-4" />}</Button></div><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="fullName" render={({ field }) => (<FormItem><FormLabel className="font-bold">Nombre Completo *</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl uppercase font-bold" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel className="font-bold">Celular *</FormLabel><FormControl><Input placeholder="09XX" {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="birthDate" render={({ field }) => (<FormItem><FormLabel className="font-bold">Nacimiento *</FormLabel><FormControl><Input type="date" {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="sexo" render={({ field }) => (<FormItem><FormLabel className="font-bold">Sexo *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Femenino</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2"><Church className="h-5 w-5 text-primary" /><h3 className="font-bold">Nivel y Horario</h3></div>
              <div className="grid gap-6 md:grid-cols-2">
                <FormField control={form.control} name="catechesisYear" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">Año *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="PRIMER_AÑO">1° Año</SelectItem><SelectItem value="SEGUNDO_AÑO">2° Año</SelectItem><SelectItem value="ADULTOS">Adultos</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="attendanceDay" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">Horario *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="SABADO">Sábados (15:30)</SelectItem><SelectItem value="DOMINGO">Domingos (08:00)</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2"><Wallet className="h-5 w-5 text-primary" /><h3 className="font-bold">Pago de Inscripción</h3></div>
              <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                <FormItem className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {!isPublic && (<div onClick={() => field.onChange("EFECTIVO")} className={cn("cursor-pointer p-4 rounded-2xl border-2 flex flex-col items-center gap-2", field.value === "EFECTIVO" ? "border-primary bg-primary/5" : "border-slate-100")}><Banknote className={cn("h-6 w-6", field.value === "EFECTIVO" ? "text-primary" : "text-slate-400")} /><span className="text-xs font-bold uppercase">Efectivo</span></div>)}
                  <div onClick={() => field.onChange("TRANSFERENCIA")} className={cn("cursor-pointer p-4 rounded-2xl border-2 flex flex-col items-center gap-2", field.value === "TRANSFERENCIA" ? "border-primary bg-primary/5" : "border-slate-100", isPublic && "sm:col-span-3")}><ArrowRightLeft className={cn("h-6 w-6", field.value === "TRANSFERENCIA" ? "text-primary" : "text-slate-400")} /><span className="text-xs font-bold uppercase">Transferencia</span></div>
                  {!isPublic && (<div onClick={() => field.onChange("SIN_PAGO")} className={cn("cursor-pointer p-4 rounded-2xl border-2 flex flex-col items-center gap-2", field.value === "SIN_PAGO" ? "border-primary bg-primary/5" : "border-slate-100")}><Clock className={cn("h-6 w-6", field.value === "SIN_PAGO" ? "text-primary" : "text-slate-400")} /><span className="text-xs font-bold uppercase">Pendiente</span></div>)}
                </FormItem>
              )} />
            </div>
          </CardContent>
          <CardFooter className="bg-slate-50 p-10"><Button type="submit" disabled={loading} className="w-full h-16 bg-primary text-white rounded-2xl text-xl font-bold shadow-2xl">{loading ? <Loader2 className="animate-spin h-6 w-6 mr-2" /> : "ENVIAR INSCRIPCIÓN"}</Button></CardFooter>
        </form>
      </Form>
    </Card>
  )
}
