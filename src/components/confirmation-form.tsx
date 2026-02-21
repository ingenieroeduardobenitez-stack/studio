
"use client"

import { useState, useRef } from "react"
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
  Camera
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
import { useFirestore, useUser } from "@/firebase"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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
    },
  })

  const catechesisYear = form.watch("catechesisYear")
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
    return catechesisYear === "ADULTOS" ? 50000 : 35000
  }

  const onSubmit = async (values: FormValues) => {
    setLoading(true)
    try {
      const regId = `conf_${Date.now()}`
      const regRef = doc(db, "confirmations", regId)
      
      const registrationData = {
        userId: user?.uid || "admin",
        ...values,
        status: "INSCRITO",
        attendanceStatus: "PENDIENTE",
        needsRecovery: false,
        registrationCost: calculateCost(),
        createdAt: serverTimestamp()
      }

      await setDoc(regRef, registrationData)
      
      toast({
        title: "Inscripción Realizada",
        description: `Se ha registrado a ${values.fullName} correctamente.`,
      })
      router.push("/dashboard")
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo completar la inscripción.",
      })
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
                    Parroquia Perpetuo Socorro • Sistema de Inscripción a Confirmación
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
                  <Button 
                    type="button"
                    variant="secondary" 
                    size="icon" 
                    className="absolute bottom-0 right-0 rounded-full shadow-lg"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handlePhotoUpload}
                  />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Foto del Confirmando</p>
              </div>

              {/* SECCIÓN 1: DATOS DEL CONFIRMANDO */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-5 w-5 text-primary" />
                  <h3 className="font-headline font-bold text-lg text-slate-800">Datos del Confirmando</h3>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem className="lg:col-span-1">
                        <FormLabel className="text-slate-700 font-semibold">Nombre y Apellido del confirmando</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. Juan Andrés Pérez" {...field} className="h-12 rounded-xl bg-slate-50 border-slate-200" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ciNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-semibold">N° C.I.</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. 1.234.567" {...field} className="h-12 rounded-xl bg-slate-50 border-slate-200" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-semibold">N° de Celular</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. 0981 123 456" {...field} className="h-12 rounded-xl bg-slate-50 border-slate-200" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* SECCIÓN 2: DATOS FAMILIARES */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="font-headline font-bold text-lg text-slate-800">Información Familiar</h3>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-sm font-bold text-primary uppercase tracking-wider mb-2">Madre</p>
                    <FormField
                      control={form.control}
                      name="motherName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-600">Nombre y Apellido</FormLabel>
                          <FormControl>
                            <Input placeholder="Nombre de la madre" {...field} className="h-11 rounded-xl bg-white border-slate-200" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="motherPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-600">N° de Celular</FormLabel>
                          <FormControl>
                            <Input placeholder="Celular de la madre" {...field} className="h-11 rounded-xl bg-white border-slate-200" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-sm font-bold text-primary uppercase tracking-wider mb-2">Padre</p>
                    <FormField
                      control={form.control}
                      name="fatherName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-600">Nombre y Apellido</FormLabel>
                          <FormControl>
                            <Input placeholder="Nombre del padre" {...field} className="h-11 rounded-xl bg-white border-slate-200" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="fatherPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-600">N° de Celular</FormLabel>
                          <FormControl>
                            <Input placeholder="Celular del padre" {...field} className="h-11 rounded-xl bg-white border-slate-200" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* SECCIÓN 3: CATEQUESIS Y DÍA */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <h3 className="font-headline font-bold text-lg text-slate-800">Año de Catequesis y Horario</h3>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="catechesisYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-semibold">Año de Catequesis *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200">
                              <SelectValue placeholder="Seleccione Año" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PRIMER_AÑO">Primer Año</SelectItem>
                            <SelectItem value="SEGUNDO_AÑO">Segundo Año</SelectItem>
                            <SelectItem value="ADULTOS">Catequesis de adultos</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="attendanceDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-semibold">¿Qué día asistirás? *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200">
                              <SelectValue placeholder="Seleccione día" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="SABADO">Sábado (de 15:30 a 18:30 hs)</SelectItem>
                            <SelectItem value="DOMINGO">Domingo (de 08:00 a 11:00 hs)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* SECCIÓN 4: SACRAMENTOS */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <h3 className="font-headline font-bold text-lg text-slate-800">Sacramentos Previos</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2 mb-6">
                  <FormField
                    control={form.control}
                    name="hasBaptism"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-5 border rounded-2xl bg-slate-50/50">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-base font-bold text-slate-700">Bautismo</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hasFirstCommunion"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-5 border rounded-2xl bg-slate-50/50">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-base font-bold text-slate-700">Primera Comunión</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                {hasBaptism && (
                  <div className="space-y-6 p-8 bg-blue-50/30 border border-blue-100 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-500">
                    <p className="text-sm font-bold text-blue-800 flex items-center gap-2">
                      <BookOpen className="h-4 w-4" /> Datos de Registro de Bautismo
                    </p>
                    <div className="grid gap-6 md:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="baptismParish"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-600">Parroquia de Bautismo</FormLabel>
                            <FormControl>
                              <Input placeholder="Ej. Perpetuo Socorro" {...field} className="h-11 rounded-xl bg-white" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="baptismBook"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-600">Libro</FormLabel>
                            <FormControl>
                              <Input placeholder="N°" {...field} className="h-11 rounded-xl bg-white" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="baptismFolio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-600">Folio</FormLabel>
                            <FormControl>
                              <Input placeholder="N°" {...field} className="h-11 rounded-xl bg-white" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="bg-slate-50 p-10 flex flex-col md:flex-row items-center justify-between gap-6 border-t">
              <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm w-full md:w-auto">
                <div className="h-12 w-12 bg-accent/10 rounded-xl flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Costo de Inscripción</p>
                  <p className="text-xl font-headline font-bold text-primary">
                    {calculateCost().toLocaleString('es-PY')} Gs.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 w-full md:w-auto">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => router.back()} 
                  className="h-12 rounded-xl px-8 font-semibold text-slate-600 w-full md:w-auto"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="h-12 bg-primary hover:bg-primary/90 text-white rounded-xl px-12 font-bold shadow-lg shadow-primary/20 w-full md:w-auto"
                >
                  {loading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <span className="flex items-center gap-2">Finalizar Inscripción <ArrowRight className="h-5 w-5" /></span>
                  )}
                </Button>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}
