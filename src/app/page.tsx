
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Church, LogIn, Loader2, AlertCircle, ClipboardCheck, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/firebase/provider"
import { signInWithEmailAndPassword } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Image from "next/image"
import { PlaceHolderImages } from "@/lib/placeholder-images"

export default function RootLoginPage() {
  const router = useRouter()
  const auth = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  })

  const logoData = PlaceHolderImages.find(img => img.id === "parish-logo")
  const isFirebaseReady = !!auth && !!auth.app;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isFirebaseReady) {
      toast({
        variant: "destructive",
        title: "Configuración incompleta",
        description: "Firebase no está inicializado. Pega tus claves en el panel de la derecha.",
      })
      return;
    }
    
    setLoading(true)
    
    try {
      await signInWithEmailAndPassword(auth, formData.email, formData.password)
      toast({
        title: "¡Bienvenido de nuevo!",
        description: "Acceso concedido al sistema parroquial.",
      })
      router.push("/dashboard")
    } catch (error: any) {
      console.error("Error detallado de Firebase Auth:", error.code, error.message)
      
      let message = "Correo o contraseña incorrectos."
      
      switch (error.code) {
        case 'auth/invalid-credential':
          message = "Las credenciales no coinciden. ¿Ya creaste tu cuenta?"
          break
        case 'auth/user-not-found':
          message = "No existe ningún catequista con este correo. Ve a 'Crear cuenta'."
          break
        case 'auth/wrong-password':
          message = "La contraseña es incorrecta."
          break
        case 'auth/invalid-email':
          message = "El formato del correo electrónico no es válido."
          break
        case 'auth/operation-not-allowed':
          message = "El acceso por correo/contraseña no está habilitado en tu consola de Firebase."
          break
        case 'auth/too-many-requests':
          message = "Demasiados intentos fallidos. Inténtalo más tarde."
          break
      }
      
      toast({
        variant: "destructive",
        title: "Error de acceso",
        description: message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-slate-50 font-body">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
        
        {/* Lado Izquierdo: Bienvenida y Enlace Público */}
        <div className="space-y-8 text-center md:text-left animate-in slide-in-from-left-4 duration-700">
          <div className="flex flex-col items-center md:items-start space-y-4">
            <div className="relative h-24 w-24 bg-white p-2 rounded-3xl shadow-xl flex items-center justify-center overflow-hidden border">
              {logoData ? (
                <Image 
                  src={logoData.imageUrl} 
                  alt={logoData.description} 
                  fill
                  className="object-contain p-2"
                  data-ai-hint={logoData.imageHint}
                />
              ) : (
                <Church className="h-12 w-12 text-primary" />
              )}
            </div>
            <div className="space-y-1">
              <h1 className="text-4xl md:text-5xl font-headline font-bold tracking-tight text-primary leading-tight">Gestión de Confirmación</h1>
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">Parroquia Perpetuo Socorro</p>
            </div>
          </div>

          <Card className="border-none shadow-xl bg-white rounded-3xl p-6 space-y-4 border-l-4 border-l-accent">
            <div className="flex items-center gap-3">
              <div className="bg-accent/10 p-2 rounded-xl">
                <ClipboardCheck className="h-6 w-6 text-accent" />
              </div>
              <div>
                <CardTitle className="text-lg font-headline">¿Eres postulante?</CardTitle>
                <CardDescription>Inicia tu proceso de formación hoy mismo.</CardDescription>
              </div>
            </div>
            <p className="text-sm text-slate-500">Completa el formulario de inscripción digital para el ciclo de catequesis 2026.</p>
            <Button asChild className="w-full h-12 bg-accent hover:bg-accent/90 rounded-xl font-bold gap-2">
              <Link href="/inscripcion">
                Inscribirse ahora <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </Card>
        </div>

        {/* Lado Derecho: Login Catequistas */}
        <div className="animate-in slide-in-from-right-4 duration-700">
          {!isFirebaseReady && (
            <Alert variant="destructive" className="bg-red-50 border-red-200 mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Configuración Requerida</AlertTitle>
              <AlertDescription>
                Firebase no está conectado. Copia el objeto `firebaseConfig` de tu consola de Firebase.
              </AlertDescription>
            </Alert>
          )}

          <Card className="border-none shadow-2xl bg-white rounded-3xl overflow-hidden">
            <form onSubmit={handleSubmit}>
              <CardHeader className="space-y-1 pt-10 px-10">
                <CardTitle className="text-2xl font-headline font-bold text-slate-900 text-center">Acceso Catequistas</CardTitle>
                <CardDescription className="text-slate-500 font-medium text-center">
                  Inicie sesión para gestionar las inscripciones
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 px-10 py-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-semibold">Correo electrónico</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="usuario@parroquia.org" 
                    required 
                    className="bg-slate-50 border-slate-200 h-12 rounded-xl" 
                    value={formData.email}
                    onChange={handleChange}
                    disabled={!isFirebaseReady}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-slate-700 font-semibold">Contraseña</Label>
                  </div>
                  <Input 
                    id="password" 
                    type="password" 
                    required 
                    className="bg-slate-50 border-slate-200 h-12 rounded-xl" 
                    value={formData.password}
                    onChange={handleChange}
                    disabled={!isFirebaseReady}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-6 pb-10 px-10">
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/90 text-white h-12 font-bold text-base rounded-xl transition-all shadow-lg" 
                  disabled={loading || !isFirebaseReady}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Entrar <LogIn className="h-5 w-5" />
                    </span>
                  )}
                </Button>
                <div className="text-sm text-center text-slate-600">
                  ¿Nuevo catequista?{" "}
                  <Link href="/register" className="text-accent font-bold hover:underline">
                    Crear cuenta
                  </Link>
                </div>
              </CardFooter>
            </form>
          </Card>
        </div>

      </div>
      
      <div className="mt-12 text-center">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">
          Parroquia Perpetuo Socorro • {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
