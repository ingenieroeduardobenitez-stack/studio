
"use client"

import { useState, useRef, useEffect, useMemo } from "react"
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
  MessageCircle,
  FileText,
  Check,
  Info,
  Copy,
  CreditCard,
  Image as ImageIcon,
  Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useFirestore, useUser, useDoc } from "@/firebase"
import { doc, setDoc, getDoc, serverTimestamp, addDoc, collection } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import Link from "next/link"
import { cn } from "@/lib/utils"

const formSchema = z.object({
  fullName: z.string().min(5, "Nombre completo requerido"),
  ciNumber: z.string().min(5, "N° C.I. requerido"),
  phone: z.string().min(8, "N° de celular requerido"),
  birthDate: z.string().min(1, "Fecha de nacimiento requerida"),
  age: z.coerce.number().optional(),
  photoUrl: z.string().optional(),
  paymentProofUrl: z.string().min(1, "Debe adjuntar la foto de su comprobante"),
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
  initialPayment: z.coerce.number().min(0, "Monto inválido").default(0),
  generateReceipt: z.boolean().default(false),
})

type FormValues = z.infer<typeof formSchema>

export function ConfirmationForm({ isPublic = false }: { isPublic?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [isSearchingCi, setIsSearchingCi] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [submittedData, setSubmittedData] = useState<any>(null)
  const [isSubmittedSuccessfully, setIsSubmittedSuccessfully] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const proofInputRef = useRef<HTMLInputElement>(null)
  
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  const router = useRouter()

  const userProfileRef = useMemo(() => db && user?.uid ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc(userProfileRef)

  const treasuryRef = useMemo(() => db ? doc(db, "settings", "treasury") : null, [db])
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
      initialPayment: 0,
      generateReceipt: false,
    },
  })

  const catechesisYear = form.watch("catechesisYear")
  const initialPayment = form.watch("initialPayment")
  const birthDate = form.watch("birthDate")

  useEffect(() => {
    if (birthDate) {
      const birth = new Date(birthDate)
      const now = new Date()
      let calculatedAge = now.getFullYear() - birth.getFullYear()
      const m = now.getMonth() - birth.getMonth()
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
        calculatedAge--
      }
      form.setValue("age", calculatedAge >= 0 ? calculatedAge : 0)
    }
  }, [birthDate, form])

  const handleLookupCi = (ciValue: string) => {
    if (!db || !ciValue || ciValue.length < 5) return;
    setIsSearchingCi(true);
    const cleanCi = ciValue.replace(/\./g, "").trim();
    const cedulaRef = doc(db, "cedulas", cleanCi);
    getDoc(cedulaRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.NOMBRE && data.APELLIDO) form.setValue("fullName", `${data.NOMBRE} ${data.APELLIDO}`.trim());
          if (data.NOM_MADRE) form.setValue("motherName", data.NOM_MADRE);
          if (data.NOM_PADRE) form.setValue("fatherName", data.NOM_PADRE);
          if (data.FECHA_NACI) form.setValue("birthDate", data.FECHA_NACI);
          toast({ title: "Datos encontrados" });
        }
      })
      .finally(() => setIsSearchingCi(false));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldName: "photoUrl" | "paymentProofUrl") => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        if (fieldName === "photoUrl") setPhotoPreview(base64String);
        else setProofPreview(base64String);
        form.setValue(fieldName, base64String)
      }
      reader.readAsDataURL(file)
    }
  }

  const calculateCost = () => {
    if (!catechesisYear) return 0
    if (catechesisYear === "ADULTOS") return costs?.adultCost || 50000
    return costs?.juvenileCost || 35000
  }

  const totalCost = calculateCost()

  const onSubmit = async (values: FormValues) => {
    if (!db) return;
    setLoading(true)
    const regId = `conf_${Date.now()}`
    const regRef = doc(db, "confirmations", regId)
    
    const registrationData = {
      userId: user?.uid || "public_registration",
      ...values,
      status: "POR_VALIDAR",
      attendanceStatus: "PENDIENTE",
      needsRecovery: false,
      registrationCost: totalCost,
      amountPaid: 0,
      paymentStatus: "PENDIENTE",
      createdAt: serverTimestamp()
    }

    try {
      await setDoc(regRef, registrationData)
      await addDoc(collection(db, "audit_logs"), {
        userId: user?.uid || "public",
        userName: profile ? `${profile.firstName} ${profile.lastName}` : (isPublic ? "Usuario Público" : "Sistema"),
        action: "Envío de Inscripción",
        module: "inscripcion",
        details: `Inscripción pendiente de validar: ${values.fullName}`,
        timestamp: serverTimestamp()
      })
      toast({ title: "Datos enviados correctamente" });
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
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado al portapapeles" });
  }

  if (isSubmittedSuccessfully) {
    return (
      <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 max-w-2xl mx-auto">
        <Card className="border-none shadow-2xl bg-white rounded-3xl p-10 text-center space-y-6">
          <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-headline font-bold text-slate-900">¡Inscripción Recibida!</h2>
            <p className="text-slate-500 font-medium">Hola <span className="text-primary font-bold">{submittedData?.fullName}</span>, hemos recibido tus datos y el comprobante de pago.</p>
          </div>

          <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100 text-left space-y-4">
            <div className="flex items-center gap-3 border-b border-blue-100 pb-4">
              <Clock className="h-6 w-6 text-blue-600" />
              <h3 className="font-bold text-blue-800 uppercase tracking-wider text-sm">Próximos Pasos</h3>
            </div>
            <p className="text-sm text-blue-700 leading-relaxed">
              Tu inscripción se encuentra en estado <span className="font-bold">PENDIENTE DE VALIDACIÓN</span>. 
              Un catequista o tesorero revisará tu transferencia en breve.
            </p>
            <p className="text-sm font-bold text-blue-900 italic">
              * En un plazo no mayor a 24 horas te remitiremos tu recibo oficial vía WhatsApp.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => window.print()}>Imprimir Ficha</Button>
            <Button asChild className="flex-1 h-12 rounded-xl font-bold shadow-lg">
              <Link href="/">Volver al Inicio</Link>
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
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader className="bg-primary text-white p-8">
              <div className="flex items-center gap-3">
                <Church className="h-8 w-8 text-white/80" />
                <div>
                  <CardTitle className="text-2xl font-headline font-bold">Registro de Postulante</CardTitle>
                  <CardDescription className="text-white/80 font-medium">Ciclo Lectivo 2026</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-10">
              {/* FOTO DEL ALUMNO */}
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="relative group">
                  <Avatar className="h-32 w-32 border-4 border-slate-100 shadow-xl">
                    <AvatarImage src={photoPreview || undefined} className="object-cover" />
                    <AvatarFallback className="bg-slate-50 text-slate-300"><User className="h-16 w-16" /></AvatarFallback>
                  </Avatar>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 h-10 w-10 bg-primary rounded-full flex items-center justify-center text-white border-4 border-white shadow-lg"><Camera className="h-5 w-5" /></button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "photoUrl")} />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Foto del Confirmando</p>
              </div>

              <div className="space-y-6">
                <FormField control={form.control} name="ciNumber" render={({ field }) => (
                  <FormItem className="max-w-xs">
                    <FormLabel className="font-semibold">N° de C.I.</FormLabel>
                    <div className="relative">
                      <FormControl><Input placeholder="Ej. 1234567" {...field} className="h-12 rounded-xl border-slate-200" onBlur={(e) => handleLookupCi(e.target.value)} /></FormControl>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isSearchingCi && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid gap-6 md:grid-cols-2">
                  <FormField control={form.control} name="fullName" render={({ field }) => (
                    <FormItem><FormLabel className="font-semibold">Nombre Completo</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel className="font-semibold">Celular (WhatsApp)</FormLabel><FormControl><Input placeholder="09..." {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <FormField control={form.control} name="birthDate" render={({ field }) => (
                    <FormItem><FormLabel className="font-semibold">Fecha de Nacimiento</FormLabel><FormControl><Input type="date" {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="age" render={({ field }) => (
                    <FormItem><FormLabel className="font-semibold">Edad</FormLabel><FormControl><Input type="number" readOnly {...field} className="h-12 rounded-xl bg-slate-50" /></FormControl></FormItem>
                  )} />
                </div>
              </div>

              <Separator />

              <div className="grid gap-6 md:grid-cols-2">
                <FormField control={form.control} name="catechesisYear" render={({ field }) => (
                  <FormItem><FormLabel className="font-semibold">Nivel de Catequesis *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccione el año" /></SelectTrigger></FormControl><SelectContent><SelectItem value="PRIMER_AÑO">1er Año (Juvenil)</SelectItem><SelectItem value="SEGUNDO_AÑO">2do Año (Juvenil)</SelectItem><SelectItem value="ADULTOS">Confirmación de Adultos</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="attendanceDay" render={({ field }) => (
                  <FormItem><FormLabel className="font-semibold">Día de Asistencia Preferido *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccione el día" /></SelectTrigger></FormControl><SelectContent><SelectItem value="SABADO">Sábados</SelectItem><SelectItem value="DOMINGO">Domingos</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
              </div>

              <Separator />

              {/* SECCIÓN DE PAGO */}
              <div className="space-y-8">
                <div className="flex items-center gap-3">
                  <Wallet className="h-6 w-6 text-primary" />
                  <h3 className="text-lg font-headline font-bold text-slate-900">Información de Pago</h3>
                </div>

                <div className="grid gap-6 md:grid-cols-2 bg-slate-50 p-8 rounded-[2rem] border border-slate-200">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Monto a Transferir</p>
                      <p className="text-3xl font-black text-primary">{totalCost.toLocaleString()} Gs.</p>
                    </div>
                    
                    <div className="space-y-3 pt-2">
                      {costs?.paymentMethod === "ALIAS" ? (
                        <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Alias SIPAP:</p>
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-black text-slate-900">{costs?.alias || "---"}</span>
                            <Button type="button" variant="ghost" size="icon" onClick={() => copyToClipboard(costs?.alias)}><Copy className="h-4 w-4 text-primary" /></Button>
                          </div>
                          <p className="text-xs text-slate-500 font-medium">{costs?.accountOwner}</p>
                        </div>
                      ) : (
                        <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Datos Bancarios:</p>
                          <div className="flex items-center justify-between border-b pb-2">
                            <span className="text-sm font-bold">{costs?.bankName}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-base font-mono font-bold">{costs?.accountNumber}</span>
                            <Button type="button" variant="ghost" size="icon" onClick={() => copyToClipboard(costs?.accountNumber)}><Copy className="h-4 w-4 text-primary" /></Button>
                          </div>
                          <p className="text-xs text-slate-500 font-medium">{costs?.accountOwner}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center space-y-4">
                    <FormField control={form.control} name="paymentProofUrl" render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className="text-center block font-bold text-slate-700">Adjuntar Comprobante (Foto)</FormLabel>
                        <FormControl>
                          <div 
                            className={cn(
                              "border-2 border-dashed rounded-3xl h-48 flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden",
                              field.value ? "border-green-500 bg-green-50" : "border-slate-300 hover:border-primary hover:bg-white"
                            )}
                            onClick={() => proofInputRef.current?.click()}
                          >
                            {proofPreview ? (
                              <img src={proofPreview} alt="Comprobante" className="w-full h-full object-cover" />
                            ) : (
                              <>
                                <ImageIcon className="h-10 w-10 text-slate-300 mb-2" />
                                <span className="text-xs text-slate-400 font-medium">Pulsa para subir foto</span>
                              </>
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

            <CardFooter className="bg-slate-50 p-10 border-t flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100">
                  <Info className="h-6 w-6 text-blue-500" />
                </div>
                <p className="text-xs text-blue-700 max-w-xs font-medium">
                  Al enviar, un catequista validará tu transferencia y te enviará tu recibo digital vía WhatsApp.
                </p>
              </div>
              <Button type="submit" disabled={loading} className="h-14 bg-primary hover:bg-primary/90 text-white rounded-2xl px-12 font-bold shadow-xl w-full md:w-auto text-lg transition-all active:scale-95">
                {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <span>Completar Inscripción</span>}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}
