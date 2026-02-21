"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { 
  Loader2, 
  User,
  Phone,
  BookOpen,
  Calendar,
  CreditCard,
  Church,
  ArrowRight,
  ShieldCheck,
  Users,
  Camera,
  RefreshCcw,
  X,
  Check,
  AlertTriangle,
  Heart,
  Book
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
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const formSchema = z.object({
  fullName: z.string().min(5, "Nombre completo requerido"),
  ciNumber: z.string().min(5, "N° C.I. requerido"),
  phone: z.string().min(8, "N° de celular requerido"),
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
})

type FormValues = z.infer<typeof formSchema>

export function ConfirmationForm() {
  const [loading, setLoading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  const router = useRouter()

  const treasuryRef = useMemo(() => db ? doc(db, "settings", "treasury") : null, [db])
  const { data: costs } = useDoc(treasuryRef)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      ciNumber: "",
      phone: "",
      photoUrl: "",
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
      initialPayment: 0,
    },
  })

  const catechesisYear = form.watch("catechesisYear")
  const initialPayment = form.watch("initialPayment")
  const hasBaptism = form.watch("hasBaptism")

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
    if (isOverpaid) {
      toast({
        variant: "destructive",
        title: "Monto inválido",
        description: `El pago inicial no puede ser mayor al costo total (${totalCost.toLocaleString()} Gs).`
      })
      return
    }

    setLoading(true)
    try {
      const regId = `conf_${Date.now()}`
      const regRef = doc(db!, "confirmations", regId)
      
      const amountPaid = values.initialPayment
      const paymentStatus = amountPaid >= totalCost ? "PAGADO" : amountPaid > 0 ? "PARCIAL" : "PENDIENTE"

      const registrationData = {
        userId: user?.uid || "admin",
        ...values,
        status: "INSCRITO",
        attendanceStatus: "PENDIENTE",
        needsRecovery: false,
        registrationCost: totalCost,
        amountPaid: amountPaid,
        paymentStatus: paymentStatus,
        createdAt: serverTimestamp()
      }

      await setDoc(regRef, registrationData)
      
      toast({
        title: "Inscripción Realizada",
        description: `Se ha registrado a ${values.fullName} correctamente.`,
      })
      router.push("/dashboard")
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo completar la inscripción." })
    } finally {
      setLoading(false)
    }
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
                  <CardTitle className="text-2xl font-headline font-bold">Registro Parroquial</CardTitle>
                  <CardDescription className="text-white/80 font-medium">
                    Parroquia Perpetuo Socorro • Sistema de Inscripción
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
              </div>

              {/* SECCIÓN 1: DATOS PERSONALES */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4"><User className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg text-slate-800">Datos del Confirmando</h3></div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <FormField control={form.control} name="fullName" render={({ field }) => (
                    <FormItem className="lg:col-span-1"><FormLabel className="font-semibold">Nombre y Apellido</FormLabel><FormControl><Input placeholder="Ej. Juan Pérez" {...field} className="h-12 rounded-xl bg-slate-50 border-slate-200" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="ciNumber" render={({ field }) => (
                    <FormItem><FormLabel className="font-semibold">N° C.I.</FormLabel><FormControl><Input placeholder="Ej. 1.234.567" {...field} className="h-12 rounded-xl bg-slate-50 border-slate-200" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel className="font-semibold">Celular</FormLabel><FormControl><Input placeholder="Ej. 0981..." {...field} className="h-12 rounded-xl bg-slate-50 border-slate-200" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              <Separator />

              {/* SECCIÓN 2: DATOS DE PADRES / TUTOR */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4"><Users className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg text-slate-800">Padres / Encargado</h3></div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/30 space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Información de la Madre</p>
                    <FormField control={form.control} name="motherName" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs font-semibold">Nombre de la Madre</FormLabel><FormControl><Input placeholder="Nombre Completo" {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="motherPhone" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs font-semibold">Teléfono Madre</FormLabel><FormControl><Input placeholder="Celular" {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>
                    )} />
                  </div>
                  <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/30 space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Información del Padre</p>
                    <FormField control={form.control} name="fatherName" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs font-semibold">Nombre del Padre</FormLabel><FormControl><Input placeholder="Nombre Completo" {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="fatherPhone" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs font-semibold">Teléfono Padre</FormLabel><FormControl><Input placeholder="Celular" {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>
                    )} />
                  </div>
                  <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/30 space-y-4 md:col-span-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tutor / Encargado Especial</p>
                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="tutorName" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs font-semibold">Nombre del Tutor</FormLabel><FormControl><Input placeholder="En caso de que no sean los padres" {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="tutorPhone" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs font-semibold">Teléfono Tutor</FormLabel><FormControl><Input placeholder="Celular Encargado" {...field} className="h-10 rounded-lg bg-white" /></FormControl></FormItem>
                      )} />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* SECCIÓN 3: CATEGORÍA Y PAGO */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4"><BookOpen className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg text-slate-800">Categoría y Pago</h3></div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <FormField control={form.control} name="catechesisYear" render={({ field }) => (
                    <FormItem><FormLabel className="font-semibold">Categoría *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200"><SelectValue placeholder="Seleccione" /></SelectTrigger></FormControl><SelectContent><SelectItem value="PRIMER_AÑO">Primer Año</SelectItem><SelectItem value="SEGUNDO_AÑO">Segundo Año</SelectItem><SelectItem value="ADULTOS">Adultos</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="attendanceDay" render={({ field }) => (
                    <FormItem><FormLabel className="font-semibold">Día *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200"><SelectValue placeholder="Día" /></SelectTrigger></FormControl><SelectContent><SelectItem value="SABADO">Sábado</SelectItem><SelectItem value="DOMINGO">Domingo</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="initialPayment" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Monto a abonar (Gs)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          max={totalCost}
                          className={`h-12 rounded-xl font-bold border-2 transition-colors ${isOverpaid ? 'bg-red-50 border-red-300 text-red-900' : 'bg-green-50 border-green-200 text-slate-900'}`} 
                        />
                      </FormControl>
                      <FormDescription className={isOverpaid ? "text-red-500 font-bold flex items-center gap-1" : ""}>
                        {isOverpaid ? <><AlertTriangle className="h-3 w-3" /> El monto excede el total de {totalCost.toLocaleString()} Gs.</> : "Puedes pagar una parte o el total."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <Separator />

              {/* SECCIÓN 4: SACRAMENTOS PREVIOS */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4"><ShieldCheck className="h-5 w-5 text-primary" /><h3 className="font-headline font-bold text-lg text-slate-800">Sacramentos Previos</h3></div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="hasBaptism" render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 p-5 border rounded-2xl bg-slate-50/50">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-base font-bold">Bautismo</FormLabel>
                      </div>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="hasFirstCommunion" render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 p-5 border rounded-2xl bg-slate-50/50">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-base font-bold">Primera Comunión</FormLabel>
                      </div>
                    </FormItem>
                  )} />
                </div>

                {/* CAMPOS CONDICIONALES DE BAUTISMO */}
                {hasBaptism && (
                  <div className="grid gap-6 md:grid-cols-3 p-6 bg-primary/5 rounded-3xl border border-primary/10 animate-in zoom-in-95 duration-300">
                    <div className="md:col-span-3 flex items-center gap-2 mb-2">
                      <Church className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Detalles del Bautismo</h4>
                    </div>
                    <FormField control={form.control} name="baptismParish" render={({ field }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel className="text-xs font-bold text-slate-600">Parroquia / Iglesia</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre de la Parroquia" {...field} className="h-10 rounded-xl bg-white border-slate-200" />
                        </FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="baptismBook" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-slate-600">Libro N°</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. 12" {...field} className="h-10 rounded-xl bg-white border-slate-200" />
                        </FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="baptismFolio" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-slate-600">Folio N°</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. 45" {...field} className="h-10 rounded-xl bg-white border-slate-200" />
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
                <div><p className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Costo Total</p><p className="text-xl font-headline font-bold text-primary">{totalCost.toLocaleString('es-PY')} Gs.</p></div>
              </div>
              <Button type="submit" disabled={loading || isOverpaid} className="h-12 bg-primary hover:bg-primary/90 text-white rounded-xl px-12 font-bold shadow-lg w-full md:w-auto">
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <span className="flex items-center gap-2">Finalizar Inscripción <ArrowRight className="h-5 w-5" /></span>}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}
