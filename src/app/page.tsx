
"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Church, LogIn, Loader2, AlertCircle } from "lucide-react"
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

  // Verificamos si auth está disponible (si la config de Firebase es válida)
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
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="bg-primary p-3 rounded-2xl shadow-xl">
            <Church className="h-10 w-10 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-headline font-bold tracking-tight text-primary">Confir NSPS</h1>
            <p className="text-muted-foreground font-medium">Parroquia Perpetuo Socorro</p>
          </div>
        </div>

        {!isFirebaseReady && (
          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Configuración Requerida</AlertTitle>
            <AlertDescription>
              Firebase no está conectado. Copia el objeto `firebaseConfig` de tu consola de Firebase y pégalo en la pestaña "Firebase" del panel lateral.
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
  )
}
