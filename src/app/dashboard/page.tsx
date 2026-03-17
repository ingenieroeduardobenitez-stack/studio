
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClipboardCheck, Users, Calendar, Loader2, Church, User, QrCode, FileText, Printer, ChevronRight } from "lucide-react"
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { doc, collection, query, where } from "firebase/firestore"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { QRCodeCanvas } from "qrcode.react"
import Image from "next/image"
import { cn } from "@/lib/utils"

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  const [isQrOpen, setIsQrOpen] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  
  const { user, isUserLoading } = useUser()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])
  
  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user?.uid) return null
    return doc(db, "users", user.uid)
  }, [db, user?.uid])

  const { data: profile } = useDoc(userProfileRef)

  // Recuperar todos los confirmandos activos para cálculo de estadísticas en tiempo real
  const regsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "confirmations"), where("isArchived", "==", false))
  }, [db])

  const { data: registrations, loading: loadingRegs } = useCollection(regsQuery)

  const stats = useMemo(() => {
    if (!registrations) return { total: 0, firstYear: 0, secondYear: 0, adults: 0, firstYearSabado: 0, firstYearDomingo: 0, secondYearSabado: 0, secondYearDomingo: 0, adultsSabado: 0, adultsDomingo: 0 }
    
    const s = { total: 0, firstYear: 0, secondYear: 0, adults: 0, firstYearSabado: 0, firstYearDomingo: 0, secondYearSabado: 0, secondYearDomingo: 0, adultsSabado: 0, adultsDomingo: 0 }
    
    registrations.forEach(reg => {
      s.total++
      if (reg.catechesisYear === "PRIMER_AÑO") {
        s.firstYear++
        if (reg.attendanceDay === "SABADO") s.firstYearSabado++; else s.firstYearDomingo++;
      } else if (reg.catechesisYear === "SEGUNDO_AÑO") {
        s.secondYear++
        if (reg.attendanceDay === "SABADO") s.secondYearSabado++; else s.secondYearDomingo++;
      } else if (reg.catechesisYear === "ADULTOS") {
        s.adults++
        if (reg.attendanceDay === "SABADO") s.adultsSabado++; else s.adultsDomingo++;
      }
    })
    return s
  }, [registrations])

  const registrationUrl = typeof window !== 'undefined' ? `${window.location.origin}/inscripcion` : ""

  if (!mounted || isUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sincronizando...</p>
        </div>
      </div>
    )
  }

  const isAdmin = profile?.role === "Administrador"

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">
            ¡Hola, {profile?.firstName || "Catequista"}!
          </h1>
          <p className="text-muted-foreground">Panel de Control Institucional NSPS</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <Button asChild className="bg-primary hover:bg-primary/90 h-11 px-6 rounded-xl font-bold shadow-lg">
            <Link href="/dashboard/registration" prefetch={false}>
              <ClipboardCheck className="mr-2 h-4 w-4" /> Nueva Inscripción
            </Link>
          </Button>
          
          <Button variant="outline" className="border-primary text-primary hover:bg-primary/5 rounded-xl font-bold gap-2 h-11" onClick={() => setIsQrOpen(true)}>
            <QrCode className="h-4 w-4" /> QR
          </Button>
          
          {isAdmin && (
            <Button variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold gap-2 h-11" onClick={() => setIsReportOpen(true)}>
              <FileText className="h-4 w-4" /> Informe
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <DashboardStatCard title="Inscritos Totales" value={stats.total} icon={<Users className="h-3.5 w-3.5" />} color="primary" loading={loadingRegs} />
        <DashboardStatCard title="1er Año" value={stats.firstYear} icon={<Church className="h-3.5 w-3.5" />} color="accent" loading={loadingRegs} />
        <DashboardStatCard title="2do Año" value={stats.secondYear} icon={<Calendar className="h-3.5 w-3.5" />} color="blue" loading={loadingRegs} />
        <DashboardStatCard title="Adultos" value={stats.adults} icon={<User className="h-3.5 w-3.5" />} color="orange" loading={loadingRegs} />
      </div>

      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl h-[90vh] max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0">
            <DialogTitle>Código QR de Inscripción</DialogTitle>
            <DialogDescription>Genera el cartel oficial para exhibir en el santuario.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-white flex justify-center p-4">
            <div className="w-full max-w-[400px] flex flex-col items-center">
              <div className="w-full bg-white flex flex-col items-center space-y-8 p-10 border-2 border-slate-100 rounded-[2.5rem] shadow-sm transform origin-top scale-[0.9] sm:scale-100" id="qr-print-area">
                <div className="text-center space-y-3">
                  <div className="flex flex-col items-center justify-center gap-3 mb-2">
                    <div className="bg-primary/10 p-2 rounded-xl"><Church className="h-6 w-6 text-primary" /></div>
                    <span className="font-headline font-bold text-xs uppercase tracking-tight text-slate-800 leading-tight px-4 block text-center">Santuario Nacional Nuestra Señora del Perpetuo Socorro</span>
                  </div>
                  <h3 className="text-4xl font-headline font-black text-slate-900 leading-none tracking-tighter uppercase">INSCRIBITE AQUÍ</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ciclo de Catequesis 2026</p>
                </div>
                <div className="p-6 border-4 border-primary rounded-[3rem] bg-white shadow-xl">
                  <QRCodeCanvas value={registrationUrl} size={200} level="H" includeMargin={true} />
                </div>
                <div className="text-center space-y-6">
                  <p className="text-[11px] font-bold text-slate-500 max-w-[250px] mx-auto italic leading-relaxed">Escanea este código con la cámara de tu celular para completar el formulario digital.</p>
                  <div className="flex flex-col items-center gap-3"><div className="h-px w-20 bg-slate-200"></div><p className="text-[9px] font-black text-primary uppercase tracking-[0.3em]">Secretaría de Catequesis</p></div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t grid grid-cols-2 gap-3 shrink-0">
            <Button className="rounded-xl bg-slate-900 hover:bg-black text-white font-black shadow-lg h-14 gap-2" onClick={() => window.print()}>IMPRIMIR</Button>
            <Button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg h-14 gap-2" asChild>
              <a href={`https://wa.me/?text=${encodeURIComponent('Hola! Te comparto el link de inscripción: ' + registrationUrl)}`} target="_blank">WHATSAPP</a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="sm:max-w-[850px] p-0 overflow-hidden border-none shadow-2xl bg-white rounded-3xl h-[95vh] max-h-[95vh] flex flex-col">
          <DialogHeader className="p-4 bg-slate-50 border-b no-print shrink-0">
            <DialogTitle className="text-xs font-black uppercase text-slate-400 tracking-widest text-center">Vista Previa de Informe Ejecutivo</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-8 bg-slate-100 no-print flex justify-center">
            <div className="bg-white shadow-2xl origin-top scale-[0.8]">
              <ExecutiveReportContent stats={stats} profile={profile} />
            </div>
          </div>
          <div className="hidden print:block"><ExecutiveReportContent stats={stats} profile={profile} /></div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3 no-print shrink-0">
            <Button variant="outline" className="flex-1 rounded-xl font-bold h-12" onClick={() => setIsReportOpen(false)}>Cerrar</Button>
            <Button className="flex-1 bg-primary text-white rounded-xl font-bold gap-2 shadow-lg h-12" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir Informe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DashboardStatCard({ title, value, icon, color, loading }: any) {
  const colorClasses = {
    primary: "border-l-primary",
    accent: "border-l-accent",
    blue: "border-l-blue-500",
    orange: "border-l-orange-500"
  }
  const iconColors = {
    primary: "text-primary",
    accent: "text-accent",
    blue: "text-blue-500",
    orange: "text-orange-500"
  }
  return (
    <Card className={cn("border-none shadow-sm bg-white border-l-4 overflow-hidden", colorClasses[color as keyof typeof colorClasses])}>
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4 space-y-0">
        <CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">{title}</CardTitle>
        <div className={cn("opacity-50", iconColors[color as keyof typeof iconColors])}>{icon}</div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-2xl font-black text-slate-900">{loading ? "..." : value}</div>
        <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">Confirmados</p>
      </CardContent>
    </Card>
  )
}

function ExecutiveReportContent({ stats, profile }: { stats: any, profile: any }) {
  const currentDate = new Date().toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' });
  const reporterName = profile ? `${profile.firstName} ${profile.lastName}`.toUpperCase() : "SECRETARÍA ADMINISTRATIVA";
  return (
    <div id="executive-report" className="bg-white p-10 text-slate-900 w-[794px] h-auto min-h-[1050px] mx-auto border-[1px] border-slate-200 relative font-body">
      <div className="flex items-center justify-between border-b-2 border-primary pb-6 mb-6">
        <div className="relative h-20 w-20"><Image src="/logo.png" fill alt="Logo" className="object-contain p-1" /></div>
        <div className="text-right">
          <h2 className="text-lg font-black text-primary leading-tight">SANTUARIO NACIONAL</h2>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Nuestra Señora del Perpetuo Socorro</p>
          <div className="h-1 w-16 bg-accent ml-auto mt-1"></div>
        </div>
      </div>
      <div className="text-center mb-8 space-y-1">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Informe Ejecutivo de Inscripciones</h1>
        <p className="text-base font-bold text-primary italic">Confirmación Juvenil - Ciclo Lectivo 2026</p>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] pt-2">Estado de Situación al {currentDate}</p>
      </div>
      <div className="space-y-8">
        <div className="space-y-3">
          <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.2em] border-l-4 border-primary pl-3">1. Resumen de Postulantes</h3>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-slate-50"><th className="p-3 text-[9px] font-black uppercase text-slate-500 tracking-widest border-b">Categoría / Nivel</th><th className="p-3 text-[9px] font-black uppercase text-slate-500 tracking-widest text-right border-b">Inscritos</th></tr></thead>
              <tbody className="text-xs font-medium text-slate-700">
                <tr className="bg-slate-50/30"><td className="p-3 font-black text-slate-900">CATEQUESIS DE PRIMER AÑO</td><td className="p-3 text-right font-black text-slate-900">{stats.firstYear}</td></tr>
                <tr className="bg-slate-50/30"><td className="p-3 font-black text-slate-900">CATEQUESIS DE SEGUNDO AÑO</td><td className="p-3 text-right font-black text-slate-900">{stats.secondYear}</td></tr>
                <tr className="bg-slate-50/30"><td className="p-3 font-black text-slate-900">CURSO PARA ADULTOS</td><td className="p-3 text-right font-black text-slate-900">{stats.adults}</td></tr>
                <tr className="bg-primary/5"><td className="p-4 text-sm font-black text-primary uppercase">Total Registrado</td><td className="p-4 text-right text-2xl font-black text-primary">{stats.total}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="mt-20 grid grid-cols-3 gap-6 text-center">
        <div className="space-y-2"><div className="h-px bg-slate-300"></div><p className="text-[9px] font-black uppercase">{reporterName}</p></div>
        <div className="space-y-2"><div className="h-px bg-slate-300"></div><p className="text-[9px] font-black uppercase">FLAVIA TUCUNA</p></div>
        <div className="space-y-2"><div className="h-px bg-slate-300"></div><p className="text-[9px] font-black uppercase">CARLONGO BENITEZ</p></div>
      </div>
    </div>
  )
}
