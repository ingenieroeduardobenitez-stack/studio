
"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Shield, LogIn, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/firebase/provider"
import { signInWithEmailAndPassword } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"

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
    setLoading(true)
    
    try {
      await signInWithEmailAndPassword(auth, formData.email, formData.password)
      toast({
        title: "Inicio de sesión exitoso",
        description: "Redirigiendo a tu panel...",
      })
      router.push("/dashboard")
    } catch (error: any) {
      console.error("Error al iniciar sesión:", error)
      toast({
        variant: "destructive",
        title: "Error de acceso",
        description: "Correo o contraseña incorrectos.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-[#f3f4f6]">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="bg-[#3f51b5] p-3 rounded-xl shadow-md">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-headline font-bold tracking-tight text-[#3f51b5]">Confir NSPS</h1>
            <p className="text-muted-foreground font-medium">Inicia sesión para gestionar tu registro</p>
          </div>
        </div>

        <Card className="border-none shadow-xl bg-white rounded-2xl overflow-hidden">
          <form onSubmit={handleSubmit}>
            <CardHeader className="space-y-1 pt-8 px-8">
              <CardTitle className="text-2xl font-headline font-bold text-[#1f2937]">Iniciar Sesión</CardTitle>
              <CardDescription className="text-[#6b7280] font-medium">
                Ingresa tus credenciales para acceder a tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-8 py-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#374151] font-semibold">Correo electrónico</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="juan.perez@ejemplo.gov" 
                  required 
                  className="bg-[#f9fafb] border-gray-200 h-12 focus:ring-[#3f51b5]" 
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-[#374151] font-semibold">Contraseña</Label>
                  <Link href="#" className="text-xs text-[#10b981] font-bold hover:underline">¿Olvidaste tu contraseña?</Link>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  className="bg-[#f9fafb] border-gray-200 h-12 focus:ring-[#3f51b5]" 
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-6 pb-8 px-8">
              <Button 
                type="submit" 
                className="w-full bg-[#3f51b5] hover:bg-[#3f51b5]/90 text-white h-12 font-bold text-base rounded-xl transition-all shadow-lg shadow-blue-900/20" 
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Entrar <LogIn className="h-5 w-5" />
                  </span>
                )}
              </Button>
              <div className="text-sm text-center text-[#4b5563]">
                ¿No tienes una cuenta?{" "}
                <Link href="/register" className="text-[#10b981] font-bold hover:underline">
                  Regístrate ahora
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
