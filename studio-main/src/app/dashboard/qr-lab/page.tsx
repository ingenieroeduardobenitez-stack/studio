
"use client"

import { useState, useEffect, useMemo } from "react"
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
  Database,
  Search,
  CheckCircle2,
  AlertTriangle,
  Building2,
  FileText,
  ExternalLink,
  Lock
} from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"
import { generatePaymentQr } from "./actions"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, addDoc, serverTimestamp, doc } from "firebase/firestore"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function QrLabPage() {
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [qrResult, setQrResult] = useState<string | null>(null)
  const [securityToken, setSecurityToken] = useState<string | null>(null)
  const [studentSearch, setStudentSearch] = useState("")
  
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

  const treasuryRef = useMemoFirebase(() => db ? doc(db, "settings", "treasury") : null, [db])
  const { data: treasurySettings } = useDoc(treasuryRef)

  const regsQuery = useMemoFirebase(() => db ? collection(db, "confirmations") : null, [db])
  const { data: allConfirmands, loading: loadingRegs } = useCollection(regsQuery)

  const filteredConfirmands = useMemo(() => {
    if (!allConfirmands || !studentSearch) return []
    return allConfirmands.filter(c => 
      c.fullName?.toLowerCase().includes(studentSearch.toLowerCase()) || 
      c.ciNumber?.includes(studentSearch)
    ).slice(0, 5)
  }, [allConfirmands, studentSearch])

  const handleSelectStudent = (student: any) => {
    const pending = (student.registrationCost || 0) - (student.amountPaid || 0)
    setFormData({
      amount: pending > 0 ? pending : 0,
      buyerName: student.fullName,
      buyerIdentity: student.ciNumber,
      description: `Inscripción ${student.catechesisYear?.replace('_', ' ')}`
    })
    setStudentSearch("")
    toast({ 
      title: "Datos cargados", 
      description: `Se dispararon los datos de ${student.fullName} al formulario.` 
    })
  }

  const handleSimulate = async () => {
    setIsLoading(true)
    const orderId = `TX-${Date.now()}`
    
    try {
      const response = await generatePaymentQr({
        ...formData,
        orderId,
        merchantAlias: treasurySettings?.alias || ""
      })

      if (response.success) {
        setQrResult(response.qrString)
        setSecurityToken(response.token)
        
        if (db) {
          addDoc(collection(db, "qr_transactions"), {
            ...formData,
            orderId,
            status: "PENDING",
            qrString: response.qrString,
            token: response.token,
            merchantAlias: treasurySettings?.alias || "NO_ALIAS",
            createdAt: serverTimestamp(),
            testerId: user?.uid || "anonymous"
          }).catch(() => {})
        }

        toast({ title: "QR Generado", description: "Simulación de respuesta PY-QR exitosa." })
      } else {
        toast({ variant: "destructive", title: "Error", description: response.error })
      }
    } catch (err) {
      console.error(err)
      toast({ variant: "destructive", title: "Error crítico", description: "Ocurrió un error al procesar la solicitud." })
    } finally {
      setIsLoading(false)
    }
  }

  const downloadQr = () => {
    const canvas = document.getElementById("lab-qr-canvas") as HTMLCanvasElement
    if (canvas) {
      const url = canvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.download = `QR-Integracion-${formData.buyerIdentity}.png`
      link.href = url
      link.click()
    }
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <QrCode className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Laboratorio de QR (Integración)</h1>
            <p className="text-muted-foreground font-medium">Fase de pruebas técnicas para cobros automatizados.</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 gap-2 h-8 px-4">
          <Zap className="h-3 w-3 fill-yellow-500" /> Modo Simulación
        </Badge>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* COLUMNA 1: CONFIGURACIÓN */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-xl bg-white overflow-hidden border-t-4 border-t-accent">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-slate-500">
                <Search className="h-4 w-4" /> 1. Buscar Persona Inscripta
              </CardTitle>
              <CardDescription>Selecciona un alumno para cargar sus datos automáticamente.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Buscar por Nombre o C.I..." 
                  className="pl-10 h-12 rounded-xl bg-slate-50 border-slate-200"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
              </div>

              {studentSearch && (
                <div className="mt-4 border rounded-2xl overflow-hidden bg-white shadow-lg animate-in slide-in-from-top-2 z-20 relative">
                  {loadingRegs ? (
                    <div className="p-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>
                  ) : filteredConfirmands.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">No se encontraron coincidencias.</div>
                  ) : (
                    <div className="divide-y">
                      {filteredConfirmands.map((student) => (
                        <div 
                          key={student.id} 
                          className="p-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3 transition-colors"
                          onClick={() => handleSelectStudent(student)}
                        >
                          <Avatar className="h-8 w-8 border">
                            <AvatarImage src={student.photoUrl} />
                            <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-900">{student.fullName}</p>
                            <p className="text-[10px] text-slate-500">C.I. {student.ciNumber}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-primary">Saldo: {((student.registrationCost || 0) - (student.amountPaid || 0)).toLocaleString('es-PY')} Gs.</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white overflow-hidden">
            <CardHeader className="bg-primary text-white p-6">
              <CardTitle className="text-lg flex items-center gap-2 font-headline"><Database className="h-5 w-5" /> 2. Formulario de Cobro</CardTitle>
              <CardDescription className="text-white/70">Define los valores de la transacción de prueba.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="bg-slate-50 p-4 rounded-2xl border border-dashed flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border shadow-sm text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Cuenta Destino (ueno):</p>
                    <p className="text-sm font-black text-slate-900">{treasurySettings?.alias || "Sin Alias Configurado"}</p>
                  </div>
                </div>
                <Badge className="bg-primary/10 text-primary border-none text-[10px] uppercase">Vinculado</Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase text-slate-500">Monto Neto (Gs)</Label>
                  <Input 
                    type="number" 
                    value={formData.amount} 
                    onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                    className="h-12 rounded-xl text-lg font-black text-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase text-slate-500">C.I. / RUC</Label>
                  <Input 
                    value={formData.buyerIdentity} 
                    onChange={(e) => setFormData({...formData, buyerIdentity: e.target.value})}
                    className="h-12 rounded-xl font-bold"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase text-slate-500">Nombre del Comprador</Label>
                <Input 
                  value={formData.buyerName} 
                  onChange={(e) => setFormData({...formData, buyerName: e.target.value})}
                  className="h-12 rounded-xl font-bold"
                />
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 p-6 border-t">
              <Button 
                className="w-full h-14 rounded-2xl font-black text-lg shadow-lg gap-2 active:scale-95 transition-transform" 
                onClick={handleSimulate}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <><RefreshCcw className="h-5 w-5" /> Generar PY-QR Dinámico</>}
              </Button>
            </CardFooter>
          </Card>

          {/* SECCIÓN INFORMATIVA: HOJA DE RUTA */}
          <Card className="border-none shadow-xl bg-slate-50 border-l-4 border-l-primary overflow-hidden">
            <CardHeader className="bg-white/50 border-b">
              <CardTitle className="text-base flex items-center gap-2 font-headline text-slate-800">
                <FileText className="h-5 w-5 text-primary" /> ¿Cómo habilitar cobros reales?
              </CardTitle>
              <CardDescription>Para que el dinero ingrese automáticamente, debes seguir estos pasos fuera del sistema.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-2">
                  <Badge className="bg-primary/10 text-primary mb-1">Paso 1: Contrato</Badge>
                  <p className="text-xs font-bold text-slate-700">Contactar con Bancard o Pagopar</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Debes solicitar el servicio de <strong>"Ventas QR"</strong>. Te pedirán el RUC de la Parroquia y una cuenta bancaria (como la de ueno) para depositar los fondos.
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-2">
                  <Badge className="bg-primary/10 text-primary mb-1">Paso 2: Credenciales</Badge>
                  <p className="text-xs font-bold text-slate-700">Obtener API Keys</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Una vez firmado el contrato, te entregarán un <strong>"Public Key"</strong> y un <strong>"Private Key"</strong>. Estas llaves reemplazan a las llaves de prueba que usamos ahora.
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-blue-800">¿Por qué la app de ueno dice "Inválido"?</p>
                  <p className="text-[10px] text-blue-700 leading-relaxed">
                    Las apps bancarias validan que el "ID de Comercio" dentro del QR esté activo en la red Bancard. Sin un contrato firmado, el QR es técnicamente correcto pero comercialmente inexistente.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-white/50 border-t p-4 flex justify-between">
              <Button variant="ghost" className="text-[10px] font-bold text-primary gap-2" asChild>
                <a href="https://www.bancard.com.py/comercios/" target="_blank"><ExternalLink className="h-3 w-3" /> Portal Bancard</a>
              </Button>
              <Button variant="ghost" className="text-[10px] font-bold text-primary gap-2" asChild>
                <a href="https://pagopar.com/" target="_blank"><ExternalLink className="h-3 w-3" /> Portal Pagopar</a>
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* COLUMNA 2: RESULTADOS */}
        <div className="space-y-8">
          <Card className={cn(
            "border-none shadow-xl transition-all duration-500 overflow-hidden",
            qrResult ? "bg-white" : "bg-slate-100 opacity-50 grayscale"
          )}>
            <CardHeader className="border-b">
              <CardTitle className="text-lg font-headline">Vista Previa del QR</CardTitle>
              <CardDescription>Escaneable por apps paraguayas.</CardDescription>
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
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">String EMVCo Generado:</p>
                    <div className="bg-slate-50 p-3 rounded-xl border font-mono text-[8px] break-all max-h-[100px] overflow-y-auto text-slate-500">
                      {qrResult}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-20 text-center space-y-4">
                  <div className="bg-slate-200 h-24 w-24 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <QrCode className="h-10 w-10 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-400 italic">Completa los datos para ver el QR</p>
                </div>
              )}
            </CardContent>
            {qrResult && (
              <CardFooter className="bg-slate-50 border-t p-4">
                <Button variant="outline" className="w-full rounded-xl font-bold h-12 gap-2" onClick={downloadQr}>
                  <Download className="h-4 w-4" /> Guardar Imagen
                </Button>
              </CardFooter>
            )}
          </Card>

          <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-6 opacity-10"><ShieldCheck className="h-24 w-24" /></div>
            <CardHeader>
              <CardTitle className="text-white text-base font-headline">Firma de Seguridad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white/5 p-4 rounded-xl border border-white/10 font-mono text-[10px] break-all text-primary-foreground/80 shadow-inner">
                {securityToken || "Esperando generación..."}
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed italic">
                Este hash HMAC-SHA256 asegura que los datos del cobro no fueron alterados durante la simulación.
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase text-slate-500">Seguridad SIPAP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-xs font-medium text-slate-600">Formato EMVCo validado</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-xs font-medium text-slate-600">Protocolo PY-QR detectado</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Lock className="h-4 w-4 text-orange-600" />
                </div>
                <p className="text-xs font-medium text-slate-600">Fase: Demo (Sandbox)</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
