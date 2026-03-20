
"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Church, UserPlus, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth, useFirestore } from "@/firebase/provider"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function RegisterPage() {
  const router = useRouter()
  const auth = useAuth()
  const db = useFirestore()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: ""
  })

  const isFirebaseReady = !!auth && !!auth.app;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isFirebaseReady) {
      toast({
        variant: "destructive",
        title: "Error de conexión",
        description: "Firebase no está listo. Verifica tus claves.",
      })
      return;
    }

    setLoading(true)

    try {
      // 1. Crear el usuario en Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      )
      const user = userCredential.user

      // 2. Crear el documento de perfil en Firestore
      await setDoc(doc(db, "users", user.uid), {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        role: "Catequista",
        createdAt: serverTimestamp()
      })

      toast({
        title: "¡Cuenta creada!",
        description: "Bienvenido a la comunidad parroquial.",
      })

      router.push("/dashboard")
    } catch (error: any) {
      console.error("Error al registrar:", error)
      let message = "No se pudo crear la cuenta."
      
      if (error.code === 'auth/email-already-in-use') {
        message = "Este correo electrónico ya está registrado. Intenta iniciar sesión."
      } else if (error.code === 'auth/weak-password') {
        message = "La contraseña es muy débil. Debe tener al menos 6 caracteres."
      } else if (error.code === 'auth/invalid-email') {
        message = "El correo electrónico no es válido."
      }
      
      toast({
        variant: "destructive",
        title: "Error de registro",
        description: message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-slate-50">
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
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error de Firebase</AlertTitle>
            <AlertDescription>No se pudo conectar con los servicios de Firebase.</AlertDescription>
          </Alert>
        )}

        <Card className="border-none shadow-2xl bg-white rounded-3xl overflow-hidden">
          <form onSubmit={handleSubmit}>
            <CardHeader className="space-y-1 pt-10 px-10">
              <CardTitle className="text-2xl font-headline font-bold text-slate-900 text-center">Registro de Catequista</CardTitle>
              <CardDescription className="text-slate-500 font-medium text-center">Ingresa tus datos para crear una cuenta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-slate-700 font-semibold">Nombre</Label>
                  <Input 
                    id="firstName" 
                    placeholder="Juan" 
                    required 
                    className="bg-slate-50 border-slate-200 h-12 rounded-xl" 
                    value={formData.firstName}
                    onChange={handleChange}
                    disabled={!isFirebaseReady}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-slate-700 font-semibold">Apellido</Label>
                  <Input 
                    id="lastName" 
                    placeholder="Pérez" 
                    required 
                    className="bg-slate-50 border-slate-200 h-12 rounded-xl" 
                    value={formData.lastName}
                    onChange={handleChange}
                    disabled={!isFirebaseReady}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-semibold">Correo electrónico</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="juan.perez@parroquia.org" 
                  required 
                  className="bg-slate-50 border-slate-200 h-12 rounded-xl" 
                  value={formData.email}
                  onChange={handleChange}
                  disabled={!isFirebaseReady}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 font-semibold">Contraseña</Label>
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
            <CardFooter className="flex flex-col space-y-6 pb-10 px-10 pt-6">
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white h-12 font-bold text-base rounded-xl transition-all shadow-lg" disabled={loading || !isFirebaseReady}>
                {loading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Crear Cuenta <UserPlus className="h-5 w-5" />
                  </span>
                )}
              </Button>
              <div className="text-sm text-center text-slate-600">
                ¿Ya tienes una cuenta?{" "}
                <Link href="/" className="text-accent font-bold hover:underline">
                  Inicia sesión
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
