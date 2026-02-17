
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
        title: "Conexión no lista",
        description: "Firebase no está configurado. Por favor, añade tu configuración en el panel de Firebase Studio.",
      })
      return
    }

    setLoading(true)
    
    try {
      await signInWithEmailAndPassword(auth, formData.email, formData.password)
      toast({
        title: "Bienvenido",
        description: "Acceso concedido. Redirigiendo...",
      })
      router.push("/dashboard")
    } catch (error: any) {
      console.error("Error de login:", error)
      let errorMessage = "Credenciales incorrectas."
      
      if (error.code === 'auth/invalid-api-key') {
        errorMessage = "La API Key de Firebase no es válida. Revisa la configuración del proyecto."
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = "Usuario no encontrado. ¿Ya te has registrado?"
      }

      toast({
        variant: "destructive",
        title: "Error de acceso",
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
            <p className="text-muted-foreground font-medium">Sistema Seguro de Registro Nacional</p>
          </div>
        </div>

        {!auth && (
          <Alert variant="destructive" className="bg-white border-destructive/50 shadow-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-bold">Acción Requerida</AlertTitle>
            <AlertDescription>
              Falta la configuración de Firebase. Ve a la configuración de Firebase Studio y pega tu <strong>firebaseConfig</strong> de la consola de Google.
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-none shadow-2xl bg-white rounded-3xl overflow-hidden">
          <form onSubmit={handleSubmit}>
            <CardHeader className="space-y-1 pt-10 px-10">
              <CardTitle className="text-2xl font-headline font-bold text-slate-900 text-center">Iniciar Sesión</CardTitle>
              <CardDescription className="text-slate-500 font-medium text-center">
                Ingresa tus credenciales oficiales
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-10 py-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-semibold">Correo Institucional</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="nombre.apellido@ejemplo.gov" 
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
                className="w-full bg-primary hover:bg-primary/90 text-white h-12 font-bold text-base rounded-xl transition-all shadow-lg shadow-blue-900/20" 
                disabled={loading || !auth}
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
                ¿No tiene una cuenta registrada?{" "}
                <Link href="/register" className="text-accent font-bold hover:underline">
                  Regístrese aquí
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
