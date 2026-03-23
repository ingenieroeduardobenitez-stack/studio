"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Church, LogIn, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth, useUser } from "@/firebase"
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import Image from "next/image"
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
  const [resetEmail, setResetEmail] = useState("")
  const [isResetLoading, setIsResetLoading] = useState(false)
  const [isResetOpen, setIsResetOpen] = useState(false)

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && user && !userLoading) {
      router.push("/dashboard")
    }
  }, [user, userLoading, mounted, router])

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
        description: "Acceso concedido al sistema institucional.",
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail) {
      toast({
        variant: "destructive",
        title: "Correo requerido",
        description: "Por favor, ingresa tu correo institucional.",
      })
      return
    }

    setIsResetLoading(true)
    try {
      await sendPasswordResetEmail(auth, resetEmail)
      toast({
        title: "Correo enviado",
        description: "Se ha enviado un enlace para restablecer tu contraseña.",
      })
      setIsResetOpen(false)
    } catch (error: any) {
      console.error("Error Reset Auth:", error.code)
      toast({
        variant: "destructive",
        title: "Error al enviar correo",
        description: "No se pudo procesar la solicitud. Verifica el correo.",
      })
    } finally {
      setIsResetLoading(false)
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
    <div className="flex min-h-screen flex-col items-center justify-center p-2 bg-slate-50 font-body relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
        <Church className="h-[400px] w-[400px] text-primary" />
      </div>

      <div className="w-full max-w-md space-y-4 animate-in fade-in zoom-in-95 duration-700 relative z-10 py-4">
        
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="relative h-20 w-20 bg-white p-1.5 rounded-3xl shadow-xl flex items-center justify-center border-2 border-primary/10 overflow-hidden">
            <Image 
              src="/logo.png" 
              alt="Logo Santuario" 
              fill
              className="object-contain p-2"
              priority
            />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-xl font-headline font-bold text-primary tracking-tight uppercase leading-tight">Portal de Gestión</h1>
            <p className="text-slate-500 text-[8px] font-bold uppercase tracking-[0.2em] leading-tight px-4">Santuario Nacional Nuestra Señora del Perpetuo Socorro</p>
          </div>
        </div>

        {!isFirebaseReady && (
          <Alert variant="destructive" className="bg-red-50 border-red-200 py-2">
            <AlertCircle className="h-3 w-3" />
            <AlertTitle className="text-xs">Configuración Requerida</AlertTitle>
            <AlertDescription className="text-[10px]">
              Firebase no está conectado correctamente. Contacte al administrador.
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden">
          <form onSubmit={handleSubmit}>
            <CardHeader className="space-y-0.5 pt-6 px-8">
              <CardTitle className="text-lg font-headline font-bold text-slate-800">Iniciar Sesión</CardTitle>
              <CardDescription className="text-slate-500 font-medium text-xs">Acceso para Catequistas y Coordinadores</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-8 pb-6">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-slate-700 font-bold text-[10px] uppercase tracking-wider">Correo Electrónico</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="usuario@santuario.org" 
                  required 
                  className="bg-slate-50 border-slate-200 h-11 rounded-xl focus:ring-primary text-sm" 
                  value={formData.email}
                  onChange={handleChange}
                  disabled={!isFirebaseReady || loading}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" title="Contraseña" className="text-slate-700 font-bold text-[10px] uppercase tracking-wider">Contraseña</Label>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  placeholder="••••••••"
                  className="bg-slate-50 border-slate-200 h-11 rounded-xl focus:ring-primary text-sm" 
                  value={formData.password}
                  onChange={handleChange}
                  disabled={!isFirebaseReady || loading}
                />
                <div className="flex justify-end mt-1">
                  <Button 
                    type="button"
                    variant="link" 
                    onClick={() => setIsResetOpen(true)}
                    className="px-0 h-auto text-[10px] font-bold text-slate-400 hover:text-primary uppercase tracking-tight"
                  >
                    ¿Olvidaste tu contraseña?
                  </Button>
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-white h-11 font-bold text-sm rounded-xl transition-all shadow-lg mt-2 active:scale-95" 
                disabled={loading || !isFirebaseReady}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Ingresar al Sistema <LogIn className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </CardContent>
            <CardFooter className="bg-slate-50/80 p-4 flex flex-col gap-4 border-t">
              <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                Uso exclusivo para personal autorizado del Santuario Nacional.
              </p>
            </CardFooter>
          </form>
        </Card>

        <div className="text-center pt-2">
          <Link 
            href="/inscripcion" 
            className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-[0.15em] border-b border-primary/20 pb-0.5"
          >
            ¿Eres postulante? Inscripción 2026
          </Link>
        </div>

        <p className="text-center text-[8px] text-slate-300 font-bold uppercase tracking-widest pt-2">
          © 2026 Ing. Eduardo Benítez | Desarrollo de Software - Todos los derechos reservados.
        </p>
      </div>

      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-xl font-headline font-bold text-primary">Recuperar Acceso</DialogTitle>
            <DialogDescription className="text-slate-500 text-sm">
              Ingresa tu correo institucional para recibir un enlace de restablecimiento.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="resetEmail" className="text-xs font-bold text-slate-700 uppercase">Correo Institucional</Label>
              <Input 
                id="resetEmail" 
                type="email" 
                placeholder="usuario@santuario.org" 
                required 
                className="h-12 rounded-xl bg-slate-50"
                value={resetEmail}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResetEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl font-bold" disabled={isResetLoading}>
              {isResetLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enviar Enlace"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
