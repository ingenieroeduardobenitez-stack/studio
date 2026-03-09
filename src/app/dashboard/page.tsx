
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ClipboardCheck, Users, Calendar, Loader2, Church, User, QrCode, Share2, Printer, MessageCircle, Download, FileText } from "lucide-react"
import { useUser, useDoc, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, orderBy, limit } from "firebase/firestore"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { QRCodeCanvas } from "qrcode.react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  const [isQrOpen, setIsQrOpen] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const { user, isUserLoading } = useUser()
  const db = useFirestore()
  const { toast } = useToast()

  useEffect(() => {
    setMounted(true)
  }, [])
  
  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user?.uid) return null
    return doc(db, "users", user.uid)
  }, [db, user?.uid])

  const { data: profile, loading: profileLoading } = useDoc(userProfileRef)

  // OPTIMIZACIÓN: Solo traemos los últimos 50 para el dashboard para máxima velocidad
  const registrationsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "confirmations"), orderBy("createdAt", "desc"), limit(50))
  }, [db, user])

  const { data: registrations, loading: regsLoading } = useCollection(registrationsQuery)

  const registrationUrl = typeof window !== 'undefined' ? `${window.location.origin}/inscripcion` : ""

  const handleShareWhatsApp = () => {
    const message = encodeURIComponent(`⛪ *Santuario Nacional Nuestra Señora del Perpetuo Socorro*\n\n¡Hola! Te comparto el acceso para la *Inscripción Digital de Confirmación 2026*.\n\nPuedes inscribirte directamente aquí:\n${registrationUrl}\n\n_Secretaría de Catequesis_`)
    window.open(`https://wa.me/?text=${message}`, '_blank')
  }

  const handleDownloadQR = () => {
    const canvas = document.querySelector("#qr-print-area canvas") as HTMLCanvasElement
    if (canvas) {
      const url = canvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.download = "QR-Inscripcion-NSPS-2026.png"
      link.href = url
      link.click()
    }
  }

  const handleDownloadImage = async () => {
    const element = document.getElementById("qr-print-area");
    if (!element) return;
    
    setIsGeneratingPDF(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = "Poster-QR-Inscripcion-NSPS-2026.png";
      link.href = url;
      link.click();
      
      toast({ title: "Imagen Generada", description: "El poster se ha descargado correctamente." });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error al generar imagen" });
    } finally {
      setIsGeneratingPDF(false);
    }
  }

  const handleDownloadPDF = async () => {
    const element = document.getElementById("qr-print-area");
    if (!element) return;
    
    setIsGeneratingPDF(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Cartel-QR-Inscripcion-NSPS-2026.pdf`);
      
      toast({ title: "PDF Generado", description: "El cartel QR se ha descargado correctamente." });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error al generar PDF" });
    } finally {
      setIsGeneratingPDF(false);
    }
  }

  if (!mounted || isUserLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sincronizando con el Santuario...</p>
        </div>
      </div>
    )
  }

  // Estado de carga real para evitar el flash de ceros
  const isActuallyLoading = regsLoading || !registrations;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">
            Bienvenido, {profile?.firstName || "Catequista"}
          </h1>
          <p className="text-muted-foreground">Sistema de Gestión de Confirmaciones - Santuario Nacional Nuestra Señora del Perpetuo Socorro</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-primary text-primary hover:bg-primary/5 rounded-xl font-bold gap-2 h-11" onClick={() => setIsQrOpen(true)}>
            <QrCode className="h-4 w-4" /> QR Inscripción
          </Button>
          <Button asChild className="bg-primary hover:bg-primary/90 h-11 px-6 rounded-xl font-bold shadow-lg">
            <Link href="/dashboard/registration">
              <ClipboardCheck className="mr-2 h-4 w-4" /> Nueva Inscripción
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/50 shadow-sm border-l-4 border-l-primary bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">Inscritos Totales</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isActuallyLoading ? "..." : (registrations?.length || 0)}</div>
            <p className="text-[10px] text-muted-foreground">Ciclo Lectivo 2026</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm border-l-4 border-l-accent bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">1er Año</CardTitle>
            <Church className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isActuallyLoading ? "..." : (registrations?.filter(r => r.catechesisYear === "PRIMER_AÑO").length || 0)}
            </div>
            <p className="text-[10px] text-muted-foreground">Etapa de inicio</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm border-l-4 border-l-blue-500 bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">2do Año</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isActuallyLoading ? "..." : (registrations?.filter(r => r.catechesisYear === "SEGUNDO_AÑO").length || 0)}
            </div>
            <p className="text-[10px] text-muted-foreground">Candidatos al sacramento</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm border-l-4 border-l-orange-500 bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">Adultos</CardTitle>
            <User className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isActuallyLoading ? "..." : (registrations?.filter(r => r.catechesisYear === "ADULTOS").length || 0)}
            </div>
            <p className="text-[10px] text-muted-foreground">Formación intensiva</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card className="border-border/50 shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="font-headline text-lg">Últimas Inscripciones</CardTitle>
            <CardDescription>Resumen de los últimos 50 registros realizados en el sistema.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {isActuallyLoading ? (
                <div className="flex flex-col items-center justify-center p-12 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Actualizando lista...</p>
                </div>
              ) : registrations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12 italic">No hay inscripciones registradas aún.</p>
              ) : (
                registrations.map((reg) => (
                  <div key={reg.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                    <Avatar className="h-10 w-10 rounded-xl border shadow-sm">
                      <AvatarImage src={reg.photoUrl} className="object-cover" />
                      <AvatarFallback className="bg-primary/5 text-primary rounded-xl">
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900">{reg.fullName}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">
                        {reg.catechesisYear?.replace("_", " ")} • {reg.ciNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-[9px] uppercase font-bold border-primary/20 bg-primary/5 text-primary">
                        {reg.status || "RECIBIDO"}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl h-[90vh] max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0">
            <DialogTitle>Código QR de Inscripción</DialogTitle>
            <DialogDescription>Genera el cartel oficial para exhibir en el santuario.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto bg-white flex justify-center p-4">
            <div className="w-full max-w-[400px] flex flex-col items-center">
              <div 
                className="w-full bg-white flex flex-col items-center space-y-8 p-10 border-2 border-slate-100 rounded-[2.5rem] shadow-sm transform origin-top scale-[0.9] sm:scale-100" 
                id="qr-print-area"
              >
                <div className="text-center space-y-3">
                  <div className="flex flex-col items-center justify-center gap-3 mb-2">
                    <div className="bg-primary/10 p-2 rounded-xl">
                      <Church className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="font-headline font-bold text-xs uppercase tracking-tight text-slate-800 leading-tight px-4">Santuario Nacional Nuestra Señora del Perpetuo Socorro</h2>
                  </div>
                  <h3 className="text-4xl font-headline font-black text-slate-900 leading-none tracking-tighter uppercase">INSCRIBITE AQUÍ</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ciclo de Catequesis 2026</p>
                </div>

                <div className="p-6 border-4 border-primary rounded-[3rem] bg-white shadow-xl">
                  <QRCodeCanvas 
                    value={registrationUrl} 
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>

                <div className="text-center space-y-6">
                  <p className="text-[11px] font-bold text-slate-500 max-w-[250px] mx-auto italic leading-relaxed">
                    Escanea este código con la cámara de tu celular para completar el formulario digital.
                  </p>
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-px w-20 bg-slate-200"></div>
                    <p className="text-[9px] font-black text-primary uppercase tracking-[0.3em]">Secretaría de Catequesis</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t grid grid-cols-2 gap-3 shrink-0">
            <Button 
              className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black shadow-lg h-14 gap-2 transition-all active:scale-95" 
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
            >
              {isGeneratingPDF ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />} DESCARGAR PDF
            </Button>
            <Button 
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg h-14 gap-2 active:scale-95" 
              onClick={handleDownloadImage}
            >
              <MessageCircle className="h-5 w-5" /> WHATSAPP
            </Button>
            <Button 
              variant="outline" 
              className="rounded-xl font-bold h-12 col-span-1" 
              onClick={() => setIsQrOpen(false)}
            >
              Cerrar
            </Button>
            <Button 
              variant="secondary"
              className="rounded-xl font-bold h-12 gap-2" 
              onClick={handleDownloadQR}
            >
              <Download className="h-4 w-4" /> Imagen PNG
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
