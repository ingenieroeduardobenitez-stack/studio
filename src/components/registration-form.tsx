
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  FileText,
  ShieldCheck,
  Building2,
  ChevronRight,
  ChevronLeft
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { confirmNspsStatus, ConfirmNspsStatusOutput } from "@/ai/flows/confirm-nsps-status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useFirestore, useUser } from "@/firebase"
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

const formSchema = z.object({
  applicantName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  citizenship: z.string().min(2, "Por favor proporcione su ciudadanía"),
  educationLevel: z.string().min(1, "Seleccione su nivel de educación"),
  employmentStatus: z.string().min(1, "Seleccione su estado laboral"),
  declarationText: z.string().min(50, "Por favor proporcione una declaración más detallada (mín. 50 caracteres)"),
})

type FormValues = z.infer<typeof formSchema>

export function RegistrationForm() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ConfirmNspsStatusOutput | null>(null)
  const db = useFirestore()
  const { user } = useUser()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      applicantName: "",
      citizenship: "",
      educationLevel: "",
      employmentStatus: "",
      declarationText: "",
    },
  })

  const onSubmit = async (values: FormValues) => {
    setLoading(true)
    try {
      // 1. Llamar a la IA para evaluación
      const response = await confirmNspsStatus(values)
      setResult(response)
      
      // 2. Guardar en Firestore (Real)
      const regId = `reg_${Date.now()}`
      const regRef = doc(db, "registrations", regId)
      
      const registrationData = {
        userId: user?.uid || "anonymous",
        ...values,
        status: response.isNspsConfirmed ? "CONFIRMED" : "PENDING",
        aiReason: response.confirmationReason,
        createdAt: serverTimestamp()
      }

      setDoc(regRef, registrationData)
        .catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
            path: regRef.path,
            operation: 'create',
            requestResourceData: registrationData,
          });
          errorEmitter.emit('permission-error', permissionError);
        });

      setStep(3)
    } catch (error) {
      console.error("Confirmación fallida", error)
    } finally {
      setLoading(false)
    }
  }

  const nextStep = async () => {
    const fields = step === 1 
      ? ['applicantName', 'citizenship', 'educationLevel', 'employmentStatus'] 
      : ['declarationText']
    
    const isValid = await form.trigger(fields as any)
    if (isValid) setStep(step + 1)
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8 px-4 relative">
        <div className="absolute top-5 left-0 w-full h-0.5 bg-muted -z-10" />
        {[
          { icon: Building2, label: "Identidad" },
          { icon: FileText, label: "Declaración" },
          { icon: ShieldCheck, label: "Verificación" }
        ].map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-2 flex-1">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-white",
              step > i + 1 ? "bg-accent border-accent text-white" : 
              step === i + 1 ? "bg-primary border-primary text-white shadow-lg" : 
              "border-muted text-muted-foreground"
            )}>
              <s.icon className="h-5 w-5" />
            </div>
            <span className={cn(
              "text-xs font-bold uppercase tracking-wider",
              step === i + 1 ? "text-primary" : "text-muted-foreground"
            )}>{s.label}</span>
          </div>
        ))}
      </div>

      <Card className="border-border/50 shadow-xl bg-white overflow-hidden">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <CardHeader className="bg-secondary/30 pb-8 border-b">
              <CardTitle className="text-2xl font-headline text-primary">
                {step === 1 ? "Información Básica" : step === 2 ? "Autodeclaración" : "Resultados de Verificación"}
              </CardTitle>
              <CardDescription>
                {step === 1 ? "Proporcione sus detalles profesionales y educativos actuales." : 
                 step === 2 ? "Declare su elegibilidad y relevancia para la seguridad nacional." : 
                 "Evaluación del sistema sobre su estado NSPS."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-8">
              {step === 1 && (
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="applicantName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre Legal Completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ingrese su nombre completo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="citizenship"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ciudadanía</FormLabel>
                        <FormControl>
                          <Input placeholder="ej. España" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="educationLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nivel de Educación</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione nivel" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Secundaria">Educación Secundaria</SelectItem>
                            <SelectItem value="Grado">Grado Universitario / Licenciatura</SelectItem>
                            <SelectItem value="Máster">Máster / Postgrado</SelectItem>
                            <SelectItem value="Doctorado">Doctorado / PhD</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="employmentStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado Laboral</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione estado" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Empleado Público">Empleado Público / Gobierno</SelectItem>
                            <SelectItem value="Sector Privado">Sector Privado</SelectItem>
                            <SelectItem value="Desempleado">Desempleado</SelectItem>
                            <SelectItem value="Estudiante">Estudiante</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {step === 2 && (
                <FormField
                  control={form.control}
                  name="declarationText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Declaración de Elegibilidad</FormLabel>
                      <FormDescription>
                        Explique por qué es elegible para el estado NSPS y describa sus antecedentes en relación con los requisitos de seguridad nacional.
                      </FormDescription>
                      <FormControl>
                        <Textarea 
                          placeholder="Proporcione una declaración detallada..." 
                          className="min-h-[200px] resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {step === 3 && result && (
                <div className="space-y-6">
                  {result.isNspsConfirmed ? (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <AlertTitle className="text-green-800 font-bold">Estado NSPS Confirmado</AlertTitle>
                      <AlertDescription className="text-green-700">
                        El sistema automatizado ha validado con éxito su estado preliminar NSPS.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="destructive">
                      <AlertCircle className="h-5 w-5" />
                      <AlertTitle>Acción Requerida</AlertTitle>
                      <AlertDescription>
                        Su estado NSPS no pudo ser confirmado automáticamente con la información actual.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="bg-secondary/30 rounded-lg p-6 space-y-4">
                    <div>
                      <h4 className="font-bold text-sm uppercase text-muted-foreground mb-1">Motivo de la Decisión</h4>
                      <p className="text-sm leading-relaxed">{result.confirmationReason}</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm uppercase text-muted-foreground mb-1">Próximos Pasos</h4>
                      <p className="text-sm leading-relaxed font-medium">{result.nextSteps}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-6 pb-8 bg-secondary/10">
              {step < 3 ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(step - 1)}
                    disabled={step === 1 || loading}
                    className="font-body"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" /> Atrás
                  </Button>
                  {step === 2 ? (
                    <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 min-w-[140px]">
                      {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <>Verificar Ahora <CheckCircle2 className="ml-2 h-4 w-4" /></>}
                    </Button>
                  ) : (
                    <Button type="button" onClick={nextStep} className="bg-primary hover:bg-primary/90">
                      Continuar <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </>
              ) : (
                <Button asChild className="w-full bg-primary hover:bg-primary/90">
                  <Link href="/dashboard">Volver al Panel</Link>
                </Button>
              )}
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}
