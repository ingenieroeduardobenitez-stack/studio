
"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { 
  Loader2, 
  User,
  BookOpen,
  Church,
  ArrowRight,
  ShieldCheck,
  Users,
  Camera,
  Search,
  CheckCircle2,
  Printer,
  AlertTriangle,
  CreditCard,
  Home,
  Info,
  Wallet,
  MessageCircle,
  Building2,
  FileText
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useFirestore, useUser, useDoc } from "@/firebase"
import { doc, setDoc, getDoc, serverTimestamp, addDoc, collection } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { QRCodeCanvas } from "qrcode.react"

const formSchema = z.object({
  fullName: z.string().min(5, "Nombre completo requerido"),
  ciNumber: z.string().min(5, "N° C.I. requerido"),
  phone: z.string().min(8, "N° de celular requerido"),
  birthDate: z.string().min(1, "Fecha de nacimiento requerida"),
  age: z.coerce.number().optional(),
  photoUrl: z.string().optional(),
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
  generateReceipt: z.boolean().default(true),
})

type FormValues = z.infer<typeof formSchema>

export function ConfirmationForm({ isPublic = false }: { isPublic?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [isSearchingCi, setIsSearchingCi] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [submittedData, setSubmittedData] = useState<any>(null)
  const [isSubmittedSuccessfully, setIsSubmittedSuccessfully] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
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
      generateReceipt: true,
    },
  })

  const catechesisYear = form.watch("catechesisYear")
  const initialPayment = form.watch("initialPayment")
  const hasBaptism = form.watch("hasBaptism")
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
          if (data.NOMBRE && data.APELLIDO) {
            form.setValue("fullName", `${data.NOMBRE} ${data.APELLIDO}`.trim());
          }
          if (data.NOM_MADRE) form.setValue("motherName", data.NOM_MADRE);
          if (data.NOM_PADRE) form.setValue("fatherName", data.NOM_PADRE);
          if (data.FECHA_NACI) form.setValue("birthDate", data.FECHA_NACI);

          toast({
            title: "Datos encontrados",
            description: `Se han cargado los datos de ${data.NOMBRE || 'la persona'}.`,
          });
        }
      })
      .finally(() => {
        setIsSearchingCi(false);
      });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setPhotoPreview(base64String)
        form.setValue("photoUrl", base64String)
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
  const isOverpaid = initialPayment > totalCost

  const onSubmit = async (values: FormValues) => {
    if (!db) return;
    if (!isPublic && isOverpaid) {
      toast({
        variant: "destructive",
        title: "Monto inválido",
        description: `El pago inicial no puede ser mayor al costo total (${totalCost.toLocaleString()} Gs).`
      })
      return
    }

    setLoading(true)
    const regId = `conf_${Date.now()}`
    const regRef = doc(db, "confirmations", regId)
    
    const amountPaid = isPublic ? 0 : values.initialPayment
    const paymentStatus = amountPaid >= totalCost ? "PAGADO" : amountPaid > 0 ? "PARCIAL" : "PENDIENTE"

    const registrationData = {
      userId: user?.uid || "public_registration",
      ...values,
      initialPayment: amountPaid,
      status: "INSCRITO",
      attendanceStatus: "PENDIENTE",
      needsRecovery: false,
      registrationCost: totalCost,
      amountPaid: amountPaid,
      paymentStatus: paymentStatus,
      createdAt: serverTimestamp()
    }

    try {
      await setDoc(regRef, registrationData)
      
      // REGISTRO DE AUDITORÍA
      await addDoc(collection(db, "audit_logs"), {
        userId: user?.uid || "public",
        userName: profile ? `${profile.firstName} ${profile.lastName}` : (isPublic ? "Usuario Público" : "Sistema"),
        action: "Registro de Confirmando",
        module: "inscripcion",
        details: `Nueva inscripción: ${values.fullName} (CI: ${values.ciNumber}) - Nivel: ${values.catechesisYear}`,
        timestamp: serverTimestamp()
      })

      toast({
        title: isPublic ? "Datos enviados" : "Inscripción Realizada",
        description: `Se ha registrado a ${values.fullName} correctamente.`,
      })

      setSubmittedData({ ...registrationData, id: regId, createdAt: new Date().toISOString() })
      
      if (isPublic) {
        setIsSubmittedSuccessfully(true)
      } else if (amountPaid > 0 && values.generateReceipt) {
        setIsReceiptOpen(true)
      } else {
        router.push("/dashboard")
      }
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

  const handleSendProofWhatsApp = () => {
    if (!submittedData) return
    const message = encodeURIComponent(`⛪ *Comprobante de Inscripción*\n\nHola, adjunto el comprobante de transferencia para mi inscripción.\n\n*Nombre:* ${submittedData.fullName}\n*C.I.:* ${submittedData.ciNumber}\n*Nivel:* ${submittedData.catechesisYear.replace("_", " ")}\n\n_Quedo atento a la validación para recibir mi recibo oficial._`)
    window.open(`https://wa.me/?text=${message}`, '_blank')
  }

  const handleCloseReceipt = () => {
    setIsReceiptOpen(false)
    router.push("/dashboard")
  }

  if (isSubmittedSuccessfully) {
    const qrValue = `Banco: ${costs?.bankName}\nCuenta: ${costs?.accountNumber}\nTitular: ${costs?.accountOwner}\nConcepto: Inscripcion ${submittedData?.fullName}`

    return (
      <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 max-w-2xl mx-auto">
        <Card className="border-none shadow-2xl bg-white rounded-3xl p-10 text-center space-y-6">
          <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-headline font-bold text-slate-900">¡Inscripción Enviada!</h2>
            <p className="text-slate-500 font-medium">
              Hola <span className="text-primary font-bold">{submittedData?.fullName}</span>, tus datos han sido recibidos.
            </p>
          </div>

          <div className="bg-primary/5 p-8 rounded-3xl border border-primary/10 text-left space-y-6">
            <div className="flex items-center gap-3 border-b border-primary/10 pb-4">
              <Wallet className="h-6 w-6 text-primary" />
              <h3 className="font-bold text-primary uppercase tracking-wider text-sm">Información para el Pago</h3>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 items-center">
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Total Arancel</p>
                  <p className="text-2xl font-headline font-bold text-slate-900">{totalCost.toLocaleString()} Gs.</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-700">{costs?.bankName || "Cuenta Bancaria"}</p>
                  <p className="text-sm font-mono font-bold text-primary">{costs?.accountNumber || "---"}</p>
                  <p className="text-xs text-slate-500">{costs?.accountOwner || "---"}</p>
                  <p className="text-xs text-slate-500">{costs?.ownerCi || "---"}</p>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-2 bg-white p-4 rounded-2xl border shadow-sm">
                <QRCodeCanvas value={qrValue} size={120} level="M" />
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">QR de Referencia</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-primary/10">
              <div className="text-center space-y-1">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto text-xs font-bold">1</div>
                <p className="text-[10px] font-bold uppercase text-slate-500">Realizar Transferencia</p>
              </div>
              <div className="text-center space-y-1">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto text-xs font-bold">2</div>
                <p className="text-[10px] font-bold uppercase text-slate-500">Enviar Comprobante</p>
              </div>
              <div className="text-center space-y-1">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto text-xs font-bold">3</div>
                <p className="text-[10px] font-bold uppercase text-slate-500">Recibir Recibo Oficial</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-dashed text-xs text-slate-600 space-y-3">
              <p className="font-bold flex items-center gap-2 text-primary"><Info className="h-3 w-3" /> PASO FINAL OBLIGATORIO:</p>
              <p>Para habilitar tu inscripción, debes enviar la captura de tu transferencia. Una vez validada, el sistema emitirá tu recibo legal.</p>
              <Button onClick={handleSendProofWhatsApp} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold h-11 rounded-xl gap-2">
                <MessageCircle className="h-4 w-4" /> Enviar Comprobante por WhatsApp
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir Ficha
            </Button>
            <Button asChild className="flex-1 h-12 rounded-xl font-bold shadow-lg gap-2">
              <Link href="/">
                <Home className="h-4 w-4" /> Volver al Inicio
              </Link>
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
                  <CardDescription className="text-white/80 font-medium">
                    Parroquia Perpetuo Socorro • Ciclo 2026
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-10">
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="relative group">
                  <Avatar className="h-32 w-32 border-4 border-slate-100">
                    <AvatarImage src={photoPreview || undefined} className="object-cover" />
                    <AvatarFallback className="bg-slate-50 text-slate-300">
                      <User className="h-16 w-16" />
                    </AvatarFallback>
                  </Avatar>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 h-10 w-10 bg-primary rounded-full flex items-center justify-center text-white border-4 border-white"><Camera className="h-5 w-5" /></button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sube una foto tipo carnet</p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4"><User className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg text-slate-800">Identificación Personal</h3></div>
                
                <div className="grid gap-6">
                  <FormField control={form.control} name="ciNumber" render={({ field }) => (
                    <FormItem className="max-w-xs">
                      <FormLabel className="font-semibold">N° de Cédula de Identidad</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input 
                            placeholder="Ej. 1234567" 
                            {...field} 
                            className="h-12 rounded-xl bg-slate-50 border-slate-200 pr-12" 
                            onBlur={(e) => {
                              field.onBlur();
                              handleLookupCi(e.target.value);
                            }}
                          />
                        </FormControl>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {isSearchingCi ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 hover:bg-slate-200 rounded-full"
                              onClick={() => handleLookupCi(form.getValues("ciNumber"))}
                            >
                              <Search className="h-4 w-4 text-slate-400" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField control={form.control} name="fullName" render={({ field }) => (
                      <FormItem><FormLabel className="font-semibold">Nombres y Apellidos Completos</FormLabel><FormControl><Input placeholder="Como figura en la cédula" {...field} className="h-12 rounded-xl bg-slate-50 border-slate-200" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem><FormLabel className="font-semibold">Teléfono Celular</FormLabel><FormControl><Input placeholder="Ej. 0981 123 456" {...field} className="h-12 rounded-xl bg-slate-50 border-slate-200" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField control={form.control} name="birthDate" render={({ field }) => (
                      <FormItem><FormLabel className="font-semibold">Fecha de Nacimiento</FormLabel><FormControl><Input type="date" {...field} className="h-12 rounded-xl bg-slate-50 border-slate-200" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="age" render={({ field }) => (
                      <FormItem><FormLabel className="font-semibold">Edad Calculada</FormLabel><FormControl><Input type="number" readOnly {...field} className="h-12 rounded-xl bg-slate-100 border-slate-200 cursor-not-allowed" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4"><Users className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg text-slate-800">Familia y Contacto</h3></div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/30 space-y-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Referencia Materna</p>
                    <FormField control={form.control} name="motherName" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs font-semibold">Nombre de la Madre</FormLabel><FormControl><Input placeholder="Nombre Completo" {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="motherPhone" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs font-semibold">Celular de la Madre</FormLabel><FormControl><Input placeholder="Ej. 09..." {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>
                    )} />
                  </div>
                  <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/30 space-y-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Referencia Paterna</p>
                    <FormField control={form.control} name="fatherName" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs font-semibold">Nombre del Padre</FormLabel><FormControl><Input placeholder="Nombre Completo" {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="fatherPhone" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs font-semibold">Celular del Padre</FormLabel><FormControl><Input placeholder="Ej. 09..." {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>
                    )} />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4"><BookOpen className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg text-slate-800">Preferencias de Catequesis</h3></div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <FormField control={form.control} name="catechesisYear" render={({ field }) => (
                    <FormItem><FormLabel className="font-semibold">Nivel a Cursar *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200"><SelectValue placeholder="Seleccione Nivel" /></SelectTrigger></FormControl><SelectContent><SelectItem value="PRIMER_AÑO">Primer Año (Iniciación)</SelectItem><SelectItem value="SEGUNDO_AÑO">Segundo Año (Candidatos)</SelectItem><SelectItem value="ADULTOS">Catequesis de Adultos</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="attendanceDay" render={({ field }) => (
                    <FormItem><FormLabel className="font-semibold">Día de Asistencia *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200"><SelectValue placeholder="Seleccione Día" /></SelectTrigger></FormControl><SelectContent><SelectItem value="SABADO">Sábados (15:30 - 18:30)</SelectItem><SelectItem value="DOMINGO">Domingos (08:00 - 11:00)</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  
                  {!isPublic && (
                    <div className="space-y-4">
                      <FormField control={form.control} name="initialPayment" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-primary">Monto Cobrado (Gs)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              className={cn(
                                "h-12 rounded-xl font-bold border-2 transition-colors",
                                isOverpaid ? 'bg-red-50 border-red-300 text-red-900' : 'bg-green-50 border-green-200 text-slate-900'
                              )}
                            />
                          </FormControl>
                          <FormDescription className={isOverpaid ? "text-red-500 font-bold flex items-center gap-1" : ""}>
                            {isOverpaid ? <><AlertTriangle className="h-3 w-3" /> Excede el total.</> : "Cobro de inscripción."}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                      
                      <FormField control={form.control} name="generateReceipt" render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-xl bg-slate-50">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-xs font-bold text-slate-600 flex items-center gap-2 cursor-pointer">
                              <FileText className="h-3 w-3 text-primary" /> Generar recibo de pago ahora
                            </FormLabel>
                          </div>
                        </FormItem>
                      )} />
                    </div>
                  )}

                  {isPublic && catechesisYear && (
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"><Info className="h-4 w-4 text-primary" /></div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Costo de Arancel</p>
                        <p className="text-sm font-bold text-primary">{totalCost.toLocaleString()} Gs.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4"><ShieldCheck className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg text-slate-800">Vida Cristiana</h3></div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="hasBaptism" render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 p-5 border rounded-2xl bg-slate-50/50">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-base font-bold cursor-pointer">Cuento con Bautismo</FormLabel>
                        <p className="text-[10px] text-slate-500">Marcar si ya recibió este sacramento.</p>
                      </div>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="hasFirstCommunion" render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 p-5 border rounded-2xl bg-slate-50/50">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-base font-bold cursor-pointer">Cuento con 1ra Comunión</FormLabel>
                        <p className="text-[10px] text-slate-500">Marcar si ya recibió este sacramento.</p>
                      </div>
                    </FormItem>
                  )} />
                </div>

                {hasBaptism && (
                  <div className="grid gap-6 md:grid-cols-3 p-6 bg-primary/5 rounded-3xl border border-primary/10 animate-in zoom-in-95 duration-300">
                    <div className="md:col-span-3 flex items-center gap-2 mb-2">
                      <Church className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Datos de la Fe de Bautismo</h4>
                    </div>
                    <FormField control={form.control} name="baptismParish" render={({ field }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel className="text-xs font-bold text-slate-600">Lugar de Bautismo</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre de la Parroquia" {...field} className="h-10 rounded-xl bg-white border-slate-200" />
                        </FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="baptismBook" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-slate-600">Libro</FormLabel>
                        <FormControl>
                          <Input placeholder="N° Libro" {...field} className="h-10 rounded-xl bg-white border-slate-200" />
                        </FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="baptismFolio" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-slate-600">Folio</FormLabel>
                        <FormControl>
                          <Input placeholder="N° Folio" {...field} className="h-10 rounded-xl bg-white border-slate-200" />
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="bg-slate-50 p-10 flex flex-col md:flex-row items-center justify-between gap-6 border-t">
              <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm w-full md:w-auto">
                <div className="h-12 w-12 bg-accent/10 rounded-xl flex items-center justify-center"><CreditCard className="h-6 w-6 text-accent" /></div>
                <div><p className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Total Arancel</p><p className="text-xl font-headline font-bold text-primary">{totalCost.toLocaleString('es-PY')} Gs.</p></div>
              </div>
              <Button type="submit" disabled={loading || (!isPublic && isOverpaid)} className="h-12 bg-primary hover:bg-primary/90 text-white rounded-xl px-12 font-bold shadow-lg w-full md:w-auto">
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <span className="flex items-center gap-2">{isPublic ? "Enviar Inscripción" : "Registrar y Cobrar"} <ArrowRight className="h-5 w-5" /></span>}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {!isPublic && (
        <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="sr-only">
              <DialogTitle>Recibo de Pago Inicial</DialogTitle>
              <DialogDescription>Comprobante de pago generado inmediatamente después de la inscripción.</DialogDescription>
            </DialogHeader>
            <div className="p-10 bg-white space-y-8 print:p-8" id="receipt-print">
              <div className="flex items-center justify-between border-b pb-6">
                <div className="flex items-center gap-2">
                  <Church className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-headline font-bold text-lg leading-none">PARROQUIA</h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Perpetuo Socorro</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase text-primary">Recibo de Pago</p>
                  <p className="text-[9px] text-muted-foreground mt-1">FECHA: {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Concepto de Pago</p>
                    <p className="text-sm font-bold text-slate-900">Inscripción {submittedData?.catechesisYear?.replace("_", " ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Monto Cobrado</p>
                    <p className="text-lg font-bold text-green-600">{submittedData?.initialPayment?.toLocaleString()} Gs.</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">A nombre de</p>
                  <p className="text-base font-bold text-slate-900">{submittedData?.fullName}</p>
                  <p className="text-xs text-slate-500">Documento: {submittedData?.ciNumber}</p>
                </div>
                
                <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-300 space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Monto del Arancel</span>
                    <span className="font-bold">{ submittedData?.registrationCost?.toLocaleString() } Gs.</span>
                  </div>
                  <div className="flex justify-between text-xs text-green-600">
                    <span className="font-medium">Abonado ahora</span>
                    <span className="font-bold">
                      { submittedData?.initialPayment?.toLocaleString() } Gs.
                    </span>
                  </div>
                  <Separator className="bg-slate-200" />
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-slate-900 uppercase tracking-tighter">Saldo Pendiente</span>
                    <span className="text-red-500">{ (submittedData?.registrationCost - submittedData?.initialPayment).toLocaleString() } Gs.</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-3 pt-8 border-t border-dashed border-slate-200">
                <div className="h-px w-40 bg-slate-300"></div>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Sello y Firma - Catequesis</p>
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3 print:hidden">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={handleCloseReceipt}>Cerrar</Button>
              <Button className="flex-1 gap-2 rounded-xl shadow-lg" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Imprimir Recibo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
