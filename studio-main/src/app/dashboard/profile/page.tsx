
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Camera, 
  Shield, 
  Mail, 
  User, 
  MapPin, 
  Loader2, 
  Save, 
  Key, 
  Lock, 
  FlipHorizontal, 
  X, 
  Cake, 
  Image as ImageIcon,
  ZoomIn,
  Move,
  Check
} from "lucide-react"
import { useUser, useDoc, useFirestore, useAuth, useMemoFirebase } from "@/firebase"
import { doc, updateDoc } from "firebase/firestore"
import { updatePassword } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

export default function ProfilePage() {
  const [mounted, setMounted] = useState(false)
  const { user } = useUser()
  const auth = useAuth()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [isSaving, setIsSaving] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [showAdjuster, setShowAdjuster] = useState(false)
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null)
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null)
  
  // Estados para el ajuste de imagen
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  
  const [isInitialized, setIsInitialized] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const adjusterImgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user?.uid) return null
    return doc(db, "users", user.uid)
  }, [db, user?.uid])

  const { data: profile, loading } = useDoc(userProfileRef)
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    photoUrl: "",
    birthDate: ""
  })

  const [newPassword, setNewPassword] = useState("")

  useEffect(() => {
    if (profile && !isInitialized) {
      setFormData({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        photoUrl: profile.photoUrl || "",
        birthDate: profile.birthDate || ""
      })
      setIsInitialized(true)
    }
  }, [profile, isInitialized])

  const onVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node && currentStream) {
      if (node.srcObject !== currentStream) {
        node.srcObject = currentStream;
        node.play().catch(err => {
          if (err.name !== 'AbortError') console.error("Video play error:", err);
        });
      }
    }
    videoRef.current = node;
  }, [currentStream]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ variant: "destructive", title: "Formato no válido" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPendingPhoto(reader.result as string);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setShowAdjuster(true);
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = "";
  }

  const startCamera = async (deviceId?: string) => {
    try {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          facingMode: deviceId ? undefined : "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
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
      setHasCameraPermission(false)
      toast({ variant: 'destructive', title: 'Acceso a cámara denegado' })
    }
  }

  const stopCamera = () => {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop())
      setCurrentStream(null)
    }
    setShowCamera(false)
  }

  const takePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        setPendingPhoto(canvas.toDataURL('image/jpeg', 0.9));
        setZoom(1);
        setPosition({ x: 0, y: 0 });
        setShowAdjuster(true);
        stopCamera();
      }
    }
  }

  const handleAdjusterConfirm = () => {
    if (!canvasRef.current || !adjusterImgRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Generar recorte final cuadrado (800x800)
    canvas.width = 800;
    canvas.height = 800;
    
    const img = adjusterImgRef.current;
    const displaySize = 300; // tamaño del contenedor del visor
    
    // Calcular escala real
    const realScale = (img.naturalWidth / img.width) * zoom;
    
    // Limpiar canvas
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 800, 800);
    
    // Dibujar imagen con transformaciones
    ctx.save();
    ctx.translate(400, 400); // Mover al centro del canvas
    ctx.scale(realScale, realScale);
    // Aplicar posición relativa al centro del visor
    ctx.translate(position.x * (img.naturalWidth / (img.width * realScale)), position.y * (img.naturalHeight / (img.height * realScale)));
    
    ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
    ctx.restore();

    const finalDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setFormData(prev => ({ ...prev, photoUrl: finalDataUrl }));
    setShowAdjuster(false);
    setPendingPhoto(null);
    toast({ title: "Imagen ajustada" });
  }

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  }

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  }

  const handleMouseUp = () => {
    setIsDragging(false);
  }

  const handleSaveProfile = async () => {
    if (!userProfileRef) return
    setIsSaving(true)

    updateDoc(userProfileRef, formData)
      .then(() => {
        toast({ title: "Perfil actualizado" })
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: userProfileRef.path,
          operation: 'update',
          requestResourceData: formData,
        }));
      })
      .finally(() => setIsSaving(false))
  }

  const handleUpdatePassword = async () => {
    if (!auth || !auth.currentUser || !newPassword) return
    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "Contraseña débil" })
      return
    }

    setIsUpdatingPassword(true)
    try {
      await updatePassword(auth.currentUser, newPassword)
      setNewPassword("")
      toast({ title: "Contraseña actualizada" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error de seguridad", description: "Vuelve a iniciar sesión para cambiar la contraseña." })
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  if (!mounted || loading) {
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
              <div className="mx-auto h-32 w-32 rounded-full border-4 border-slate-50 p-1 relative shadow-lg">
                <Avatar className="h-full w-full">
                  <AvatarImage src={formData.photoUrl || undefined} className="object-cover" />
                  <AvatarFallback className="bg-slate-50 text-slate-300">
                    <User className="h-16 w-16" />
                  </AvatarFallback>
                </Avatar>
                
                <div className="absolute -bottom-1 -right-1 flex gap-1">
                  <button 
                    type="button"
                    className="h-9 w-9 rounded-full bg-primary text-white border-4 border-white flex items-center justify-center hover:bg-primary/90 transition-all shadow-lg active:scale-95"
                    onClick={() => startCamera()}
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <button 
                    type="button"
                    className="h-9 w-9 rounded-full bg-accent text-white border-4 border-white flex items-center justify-center hover:bg-accent/90 transition-all shadow-lg active:scale-95"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="h-4 w-4" />
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
              <CardDescription>Actualiza tu nombre y fecha de nacimiento para el sistema de alertas.</CardDescription>
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
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="birthDate" className="font-bold text-slate-700 flex items-center gap-2">
                    <Cake className="h-4 w-4 text-primary" /> Fecha de Nacimiento
                  </Label>
                  <Input 
                    id="birthDate" 
                    type="date"
                    value={formData.birthDate} 
                    onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
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

      {/* DIÁLOGO DE CÁMARA */}
      <Dialog open={showCamera} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-primary text-white">
            <DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Capturar Foto de Perfil</DialogTitle>
          </DialogHeader>
          
          <div className="relative bg-black aspect-square max-h-[60vh] mx-auto flex items-center justify-center overflow-hidden">
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
              <Button className="flex-1 h-12 rounded-xl bg-primary text-white font-bold gap-2" onClick={takePhoto}>
                <Camera className="h-5 w-5" /> Capturar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE AJUSTE Y RECORTE */}
      <Dialog open={showAdjuster} onOpenChange={(open) => !open && setShowAdjuster(false)}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-slate-900 text-white">
            <DialogTitle className="flex items-center gap-2"><Move className="h-5 w-5" /> Ajustar Fotografía</DialogTitle>
            <DialogDescription className="text-slate-400">Desplaza y ajusta el zoom para centrar tu rostro.</DialogDescription>
          </DialogHeader>
          
          <div className="p-8 bg-slate-50 flex flex-col items-center gap-8">
            <div 
              className="relative w-[300px] h-[300px] rounded-full border-4 border-white shadow-2xl bg-black overflow-hidden cursor-move touch-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchMove={handleMouseMove}
              onTouchEnd={handleMouseUp}
            >
              {pendingPhoto && (
                <img 
                  ref={adjusterImgRef}
                  src={pendingPhoto} 
                  alt="Ajuste"
                  className="absolute pointer-events-none select-none max-w-none"
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                    left: '50%',
                    top: '50%',
                    marginLeft: adjusterImgRef.current ? -adjusterImgRef.current.width / 2 : 0,
                    marginTop: adjusterImgRef.current ? -adjusterImgRef.current.height / 2 : 0,
                    transition: isDragging ? 'none' : 'transform 0.1s'
                  }}
                />
              )}
              {/* Overlay de guía circular */}
              <div className="absolute inset-0 rounded-full border-[100px] border-slate-900/20 pointer-events-none" />
            </div>

            <div className="w-full space-y-4 px-4">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">
                  <ZoomIn className="h-3 w-3" /> Nivel de Zoom
                </Label>
                <span className="text-[10px] font-bold text-primary">{Math.round(zoom * 100)}%</span>
              </div>
              <Slider 
                value={[zoom]} 
                min={0.5} 
                max={3} 
                step={0.01} 
                onValueChange={(val) => setZoom(val[0])} 
              />
            </div>
          </div>

          <DialogFooter className="p-6 bg-white border-t flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setShowAdjuster(false)}>Cancelar</Button>
            <Button className="flex-1 h-12 rounded-xl bg-primary text-white font-bold gap-2 shadow-lg" onClick={handleAdjusterConfirm}>
              <Check className="h-5 w-5" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
