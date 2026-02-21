
"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Camera, Shield, Mail, User, MapPin, Loader2, Save } from "lucide-react"
import { useUser, useDoc, useFirestore } from "@/firebase"
import { doc, updateDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

export default function ProfilePage() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const userProfileRef = useMemo(() => {
    if (!db || !user?.uid) return null
    return doc(db, "users", user.uid)
  }, [db, user?.uid])

  const { data: profile, loading } = useDoc(userProfileRef)
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    role: "",
    photoUrl: ""
  })

  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        role: profile.role || "Catequista",
        photoUrl: profile.photoUrl || ""
      })
    }
  }, [profile])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photoUrl: reader.result as string }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    if (!userProfileRef) return
    setIsSaving(true)

    updateDoc(userProfileRef, formData)
      .then(() => {
        toast({
          title: "Perfil actualizado",
          description: "Tus cambios se han guardado correctamente.",
        })
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: userProfileRef.path,
          operation: 'update',
          requestResourceData: formData,
        });
        errorEmitter.emit('permission-error', permissionError);
        
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudieron guardar los cambios.",
        })
      })
      .finally(() => {
        setIsSaving(false)
      })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold text-primary">Gestión de Perfil</h1>
        <p className="text-muted-foreground">Administra tu información personal y configuración de cuenta.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-8">
          <Card className="border-border/50 shadow-sm text-center">
            <CardHeader className="relative">
              <div className="absolute top-4 right-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                </Button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                />
              </div>
              <div className="mx-auto h-24 w-24 rounded-full border-4 border-accent p-1">
                <Avatar className="h-full w-full">
                  <AvatarImage src={formData.photoUrl || undefined} />
                  <AvatarFallback className="bg-slate-50 text-slate-300">
                    <User className="h-10 w-10" />
                  </AvatarFallback>
                </Avatar>
              </div>
              <CardTitle className="mt-4 font-headline">{formData.firstName} {formData.lastName}</CardTitle>
              <CardDescription>{formData.role}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center gap-2">
                <div className="px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold border border-accent/20">
                  COMUNIDAD
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 border-t pt-6">
              <div className="w-full flex items-center gap-3 text-sm text-muted-foreground text-left px-4">
                <Mail className="h-4 w-4" /> <span>{profile?.email}</span>
              </div>
              <div className="w-full flex items-center gap-3 text-sm text-muted-foreground text-left px-4">
                <MapPin className="h-4 w-4" /> <span>Parroquia Perpetuo Socorro</span>
              </div>
            </CardFooter>
          </Card>

          <Card className="border-border/50 shadow-sm bg-primary text-white">
            <CardHeader>
              <CardTitle className="text-lg font-headline">Estado del Usuario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-white/50" />
                <div>
                  <p className="text-sm font-bold">Nivel de Acceso: {formData.role}</p>
                  <p className="text-xs text-white/80">Acceso autorizado al sistema parroquial</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="font-headline">Detalles Personales</CardTitle>
              <CardDescription>Actualiza tu información de catequista</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nombre</Label>
                  <Input 
                    id="firstName" 
                    value={formData.firstName} 
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Apellido</Label>
                  <Input 
                    id="lastName" 
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rol / Cargo Parroquial</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(value) => setFormData({...formData, role: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Catequista">Catequista</SelectItem>
                    <SelectItem value="Coordinador">Coordinador</SelectItem>
                    <SelectItem value="Administrador">Administrador</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Cambiar a 'Administrador' desbloquea funciones avanzadas de gestión.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico (No editable)</Label>
                <Input id="email" value={profile?.email || ""} disabled className="bg-slate-50" />
              </div>
            </CardContent>
            <CardFooter className="justify-end gap-2 border-t pt-6">
              <Button 
                className="bg-primary hover:bg-primary/90 text-white" 
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar Cambios
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
