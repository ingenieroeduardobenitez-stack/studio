
"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Shield, LogIn, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/firebase/provider"
import { signInWithEmailAndPassword } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function RootLoginPage() {
  const router = useRouter()
  const auth = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!auth) {
      toast({
        variant: "destructive",
        title: "Configuración incompleta",
        description: "Por favor, pega tu firebaseConfig en los ajustes de Firebase Studio para habilitar el acceso.",
      })
      return
    }

    setLoading(true)
    
    try {
      await signInWithEmailAndPassword(auth, formData.email, formData.password)
      toast({
        title: "Acceso concedido",
        description: "Bienvenido al sistema. Redirigiendo...",
      })
      router.push("/dashboard")
    } catch (error: any) {
      console.error("Error de login:", error)
      let errorMessage = "Credenciales incorrectas o usuario no encontrado."
      
      if (error.code === 'auth/invalid-api-key' || error.code === 'auth/invalid-app-id') {
        errorMessage = "La configuración de Firebase es incorrecta. Revisa tu apiKey."
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = "Error de conexión. Verifica tu internet."
      }

      toast({
        variant: "destructive",
        title: "Fallo en el inicio de sesión",
        description: errorMessage,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-slate-50 font-body">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="bg-primary p-3 rounded-2xl shadow-xl">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-headline font-bold tracking-tight text-primary">Confir NSPS</h1>
            <p className="text-muted-foreground font-medium">Registro Nacional de Seguridad</p>
          </div>
        </div>

        {!auth && (
          <Alert variant="destructive" className="bg-white border-destructive/50 shadow-md animate-pulse">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-bold">Configuración Requerida</AlertTitle>
            <AlertDescription className="text-sm">
              Falta conectar tu proyecto. Ve a la consola de Firebase, copia tu <strong>firebaseConfig</strong> y pégalo en el panel de ajustes de Firebase aquí en el Studio.
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-none shadow-2xl bg-white rounded-3xl overflow-hidden">
          <form onSubmit={handleSubmit}>
            <CardHeader className="space-y-1 pt-10 px-10">
              <CardTitle className="text-2xl font-headline font-bold text-slate-900 text-center">Identificación</CardTitle>
              <CardDescription className="text-slate-500 font-medium text-center">
                Ingrese sus credenciales oficiales de acceso
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-10 py-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-semibold">Correo Institucional</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="ejemplo@seguridad.gov" 
                  required 
                  className="bg-slate-50 border-slate-200 h-12 focus:ring-primary rounded-xl" 
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-700 font-semibold">Contraseña</Label>
                  <Link href="#" className="text-xs text-accent font-bold hover:underline">¿Olvidó su clave?</Link>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  className="bg-slate-50 border-slate-200 h-12 focus:ring-primary rounded-xl" 
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-6 pb-10 px-10">
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-white h-12 font-bold text-base rounded-xl transition-all shadow-lg" 
                disabled={loading || !auth}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Iniciar Sesión <LogIn className="h-5 w-5" />
                  </span>
                )}
              </Button>
              <div className="text-sm text-center text-slate-600">
                ¿Aún no tiene cuenta?{" "}
                <Link href="/register" className="text-accent font-bold hover:underline">
                  Crear cuenta nueva
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
