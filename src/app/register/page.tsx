
"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Shield, UserPlus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth, useFirestore } from "@/firebase/provider"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. Crear el usuario en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      )
      const user = userCredential.user

      // 2. Guardar el perfil en Firestore
      await setDoc(doc(db, "users", user.uid), {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        role: "Personal de Seguridad",
        createdAt: serverTimestamp()
      })

      toast({
        title: "Cuenta creada con éxito",
        description: "Bienvenido a Confir NSPS. Redirigiendo...",
      })

      router.push("/dashboard/registration")
    } catch (error: any) {
      console.error("Error al registrar:", error)
      toast({
        variant: "destructive",
        title: "Error al crear la cuenta",
        description: error.message || "Por favor verifica tus datos e inténtalo de nuevo.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="bg-primary p-3 rounded-2xl shadow-lg">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-headline font-bold tracking-tight text-primary">Únete a Confir NSPS</h1>
          <p className="text-muted-foreground font-body">Crea tu cuenta segura para comenzar</p>
        </div>

        <Card className="border-border/50 shadow-xl bg-white/80 backdrop-blur-sm">
          <form onSubmit={handleSubmit}>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl font-headline">Registrarse</CardTitle>
              <CardDescription className="font-body">Ingresa tus datos para crear una cuenta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="font-body">Nombre</Label>
                  <Input 
                    id="firstName" 
                    placeholder="Juan" 
                    required 
                    className="bg-background/50" 
                    value={formData.firstName}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="font-body">Apellido</Label>
                  <Input 
                    id="lastName" 
                    placeholder="Pérez" 
                    required 
                    className="bg-background/50" 
                    value={formData.lastName}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-body">Correo electrónico</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="juan.perez@ejemplo.gov" 
                  required 
                  className="bg-background/50" 
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="font-body">Contraseña</Label>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  className="bg-background/50" 
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-medium" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <>Crear Cuenta <UserPlus className="ml-2 h-4 w-4" /></>
                )}
              </Button>
              <div className="text-sm text-center font-body">
                ¿Ya tienes una cuenta?{" "}
                <Link href="/" className="text-accent font-semibold hover:underline">
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
