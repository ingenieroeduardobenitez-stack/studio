
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Church, LogIn, Loader2, AlertCircle, ArrowLeft } from "lucide-react"
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

export default function LoginPage() {
  const router = useRouter()
  const auth = useAuth()
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
        description: "Firebase no está inicializado.",
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

  if (!mounted) return null

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-slate-50 font-body">
      <div className="w-full max-w-md space-y-8 animate-in fade-in duration-700">
        
        <div className="flex justify-start items-center px-2">
          <Link href="/" className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" /> Volver al Inicio Público
          </Link>
        </div>

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative h-20 w-20 bg-white p-2 rounded-3xl shadow-lg flex items-center justify-center border overflow-hidden">
            {logoData ? (
              <Image 
                src={logoData.imageUrl} 
                alt="Logo" 
                fill
                className="object-contain p-2"
                priority
              />
            ) : (
              <Church className="h-10 w-10 text-primary" />
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-headline font-bold text-primary tracking-tight">Portal Administrativo</h1>
            <p className="text-slate-500 text-sm font-medium">Acceso exclusivo para Catequistas y Coordinadores</p>
          </div>
        </div>

        {!isFirebaseReady && (
          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Configuración Requerida</AlertTitle>
            <AlertDescription>
              Firebase no está conectado correctamente.
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-none shadow-2xl bg-white rounded-3xl overflow-hidden">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6 p-10">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-bold text-xs uppercase tracking-wider">Correo Institucional</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="usuario@parroquia.org" 
                  required 
                  className="bg-slate-50 border-slate-200 h-12 rounded-xl" 
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
                  className="bg-slate-50 border-slate-200 h-12 rounded-xl" 
                  value={formData.password}
                  onChange={handleChange}
                  disabled={!isFirebaseReady || loading}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-white h-12 font-bold text-base rounded-xl transition-all shadow-lg mt-4" 
                disabled={loading || !isFirebaseReady}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Iniciar Sesión <LogIn className="h-5 w-5" />
                  </span>
                )}
              </Button>
            </CardContent>
            <CardFooter className="bg-slate-50 p-6 flex flex-col gap-4 border-t">
              <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                Si olvidaste tu contraseña o no tienes acceso, contacta con el administrador del sistema.
              </p>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em]">
          Parroquia Perpetuo Socorro
        </p>
      </div>
    </div>
  )
}
