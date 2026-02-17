
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { 
  Loader2, 
  CheckCircle2, 
  User,
  Heart,
  ChevronRight,
  ChevronLeft,
  Calendar
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
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useFirestore, useUser } from "@/firebase"
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

const formSchema = z.object({
  fullName: z.string().min(5, "El nombre completo debe tener al menos 5 caracteres"),
  age: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().min(10, "La edad mínima es de 10 años")),
  category: z.enum(["JUVENIL", "ADULTO"]),
  baptized: z.boolean().default(false),
  firstCommunion: z.boolean().default(false),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

export function ConfirmationForm() {
  const [loading, setLoading] = useState(false)
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  const router = useRouter()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      category: "JUVENIL",
      baptized: false,
      firstCommunion: false,
      notes: "",
    },
  })

  const onSubmit = async (values: FormValues) => {
    setLoading(true)
    try {
      const regId = `conf_${Date.now()}`
      const regRef = doc(db, "confirmations", regId)
      
      const registrationData = {
        userId: user?.uid || "admin",
        ...values,
        status: "INSCRITO",
        createdAt: serverTimestamp()
      }

      await setDoc(regRef, registrationData)
      
      toast({
        title: "Inscripción Exitosa",
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
    <div className="w-full max-w-2xl mx-auto">
      <Card className="border-border/50 shadow-xl bg-white overflow-hidden rounded-3xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <CardHeader className="bg-primary/5 pb-8 border-b">
              <CardTitle className="text-2xl font-headline text-primary">Formulario de Inscripción</CardTitle>
              <CardDescription>Complete los datos del postulante a la Confirmación.</CardDescription>
            </CardHeader>
            <CardContent className="pt-8 space-y-6">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo del Postulante</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Juan Andrés Pérez García" {...field} className="rounded-xl h-12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Edad</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Ej. 15" {...field} className="rounded-xl h-12" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl h-12">
                            <SelectValue placeholder="Seleccione categoría" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="JUVENIL">Juvenil (14-17 años)</SelectItem>
                          <SelectItem value="ADULTO">Adultos (18+ años)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border">
                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-primary" /> Sacramentos Previos
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="baptized"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-xl bg-white">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Bautizado</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="firstCommunion"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-xl bg-white">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Primera Comunión</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Ej. Vive con sus abuelos, requiere apoyo especial..." 
                        className="rounded-xl resize-none min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex justify-end gap-3 border-t pt-6 pb-8 bg-slate-50/50">
              <Button type="button" variant="outline" onClick={() => router.back()} className="rounded-xl px-8">
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 rounded-xl px-10 h-12 font-bold shadow-lg">
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Inscribir Postulante"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}
