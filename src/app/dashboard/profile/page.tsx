"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera, Shield, Mail, User, MapPin, Loader2, Save, Key, Lock, FlipHorizontal, X } from "lucide-react"
import { useUser, useDoc, useFirestore, useAuth, useMemoFirebase } from "@/firebase"
import { doc, updateDoc } from "firebase/firestore"
import { updatePassword } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function ProfilePage() {
  const { user } = useUser()
  const auth = useAuth()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [isSaving, setIsSaving] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null)
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user?.uid) return null
    return doc(db, "users", user.uid)
  }, [db, user?.uid])

  const { data: profile, loading } = useDoc(userProfileRef)
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    photoUrl: ""
  })

  const [newPassword, setNewPassword] = useState("")

  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        photoUrl: profile.photoUrl || ""
      })
    }
  }, [profile])

  const onVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node && currentStream) {
      if (node.srcObject !== currentStream) {
        node.srcObject = currentStream;
        const playPromise = node.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            if (err.name !== 'AbortError') {
              console.error("Error al reproducir video:", err);
            }
          });
        }
      }
    }
    videoRef.current = node;
  }, [currentStream]);

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

  const startCamera = async (deviceId?: string) => {
    try {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          ...deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" },
          aspectRatio: { ideal: 0.75 } // Vertical 3:4
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setCurrentStream(stream)
      setHasCameraPermission(true)
      
      const availableDevices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = availableDevices.filter(d => d.kind === 'videoinput')
      setDevices(videoDevices)
      if (!selectedDeviceId && videoDevices.length > 0) {
        setSelectedDeviceId(deviceId || videoDevices[0].deviceId)
      }
      setShowCamera(true)
    } catch (error) {
      console.error('Error accessing camera:', error)
      setHasCameraPermission(false)
      toast({
        variant: 'destructive',
        title: 'Acceso denegado',
        description: 'Por favor, permite el acceso a la cámara en tu navegador.',
      })
    }
  }

  const stopCamera = () => {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop())
      setCurrentStream(null)
    }
    setShowCamera(false)
  }

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      
      const targetRatio = 3 / 4;
      let sourceWidth = video.videoWidth;
      let sourceHeight = video.videoHeight;
      let sourceX = 0;
      let sourceY = 0;

      if (sourceWidth / sourceHeight > targetRatio) {
        const newWidth = sourceHeight * targetRatio;
        sourceX = (sourceWidth - newWidth) / 2;
        sourceWidth = newWidth;
      } else {
        const newHeight = sourceWidth / targetRatio;
        sourceY = (sourceHeight - newHeight) / 2;
        sourceHeight = newHeight;
      }

      canvas.width = 480;
      canvas.height = 640;
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        setFormData(prev => ({ ...prev, photoUrl: dataUrl }))
        stopCamera()
      }
    }
  }

  const handleSaveProfile = async () => {
    if (!userProfileRef) return
    setIsSaving(true)

    updateDoc(userProfileRef, formData)
      .then(() => {
        toast({
          title: "Perfil actualizado",
          description: "Tus datos personales se han guardado correctamente.",
        })
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: userProfileRef.path,
          operation: 'update',
          requestResourceData: formData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsSaving(false)
      })
  }

  const handleUpdatePassword = async () => {
    if (!auth || !auth.currentUser || !newPassword) return
    if (newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Contraseña débil",
        description: "La contraseña debe tener al menos 6 caracteres.",
      })
      return
    }

    setIsUpdatingPassword(true)
    try {
      await updatePassword(auth.currentUser, newPassword)
      setNewPassword("")
      toast({
        title: "Contraseña actualizada",
        description: "Tu nueva contraseña ha sido guardada con éxito.",
      })
    } catch (error: any) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Error de seguridad",
        description: "Para cambiar la contraseña, debes haber iniciado sesión recientemente. Intenta cerrar sesión y volver a entrar.",
      })
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-headline font-bold text-primary">Gestión de Perfil</h1>
        <p className="text-muted-foreground">Administra tu información personal y seguridad de cuenta.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-8">
          <Card className="border-none shadow-xl text-center overflow-hidden bg-white">
            <CardHeader className="relative pb-0 pt-10">
              <div className="mx-auto h-32 w-32 rounded-full border-4 border-slate-50 p-1 relative">
                <Avatar className="h-full w-full">
                  <AvatarImage src={formData.photoUrl || undefined} className="object-cover" />
                  <AvatarFallback className="bg-slate-50 text-slate-300">
                    <User className="h-16 w-16" />
                  </AvatarFallback>
                </Avatar>
                
                <div className="absolute -bottom-1 -right-1 flex gap-1">
                  <button 
                    type="button"
                    className="h-9 w-9 rounded-full bg-primary text-white border-4 border-white flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg"
                    onClick={() => startCamera()}
                    title="Tomar Foto"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <button 
                    type="button"
                    className="h-9 w-9 rounded-full bg-accent text-white border-4 border-white flex items-center justify-center hover:bg-accent/90 transition-colors shadow-lg"
                    onClick={() => fileInputRef.current?.click()}
                    title="Subir Archivo"
                  >
                    <User className="h-4 w-4" />
                  </button>
                </div>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                />
              </div>
              <CardTitle className="mt-6 font-headline text-2xl font-bold">{formData.firstName} {formData.lastName}</CardTitle>
              <div className="mt-2 inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest">
                {profile?.role || "Catequista"}
              </div>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm text-slate-600 px-4">
                  <Mail className="h-4 w-4 text-slate-400" /> 
                  <span className="font-medium truncate">{profile?.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600 px-4">
                  <MapPin className="h-4 w-4 text-slate-400" /> 
                  <span className="font-medium text-xs">Santuario Nacional Ntra. Sra. del Perpetuo Socorro</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50/50 p-6 flex justify-center border-t">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <Shield className="h-3 w-3" /> Acceso Autorizado
              </div>
            </CardFooter>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-xl bg-white">
            <CardHeader>
              <CardTitle className="font-headline text-xl">Detalles Personales</CardTitle>
              <CardDescription>Actualiza tu nombre y apellido en el sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="font-bold text-slate-700">Nombre</Label>
                  <Input 
                    id="firstName" 
                    value={formData.firstName} 
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    className="h-12 rounded-xl bg-slate-50 border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="font-bold text-slate-700">Apellido</Label>
                  <Input 
                    id="lastName" 
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    className="h-12 rounded-xl bg-slate-50 border-slate-200"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-end bg-slate-50/50 p-6 rounded-b-xl border-t">
              <Button 
                className="bg-primary hover:bg-primary/90 text-white h-11 px-8 rounded-xl font-bold shadow-lg" 
                onClick={handleSaveProfile}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar Cambios
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-none shadow-xl bg-white">
            <CardHeader>
              <CardTitle className="font-headline text-xl flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" /> Seguridad
              </CardTitle>
              <CardDescription>Actualiza tu contraseña para mantener tu cuenta segura.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="font-bold text-slate-700">Nueva Contraseña</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    id="newPassword" 
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-12 rounded-xl bg-slate-50 border-slate-200 pl-10"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  Se recomienda usar una combinación de letras, números y símbolos.
                </p>
              </div>
            </CardContent>
            <CardFooter className="justify-end bg-slate-50/50 p-6 rounded-b-xl border-t">
              <Button 
                variant="outline"
                className="h-11 px-8 rounded-xl font-bold border-slate-200 text-slate-600 hover:bg-slate-100" 
                onClick={handleUpdatePassword}
                disabled={isUpdatingPassword || !newPassword}
              >
                {isUpdatingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
                Actualizar Contraseña
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Dialog open={showCamera} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-primary text-white">
            <DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Capturar Foto de Perfil</DialogTitle>
          </DialogHeader>
          
          <div className="relative bg-black aspect-[3/4] max-h-[60vh] mx-auto flex items-center justify-center overflow-hidden">
            <video 
              ref={onVideoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-cover" 
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {hasCameraPermission === false && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-white bg-slate-900/90 gap-4">
                <X className="h-12 w-12 text-red-500" />
                <p className="font-bold">Acceso a cámara requerido</p>
                <p className="text-xs text-slate-400">Habilita los permisos en tu navegador para usar esta función.</p>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-col gap-4">
            {devices.length > 1 && (
              <div className="flex items-center gap-2 w-full">
                <FlipHorizontal className="h-4 w-4 text-slate-400" />
                <Select value={selectedDeviceId} onValueChange={(val) => { setSelectedDeviceId(val); startCamera(val); }}>
                  <SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue placeholder="Cambiar Cámara" /></SelectTrigger>
                  <SelectContent>
                    {devices.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label || `Cámara ${device.deviceId.slice(0, 5)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={stopCamera}>Cancelar</Button>
              <Button className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 font-bold gap-2" onClick={takePhoto}>
                <Camera className="h-5 w-5" /> Capturar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}