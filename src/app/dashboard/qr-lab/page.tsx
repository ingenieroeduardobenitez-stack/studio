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
  AlertCircle
} from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"
import { generatePaymentQr } from "./actions"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"

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
        orderId
      })

      if (response.success) {
        setQrResult(response.qrString)
        setSecurityToken(response.token)
        
        // Intentar guardar el log, pero no bloquear si falla
        if (db) {
          addDoc(collection(db, "qr_transactions"), {
            ...formData,
            orderId,
            status: "PENDING",
            qrString: response.qrString,
            token: response.token,
            createdAt: serverTimestamp(),
            testerId: user?.uid || "anonymous"
          }).catch(e => console.warn("No se pudo guardar el registro de auditoría, pero el QR se generó igual."))
        }

        toast({ title: "QR Generado", description: "Simulación de respuesta de pasarela exitosa." })
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
            <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Laboratorio de QR (Integración)</h1>
            <p className="text-muted-foreground font-medium">Pruebas de cobro dinámico con datos reales del Santuario.</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 gap-2 h-8 px-4">
          <Zap className="h-3 w-3 fill-yellow-500" /> Modo Simulación Activo
        </Badge>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="border-none shadow-xl bg-white overflow-hidden border-t-4 border-t-accent">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-slate-500">
                <Search className="h-4 w-4" /> Buscar Persona Inscripta
              </CardTitle>
              <CardDescription>Selecciona un confirmando para cargar sus datos automáticamente.</CardDescription>
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
                            <p className="text-[10px] text-slate-500">C.I. {student.ciNumber} • {student.catechesisYear?.replace('_', ' ')}</p>
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
              <CardTitle className="text-lg flex items-center gap-2 font-headline"><Database className="h-5 w-5" /> Datos del Cobro (Request)</CardTitle>
              <CardDescription className="text-white/70">Valores que serán enviados a la pasarela de pagos.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
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
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase text-slate-500">Descripción del Cobro</Label>
                <Input 
                  value={formData.description} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="h-12 rounded-xl"
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-700 leading-relaxed font-medium">
                  <strong>Nota técnica:</strong> Estos campos se combinan con tu llave privada para generar el hash de seguridad SHA-256 antes de solicitar el código QR.
                </p>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 p-6 border-t">
              <Button 
                className="w-full h-14 rounded-2xl font-black text-lg shadow-lg gap-2 active:scale-95 transition-transform" 
                onClick={handleSimulate}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <><RefreshCcw className="h-5 w-5" /> Generar Cobro QR</>}
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className={cn(
            "border-none shadow-xl transition-all duration-500 overflow-hidden",
            qrResult ? "bg-white" : "bg-slate-100 opacity-50 grayscale"
          )}>
            <CardHeader className="border-b">
              <CardTitle className="text-lg font-headline">Código QR de Pago (Response)</CardTitle>
              <CardDescription>Escaneable desde ueno bank, Eko, Itaú y otras apps bancarias.</CardDescription>
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
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">String PY-QR (Formato BCP):</p>
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
                  <p className="text-sm font-medium text-slate-400 italic">Prepara el cobro y presiona el botón para visualizar el código QR dinámico</p>
                </div>
              )}
            </CardContent>
            {qrResult && (
              <CardFooter className="bg-slate-50 border-t p-4 flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl font-bold h-12 gap-2" onClick={downloadQr}>
                  <Download className="h-4 w-4" /> Guardar Imagen
                </Button>
                <Button className="flex-1 bg-green-600 hover:bg-green-700 rounded-xl font-bold h-12 gap-2 shadow-md">
                  <ShieldCheck className="h-4 w-4" /> Simular Pago
                </Button>
              </CardFooter>
            )}
          </Card>

          <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-6 opacity-10"><ShieldCheck className="h-24 w-24" /></div>
            <CardHeader>
              <CardTitle className="text-white text-base font-headline">Token de Seguridad (HMAC-SHA256)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed italic">
                Este token garantiza que el monto y los datos no han sido alterados durante la comunicación con el integrador bancario.
              </p>
              <div className="bg-white/5 p-4 rounded-xl border border-white/10 font-mono text-[10px] break-all text-primary-foreground/80 shadow-inner">
                {securityToken || "Esperando generación de cobro..."}
              </div>
              <div className="flex items-center gap-2 text-[9px] font-bold text-green-400 uppercase tracking-widest bg-green-400/10 w-fit px-3 py-1 rounded-full">
                <CheckCircle2 className="h-3 w-3 fill-green-400 text-slate-900" /> Firma de Integridad Lista
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}