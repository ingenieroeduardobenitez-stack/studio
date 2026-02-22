
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Church, LogIn, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth, useUser } from "@/firebase"
import { signInWithEmailAndPassword } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Image from "next/image"
import { PlaceHolderImages } from "@/lib/placeholder-images"
import Link from "next/link"

export default function RootPage() {
  const router = useRouter()
  const auth = useAuth()
  const { user, loading: userLoading } = useUser()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  })

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && user && !userLoading) {
      router.push("/dashboard")
    }
  }, [user, userLoading, mounted, router])

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
        description: "Firebase no está inicializado. Contacte al administrador.",
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
      console.error("Error de Auth:", error.code)
      
      let message = "Correo o contraseña incorrectos."
      if (error.code === 'auth/too-many-requests') {
        message = "Demasiados intentos fallidos. Inténtalo más tarde."
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

  if (!mounted || userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-slate-50 font-body relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
        <Church className="h-[500px] w-[500px] text-primary" />
      </div>

      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-700 relative z-10">
        
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative h-24 w-24 bg-white p-2 rounded-3xl shadow-xl flex items-center justify-center border-2 border-primary/10 overflow-hidden">
            {logoData ? (
              <Image 
                src={logoData.imageUrl} 
                alt="Logo Parroquia" 
                fill
                className="object-contain p-2"
                priority
              />
            ) : (
              <Church className="h-12 w-12 text-primary" />
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Portal de Gestión</h1>
            <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Parroquia Perpetuo Socorro</p>
          </div>
        </div>

        {!isFirebaseReady && (
          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Configuración Requerida</AlertTitle>
            <AlertDescription>
              Firebase no está conectado correctamente. Contacte al administrador.
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden">
          <form onSubmit={handleSubmit}>
            <CardHeader className="space-y-1 pt-10 px-10">
              <CardTitle className="text-xl font-headline font-bold text-slate-800">Iniciar Sesión</CardTitle>
              <CardDescription className="text-slate-500 font-medium">Acceso para Catequistas y Coordinadores</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-10 pb-10">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-bold text-xs uppercase tracking-wider">Correo Electrónico</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="usuario@parroquia.org" 
                  required 
                  className="bg-slate-50 border-slate-200 h-12 rounded-xl focus:ring-primary" 
                  value={formData.email}
                  onChange={handleChange}
                  disabled={!isFirebaseReady || loading}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" title="Contraseña" className="text-slate-700 font-bold text-xs uppercase tracking-wider">Contraseña</Label>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  placeholder="••••••••"
                  className="bg-slate-50 border-slate-200 h-12 rounded-xl focus:ring-primary" 
                  value={formData.password}
                  onChange={handleChange}
                  disabled={!isFirebaseReady || loading}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-white h-12 font-bold text-base rounded-xl transition-all shadow-lg mt-4 active:scale-95" 
                disabled={loading || !isFirebaseReady}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Ingresar al Sistema <LogIn className="h-5 w-5" />
                  </span>
                )}
              </Button>
            </CardContent>
            <CardFooter className="bg-slate-50/80 p-6 flex flex-col gap-4 border-t">
              <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                Uso exclusivo para personal autorizado de la Parroquia Perpetuo Socorro.
              </p>
            </CardFooter>
          </form>
        </Card>

        <div className="text-center pt-4">
          <Link 
            href="/inscripcion" 
            className="text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest"
          >
            ¿Eres postulante? Ve al Formulario de Inscripción
          </Link>
        </div>

        <p className="text-center text-[10px] text-slate-300 font-bold uppercase tracking-[0.4em]">
          Ciclo de Catequesis {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
