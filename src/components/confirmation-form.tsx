"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { 
  Loader2, 
  User,
  BookOpen,
  Church,
  ArrowRight,
  ShieldCheck,
  Users,
  Camera,
  Search,
  CheckCircle2,
  Printer,
  AlertTriangle,
  CreditCard,
  Home,
  Info,
  Wallet,
  MessageCircle,
  Building2,
  FileText,
  Fingerprint,
  QrCode,
  Shield,
  Check,
  X,
  Copy
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useFirestore, useUser, useDoc } from "@/firebase"
import { doc, setDoc, getDoc, serverTimestamp, addDoc, collection } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { QRCodeCanvas } from "qrcode.react"

/**
 * MOTOR PY-QR ESTÁNDAR BCP (COMPATIBILIDAD UENO / BNF / FAMILIAR / ITAU)
 */
const cleanS = (s: string) => {
  if (!s) return "";
  return s.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
};

const formatTag = (tag: string, value: string) => {
  const len = value.length.toString().padStart(2, '0');
  return tag + len + value;
};

const generatePyQr = ({ alias, bankName, accountNumber, accountOwner, amount, concept }: any) => {
  try {
    let payload = "";
    payload += formatTag("00", "01"); 
    payload += formatTag("01", "12"); 

    // Tag 26: Merchant Account Information (SIPAP/SPI Paraguay)
    let merchantInfo = formatTag("00", "py.gov.bcp.spi");
    if (alias) {
      const cleanAlias = alias.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      merchantInfo += formatTag("01", cleanAlias);
    } else if (accountNumber) {
      const cleanAcc = accountNumber.replace(/[^0-9]/g, '');
      merchantInfo += formatTag("01", cleanAcc);
      if (bankName) {
        merchantInfo += formatTag("02", cleanS(bankName).substring(0, 10));
      }
    }
    payload += formatTag("26", merchantInfo);

    payload += formatTag("52", "0000"); // MCC
    payload += formatTag("53", "600");  // PYG
    
    if (amount > 0) {
      payload += formatTag("54", Math.floor(amount).toString()); 
    }

    payload += formatTag("58", "PY");   
    payload += formatTag("59", cleanS(accountOwner || "PARROQUIA").substring(0, 25)); 
    payload += formatTag("60", "ASUNCION"); 

    const cleanConcept = cleanS(concept || "PAGO CATEQUESIS").substring(0, 20);
    payload += formatTag("62", formatTag("05", cleanConcept));

    payload += "6304"; 

    // CRC-16/CCITT-FALSE
    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : (crc << 1);
      }
    }
    const finalCrc = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    payload += finalCrc;

    return payload;
  } catch (e) {
    return "";
  }
};

const formSchema = z.object({
  fullName: z.string().min(5, "Nombre completo requerido"),
  ciNumber: z.string().min(5, "N° C.I. requerido"),
  phone: z.string().min(8, "N° de celular requerido"),
  birthDate: z.string().min(1, "Fecha de nacimiento requerida"),
  age: z.coerce.number().optional(),
  photoUrl: z.string().optional(),
  motherName: z.string().optional(),
  motherPhone: z.string().optional(),
  fatherName: z.string().optional(),
  fatherPhone: z.string().optional(),
  tutorName: z.string().optional(),
  tutorPhone: z.string().optional(),
  catechesisYear: z.enum(["PRIMER_AÑO", "SEGUNDO_AÑO", "ADULTOS"], {
    required_error: "Debe seleccionar un año de catequesis",
  }),
  attendanceDay: z.enum(["SABADO", "DOMINGO"], {
    required_error: "Debe seleccionar un día de asistencia",
  }),
  hasBaptism: z.boolean().default(false),
  hasFirstCommunion: z.boolean().default(false),
  baptismParish: z.string().optional(),
  baptismBook: z.string().optional(),
  baptismFolio: z.string().optional(),
  initialPayment: z.coerce.number().min(0, "Monto inválido").default(0),
  generateReceipt: z.boolean().default(false),
})

