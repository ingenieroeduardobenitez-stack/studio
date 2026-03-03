
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  QrCode, 
  Wallet, 
  User, 
  ShieldCheck, 
  Info, 
  Loader2, 
  Download, 
  RefreshCcw,
  Zap,
  ArrowRight,
  Database
} from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"
import { generatePaymentQr } from "./actions"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useUser } from "@/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { cn } from "@/lib/utils"

export default function QrLabPage() {
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [qrResult, setQrResult] = useState<string | null>(null)
  const [securityToken, setSecurityToken] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    amount: 35000,
    description: "Inscripción Catequesis 2026",
    buyerName: "Juan Pérez",
    buyerIdentity: "1234567"
  })

  const { toast } = useToast()
  const db = useFirestore()
  const { user } = useUser()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSimulate = async () => {
    setIsLoading(true)
    const orderId = `TX-${Date.now()}`
    
    try {
      const response = await generatePaymentQr({
        ...formData,
        orderId
      })

      if (response.success) {
        setQrResult(response.qrString)
        setSecurityToken(response.token)
        
        // Guardar registro en el laboratorio
        if (db) {
          await addDoc(collection(db, "qr_transactions"), {
            ...formData,
            orderId,
            status: "PENDING",
            qrString: response.qrString,
            token: response.token,
            createdAt: serverTimestamp(),
            testerId: user?.uid || "anonymous"
          })
        }

        toast({ title: "QR Generado", description: "Simulación de respuesta de pasarela exitosa." })
      } else {
        toast({ variant: "destructive", title: "Error", description: response.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error crítico", description: "No se pudo conectar con el simulador." })
    } finally {
      setIsLoading(false)
    }
  }

  const downloadQr = () => {
    const canvas = document.getElementById("lab-qr-canvas") as HTMLCanvasElement
    if (canvas) {
      const url = canvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.download = `QR-Test-${formData.buyerIdentity}.png`
      link.href = url
      link.click()
    }
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <QrCode className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Laboratorio de QR (ueno bank)</h1>
            <p className="text-muted-foreground">Pruebas de integración con redes de pago de Paraguay.</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 gap-2 h-8">
          <Zap className="h-3 w-3 fill-yellow-500" /> Modo Simulación Activo
        </Badge>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="border-none shadow-xl bg-white overflow-hidden">
          <CardHeader className="bg-primary text-white p-6">
            <CardTitle className="text-lg flex items-center gap-2"><Database className="h-5 w-5" /> Datos del Request (POST)</CardTitle>
            <CardDescription className="text-white/70">Campos obligatorios para generar un cobro dinámico.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="font-bold">Monto Neto (Gs)</Label>
                <Input 
                  type="number" 
                  value={formData.amount} 
                  onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">C.I. / RUC</Label>
                <Input 
                  value={formData.buyerIdentity} 
                  onChange={(e) => setFormData({...formData, buyerIdentity: e.target.value})}
                  className="h-12 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Nombre del Comprador</Label>
              <Input 
                value={formData.buyerName} 
                onChange={(e) => setFormData({...formData, buyerName: e.target.value})}
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Descripción del Cobro</Label>
              <Input 
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="h-12 rounded-xl"
              />
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-dashed text-[10px] space-y-2">
              <p className="font-bold text-slate-400 uppercase tracking-widest">Información Técnica:</p>
              <ul className="space-y-1 text-slate-500">
                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Algoritmo: SHA-256</li>
                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Destino: ueno bank (Configurado en Portal)</li>
                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Formato: EMVCo / PY-QR</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter className="bg-slate-50 p-6 border-t">
            <Button 
              className="w-full h-14 rounded-2xl font-black text-lg shadow-lg gap-2" 
              onClick={handleSimulate}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="animate-spin" /> : <><RefreshCcw /> Generar Cobro QR</>}
            </Button>
          </CardFooter>
        </Card>

        <div className="space-y-8">
          <Card className={cn(
            "border-none shadow-xl transition-all duration-500 overflow-hidden",
            qrResult ? "bg-white" : "bg-slate-100 opacity-50 grayscale"
          )}>
            <CardHeader className="border-b">
              <CardTitle className="text-lg">Resultado del QR (Response)</CardTitle>
              <CardDescription>Esta cadena de texto es procesada por el frontend para mostrar el código.</CardDescription>
            </CardHeader>
            <CardContent className="p-10 flex flex-col items-center justify-center gap-6">
              {qrResult ? (
                <>
                  <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border-4 border-primary ring-8 ring-primary/5">
                    <QRCodeCanvas 
                      id="lab-qr-canvas"
                      value={qrResult} 
                      size={240}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <div className="text-center space-y-2 w-full">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">String QR Generado:</p>
                    <div className="bg-slate-50 p-3 rounded-xl border font-mono text-[8px] break-all max-h-[100px] overflow-y-auto">
                      {qrResult}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-20 text-center space-y-4">
                  <div className="bg-slate-200 h-24 w-24 rounded-full flex items-center justify-center mx-auto">
                    <QrCode className="h-10 w-10 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-400">Presiona "Generar Cobro" para ver el QR</p>
                </div>
              )}
            </CardContent>
            {qrResult && (
              <CardFooter className="bg-slate-50 border-t p-4 flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl font-bold h-12 gap-2" onClick={downloadQr}>
                  <Download className="h-4 w-4" /> Descargar PNG
                </Button>
                <Button className="flex-1 bg-green-600 hover:bg-green-700 rounded-xl font-bold h-12 gap-2">
                  <ShieldCheck className="h-4 w-4" /> Simular Webhook
                </Button>
              </CardFooter>
            )}
          </Card>

          <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-6 opacity-10"><ShieldCheck className="h-24 w-24" /></div>
            <CardHeader>
              <CardTitle className="text-white text-base">Firma de Seguridad (Token)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                El token asegura que los datos no han sido alterados entre tu servidor y la pasarela.
              </p>
              <div className="bg-white/5 p-4 rounded-xl border border-white/10 font-mono text-[10px] break-all text-primary-foreground/80">
                {securityToken || "Esperando generación..."}
              </div>
              <div className="flex items-center gap-2 text-[9px] font-bold text-green-400 uppercase tracking-widest">
                <Zap className="h-3 w-3 fill-green-400" /> Validación HMAC-SHA256 lista
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-none shadow-md bg-blue-50 border-l-4 border-l-primary">
        <CardContent className="p-6 flex items-start gap-4">
          <Info className="h-6 w-6 text-primary shrink-0 mt-1" />
          <div className="space-y-2">
            <h4 className="font-bold text-primary">Siguientes pasos para Producción:</h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              1. <strong>Registro de Comercio</strong>: Debes dar de alta al Santuario en Bancard o Pagopar y vincular tu CBU/Alias de ueno.<br/>
              2. <strong>Credenciales</strong>: Reemplaza la <code>PRIVATE_KEY</code> en <code>actions.ts</code> por tu clave secreta real.<br/>
              3. <strong>Endpoints</strong>: Cambia el simulador por una llamada <code>fetch</code> al API URL de producción del integrador.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