type FormValues = z.infer<typeof formSchema>

export function ConfirmationForm({ isPublic = false }: { isPublic?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [isSearchingCi, setIsSearchingCi] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [submittedData, setSubmittedData] = useState<any>(null)
  const [isSubmittedSuccessfully, setIsSubmittedSuccessfully] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  const router = useRouter()

  const userProfileRef = useMemo(() => db && user?.uid ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc(userProfileRef)

  const treasuryRef = useMemo(() => db ? doc(db, "settings", "treasury") : null, [db])
  const { data: costs } = useDoc(treasuryRef)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      ciNumber: "",
      phone: "",
      birthDate: "",
      age: 0,
      photoUrl: "",
      motherName: "",
      motherPhone: "",
      fatherName: "",
      fatherPhone: "",
      tutorName: "",
      tutorPhone: "",
      catechesisYear: undefined,
      attendanceDay: undefined,
      hasBaptism: false,
      hasFirstCommunion: false,
      baptismParish: "",
      baptismBook: "",
      baptismFolio: "",
      initialPayment: 0,
      generateReceipt: false,
    },
  })

  const catechesisYear = form.watch("catechesisYear")
  const initialPayment = form.watch("initialPayment")
  const birthDate = form.watch("birthDate")

  useEffect(() => {
    if (birthDate) {
      const birth = new Date(birthDate)
      const now = new Date()
      let calculatedAge = now.getFullYear() - birth.getFullYear()
      const m = now.getMonth() - birth.getMonth()
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
        calculatedAge--
      }
      form.setValue("age", calculatedAge >= 0 ? calculatedAge : 0)
    }
  }, [birthDate, form])

  const handleLookupCi = (ciValue: string) => {
    if (!db || !ciValue || ciValue.length < 5) return;
    setIsSearchingCi(true);
    const cleanCi = ciValue.replace(/\./g, "").trim();
    const cedulaRef = doc(db, "cedulas", cleanCi);
    getDoc(cedulaRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.NOMBRE && data.APELLIDO) form.setValue("fullName", `${data.NOMBRE} ${data.APELLIDO}`.trim());
          if (data.NOM_MADRE) form.setValue("motherName", data.NOM_MADRE);
          if (data.NOM_PADRE) form.setValue("fatherName", data.NOM_PADRE);
          if (data.FECHA_NACI) form.setValue("birthDate", data.FECHA_NACI);
          toast({ title: "Datos encontrados" });
        }
      })
      .finally(() => setIsSearchingCi(false));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setPhotoPreview(base64String)
        form.setValue("photoUrl", base64String)
      }
      reader.readAsDataURL(file)
    }
  }

  const calculateCost = () => {
    if (!catechesisYear) return 0
    if (catechesisYear === "ADULTOS") return costs?.adultCost || 50000
    return costs?.juvenileCost || 35000
  }

  const totalCost = calculateCost()
  const isOverpaid = initialPayment > totalCost

  const onSubmit = async (values: FormValues) => {
    if (!db) return;
    setLoading(true)
    const regId = `conf_${Date.now()}`
    const regRef = doc(db, "confirmations", regId)
    const amountPaid = isPublic ? 0 : values.initialPayment
    const paymentStatus = amountPaid >= totalCost ? "PAGADO" : amountPaid > 0 ? "PARCIAL" : "PENDIENTE"

    const registrationData = {
      userId: user?.uid || "public_registration",
      ...values,
      initialPayment: amountPaid,
      status: "INSCRITO",
      attendanceStatus: "PENDIENTE",
      needsRecovery: false,
      registrationCost: totalCost,
      amountPaid: amountPaid,
      paymentStatus: paymentStatus,
      createdAt: serverTimestamp()
    }

    try {
      await setDoc(regRef, registrationData)
      await addDoc(collection(db, "audit_logs"), {
        userId: user?.uid || "public",
        userName: profile ? `${profile.firstName} ${profile.lastName}` : (isPublic ? "Usuario Público" : "Sistema"),
        action: "Registro de Confirmando",
        module: "inscripcion",
        details: `Nueva inscripción: ${values.fullName} (CI: ${values.ciNumber})`,
        timestamp: serverTimestamp()
      })
      toast({ title: isPublic ? "Datos enviados" : "Inscripción Realizada" });
      setSubmittedData({ ...registrationData, id: regId, createdAt: new Date().toISOString() })
      if (isPublic) setIsSubmittedSuccessfully(true)
      else if (amountPaid > 0 && values.generateReceipt) setIsReceiptOpen(true)
      else router.push("/dashboard")
    } catch (error: any) {
      const permissionError = new FirestorePermissionError({
        path: regRef.path,
        operation: 'create',
        requestResourceData: registrationData,
      })
      errorEmitter.emit('permission-error', permissionError)
    } finally {
      setLoading(false)
    }
  }

  const handleSendReceiptWhatsApp = () => {
    if (!submittedData) return
    const phone = submittedData.phone || submittedData.motherPhone || submittedData.fatherPhone;
    if (!phone) return;
    const message = encodeURIComponent(`⛪ *RECIBO OFICIAL*\n*Parroquia Perpetuo Socorro*\n\nHola *${submittedData.fullName}*,\nConfirmamos el cobro de *${submittedData.initialPayment.toLocaleString()} Gs.* por inscripción.`)
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${message}`, '_blank')
  }

  const handleSendProofWhatsApp = () => {
    if (!submittedData) return
    const message = encodeURIComponent(`⛪ *Comprobante de Inscripción*\n\nHola, adjunto mi comprobante.\n*Nombre:* ${submittedData.fullName}\n*C.I.:* ${submittedData.ciNumber}`)
    window.open(`https://wa.me/?text=${message}`, '_blank')
  }

  const handleCloseReceipt = () => {
    setIsReceiptOpen(false)
    router.push("/dashboard")
  }

  const qrPyData = useMemo(() => {
    if (!costs || !submittedData) return "";
    return generatePyQr({
      alias: costs.paymentMethod === "ALIAS" ? costs.alias : null,
      bankName: costs.bankName,
      accountNumber: costs.accountNumber,
      accountOwner: costs.accountOwner,
      amount: totalCost,
      concept: `INS ${submittedData.fullName}`
    });
  }, [costs, submittedData, totalCost]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado" });
  }

  if (isSubmittedSuccessfully) {
    return (
      <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 max-w-2xl mx-auto">
        <Card className="border-none shadow-2xl bg-white rounded-3xl p-10 text-center space-y-6">
          <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-headline font-bold text-slate-900">¡Inscripción Enviada!</h2>
            <p className="text-slate-500 font-medium">Hola <span className="text-primary font-bold">{submittedData?.fullName}</span>, tus datos han sido recibidos.</p>
          </div>

          <div className="bg-primary/5 p-8 rounded-3xl border border-primary/10 text-left space-y-6">
            <div className="flex items-center gap-3 border-b border-primary/10 pb-4">
              <Wallet className="h-6 w-6 text-primary" />
              <h3 className="font-bold text-primary uppercase tracking-wider text-sm">Información para el Pago</h3>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 items-center">
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Total Arancel</p>
                  <p className="text-2xl font-headline font-bold text-slate-900">{totalCost.toLocaleString()} Gs.</p>
                </div>
                <div className="space-y-1">
                  {costs?.paymentMethod === "ALIAS" ? (
                    <>
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-tighter">Alias:</p>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-black text-primary uppercase">{costs?.alias || "---"}</p>
                        <Copy className="h-4 w-4 text-slate-400 cursor-pointer" onClick={() => copyToClipboard(costs?.alias || "")} />
                      </div>
                      <p className="text-xs text-slate-500">{costs?.accountOwner || "---"}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-slate-700">{costs?.bankName || "Cuenta Bancaria"}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-mono font-bold text-primary">{costs?.accountNumber || "---"}</p>
                        <Copy className="h-4 w-4 text-slate-400 cursor-pointer" onClick={() => copyToClipboard(costs?.accountNumber || "")} />
                      </div>
                      <p className="text-xs text-slate-500">{costs?.accountOwner || "---"}</p>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-2 bg-white p-4 rounded-2xl border shadow-sm">
                <div className="bg-primary text-white text-[8px] font-black px-1.5 py-0.5 rounded">PY-QR</div>
                <QRCodeCanvas value={qrPyData} size={140} level="M" />
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Escaneo Ueno/BNF/Familiar</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-dashed text-xs text-slate-600 space-y-3">
              <p className="font-bold flex items-center gap-2 text-primary"><Info className="h-3 w-3" /> PASO FINAL:</p>
              <p>Envía tu captura de transferencia para validar tu inscripción.</p>
              <Button onClick={handleSendProofWhatsApp} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold h-11 rounded-xl gap-2">
                <MessageCircle className="h-4 w-4" /> Enviar Comprobante por WhatsApp
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => window.print()}>Imprimir Ficha</Button>
            <Button asChild className="flex-1 h-12 rounded-xl font-bold shadow-lg">
              <Link href="/">Volver al Inicio</Link>
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto pb-12">
      <Card className="border-none shadow-2xl bg-white rounded-3xl overflow-hidden">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader className="bg-primary text-white p-8">
              <div className="flex items-center gap-3">
                <Church className="h-8 w-8 text-white/80" />
                <div>
                  <CardTitle className="text-2xl font-headline font-bold">Registro de Postulante</CardTitle>
                  <CardDescription className="text-white/80 font-medium">Ciclo 2026</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-10">
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="relative group">
                  <Avatar className="h-32 w-32 border-4 border-slate-100">
                    <AvatarImage src={photoPreview || undefined} className="object-cover" />
                    <AvatarFallback className="bg-slate-50 text-slate-300"><User className="h-16 w-16" /></AvatarFallback>
                  </Avatar>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 h-10 w-10 bg-primary rounded-full flex items-center justify-center text-white border-4 border-white"><Camera className="h-5 w-5" /></button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                </div>
              </div>

              <div className="space-y-6">
                <FormField control={form.control} name="ciNumber" render={({ field }) => (
                  <FormItem className="max-w-xs">
                    <FormLabel className="font-semibold">N° de C.I.</FormLabel>
                    <div className="relative">
                      <FormControl><Input placeholder="1234567" {...field} className="h-12 rounded-xl" onBlur={(e) => handleLookupCi(e.target.value)} /></FormControl>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isSearchingCi && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid gap-6 md:grid-cols-2">
                  <FormField control={form.control} name="fullName" render={({ field }) => (
                    <FormItem><FormLabel className="font-semibold">Nombre Completo</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel className="font-semibold">Celular</FormLabel><FormControl><Input placeholder="09..." {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <FormField control={form.control} name="birthDate" render={({ field }) => (
                    <FormItem><FormLabel className="font-semibold">Fecha de Nacimiento</FormLabel><FormControl><Input type="date" {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="age" render={({ field }) => (
                    <FormItem><FormLabel className="font-semibold">Edad</FormLabel><FormControl><Input type="number" readOnly {...field} className="h-12 rounded-xl bg-slate-50" /></FormControl></FormItem>
                  )} />
                </div>
              </div>

              <Separator />

              <div className="grid gap-6 md:grid-cols-2">
                <FormField control={form.control} name="catechesisYear" render={({ field }) => (
                  <FormItem><FormLabel className="font-semibold">Nivel *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccione" /></SelectTrigger></FormControl><SelectContent><SelectItem value="PRIMER_AÑO">1er Año</SelectItem><SelectItem value="SEGUNDO_AÑO">2do Año</SelectItem><SelectItem value="ADULTOS">Adultos</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="attendanceDay" render={({ field }) => (
                  <FormItem><FormLabel className="font-semibold">Día de Asistencia *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccione" /></SelectTrigger></FormControl><SelectContent><SelectItem value="SABADO">Sábados</SelectItem><SelectItem value="DOMINGO">Domingos</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
              </div>

              {!isPublic && (
                <div className="grid gap-6 md:grid-cols-2 items-end">
                  <FormField control={form.control} name="initialPayment" render={({ field }) => (
                    <FormItem><FormLabel className="font-semibold text-primary">Monto Cobrado (Gs)</FormLabel><FormControl><Input type="number" {...field} className={cn("h-12 rounded-xl font-bold border-2", isOverpaid ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-200')} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="generateReceipt" render={({ field }) => (
                    <FormItem className="w-full">
                      <FormControl>
                        <Button type="button" variant={field.value ? "default" : "outline"} onClick={() => field.onChange(!field.value)} className={cn("w-full h-12 rounded-xl font-bold gap-2", !field.value && "text-slate-400")}>
                          <FileText className="h-4 w-4" />
                          <span className="text-[10px] font-bold uppercase">{field.value ? "RECIBO ACTIVADO" : "GENERAR RECIBO"}</span>
                          {field.value && <Check className="h-4 w-4" />}
                        </Button>
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
              )}
            </CardContent>

            <CardFooter className="bg-slate-50 p-10 flex flex-col md:flex-row items-center justify-between gap-6 border-t">
              <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm w-full md:w-auto">
                <div className="h-12 w-12 bg-accent/10 rounded-xl flex items-center justify-center"><CreditCard className="h-6 w-6 text-accent" /></div>
                <div><p className="text-xs font-bold text-slate-500 uppercase">Total Arancel</p><p className="text-xl font-headline font-bold text-primary">{totalCost.toLocaleString()} Gs.</p></div>
              </div>
              <Button type="submit" disabled={loading} className="h-12 bg-primary hover:bg-primary/90 text-white rounded-xl px-12 font-bold shadow-lg w-full md:w-auto">
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <span>{isPublic ? "Enviar Inscripción" : "Registrar y Cobrar"}</span>}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl bg-white">
          <div className="p-12 space-y-10 bg-white" id="receipt-print">
            <div className="flex items-center justify-between border-b pb-8">
              <div className="flex items-center gap-4">
                <Church className="h-10 w-10 text-primary" />
                <div><h3 className="font-headline font-bold text-xl">PARROQUIA</h3><p className="text-xs text-muted-foreground uppercase">Perpetuo Socorro</p></div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-[10px] uppercase font-bold border-primary text-primary px-3 py-1 mb-2">Comprobante de Pago</Badge>
                <p className="text-sm font-bold text-slate-900">ID: {submittedData?.id?.slice(-10)}</p>
                <p className="text-[10px] text-slate-400 font-medium">EMITIDO: {new Date().toLocaleString()}</p>
              </div>
            </div>
            <div className="space-y-6">
              <div><p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Confirmando</p><p className="text-xl font-headline font-bold">{submittedData?.fullName}</p></div>
              <div className="p-5 rounded-2xl bg-slate-50 border space-y-4">
                <div className="flex justify-between text-green-600"><span className="text-xs font-bold uppercase">Abonado</span><span className="text-lg font-bold">{submittedData?.initialPayment?.toLocaleString()} Gs.</span></div>
                <div className="flex justify-between text-red-500"><span className="text-xs font-bold uppercase">Saldo</span><span className="text-sm font-bold">{(submittedData?.registrationCost - submittedData?.initialPayment).toLocaleString()} Gs.</span></div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-8 bg-slate-50 border-t grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button variant="outline" className="rounded-2xl h-12" onClick={handleCloseReceipt}>Cerrar</Button>
            <Button className="rounded-2xl h-12 bg-primary text-white" onClick={() => window.print()}>Imprimir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
