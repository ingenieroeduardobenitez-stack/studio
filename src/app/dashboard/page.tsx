
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClipboardCheck, Users, Calendar, Loader2, Church, User, QrCode, FileText, Printer, ChevronRight } from "lucide-react"
import { useUser, useDoc, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { doc, collection, query, limit } from "firebase/firestore"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { QRCodeCanvas } from "qrcode.react"
import Image from "next/image"
import { Separator } from "@/components/ui/separator"

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

  // Consulta ultra-ligera limitada para estadísticas (Plan Blaze)
  const statsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "confirmations"), limit(500))
  }, [db, user])

  const { data: allRegs, isLoading: statsLoading } = useCollection(statsQuery)

  const stats = useMemo(() => {
    if (!allRegs) return { total: 0, firstYear: 0, secondYear: 0, adults: 0 }
    const active = allRegs.filter(r => !r.isArchived)
    return {
      total: active.length,
      firstYear: active.filter(r => r.catechesisYear === "PRIMER_AÑO").length,
      secondYear: active.filter(r => r.catechesisYear === "SEGUNDO_AÑO").length,
      adults: active.filter(r => r.catechesisYear === "ADULTOS").length
    }
  }, [allRegs])

  const registrationUrl = typeof window !== 'undefined' ? `${window.location.origin}/inscripcion` : ""

  if (!mounted || isUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sincronizando con el Santuario...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">
            ¡Hola, {profile?.firstName || "Catequista"}!
          </h1>
          <p className="text-muted-foreground">Bienvenido al Sistema de la Confirmación Juvenil NSPS</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold gap-2 h-11" onClick={() => setIsReportOpen(true)}>
            <FileText className="h-4 w-4" /> Generar Informe
          </Button>
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

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-primary overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4 space-y-0">
            <CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Inscritos Totales</CardTitle>
            <Users className="h-3.5 w-3.5 text-primary opacity-50" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-slate-900">{statsLoading ? "..." : stats.total}</div>
            <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">Sincronización ligera</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-l-4 border-l-accent overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4 space-y-0">
            <CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">1er Año</CardTitle>
            <Church className="h-3.5 w-3.5 text-accent opacity-50" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-slate-900">{statsLoading ? "..." : stats.firstYear}</div>
            <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">Total nivel inicial</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-l-4 border-l-blue-500 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4 space-y-0">
            <CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">2do Año</CardTitle>
            <Calendar className="h-3.5 w-3.5 text-blue-500 opacity-50" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-slate-900">{statsLoading ? "..." : stats.secondYear}</div>
            <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">Total nivel final</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-l-4 border-l-orange-500 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4 space-y-0">
            <CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Adultos</CardTitle>
            <User className="h-3.5 w-3.5 text-orange-500 opacity-50" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-slate-900">{statsLoading ? "..." : stats.adults}</div>
            <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">Inscripción especial</p>
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
                    <span className="font-headline font-bold text-xs uppercase tracking-tight text-slate-800 leading-tight px-4 block">Santuario Nacional Nuestra Señora del Perpetuo Socorro</span>
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
            <Button className="rounded-xl bg-slate-900 hover:bg-black text-white font-black shadow-lg h-14 gap-2" onClick={() => window.print()}>IMPRIMIR</Button>
            <Button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg h-14 gap-2" asChild>
              <a href={`https://wa.me/?text=${encodeURIComponent('Hola! Te comparto el link de inscripción: ' + registrationUrl)}`} target="_blank">WHATSAPP</a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="sm:max-w-[750px] p-0 overflow-hidden border-none shadow-2xl bg-white rounded-3xl h-[95vh] max-h-[95vh] flex flex-col">
          <DialogHeader className="p-4 bg-slate-50 border-b no-print shrink-0">
            <DialogTitle className="text-xs font-black uppercase text-slate-400 tracking-widest text-center">Vista Previa de Informe Ejecutivo</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-8 bg-slate-100 no-print flex justify-center">
            <div className="bg-white shadow-2xl origin-top scale-[0.85] mb-[-10%]">
              <ExecutiveReportContent stats={stats} profile={profile} />
            </div>
          </div>

          <div className="hidden print:block">
            <ExecutiveReportContent stats={stats} profile={profile} />
          </div>

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

function ExecutiveReportContent({ stats, profile }: { stats: any, profile: any }) {
  const currentDate = new Date().toLocaleDateString('es-PY', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const reporterName = profile ? `${profile.firstName} ${profile.lastName}`.toUpperCase() : "SECRETARÍA ADMINISTRATIVA";
  const reporterRole = profile?.role ? profile.role.toUpperCase() : "PERSONAL AUTORIZADO";

  return (
    <div id="executive-report" className="bg-white p-16 text-slate-900 w-[800px] h-auto min-h-[1050px] mx-auto border-[1px] border-slate-200 relative">
      <div className="flex items-center justify-between border-b-2 border-primary pb-8 mb-10">
        <div className="relative h-24 w-24">
          <Image src="/logo.png" fill alt="Logo" className="object-contain p-2" />
        </div>
        <div className="text-right">
          <h2 className="text-xl font-black text-primary leading-tight">SANTUARIO NACIONAL</h2>
          <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">Nuestra Señora del Perpetuo Socorro</p>
          <div className="h-1 w-20 bg-accent ml-auto mt-2"></div>
        </div>
      </div>

      <div className="text-center mb-16 space-y-2">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Informe Ejecutivo de Inscripciones</h1>
        <p className="text-lg font-bold text-primary italic">Confirmación Juvenil - Ciclo Lectivo 2026</p>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] pt-4">Estado de Situación al {currentDate}</p>
      </div>

      <div className="space-y-12">
        <div className="space-y-4">
          <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-l-4 border-primary pl-4">1. Resumen de Postulantes por Categoría</h3>
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="p-5 text-[10px] font-black uppercase text-slate-500 tracking-widest border-b">Categoría / Nivel</th>
                  <th className="p-5 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right border-b">Cantidad Inscritos</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium text-slate-700">
                <tr className="border-b last:border-0 hover:bg-slate-50/50">
                  <td className="p-5">CATEQUESIS DE PRIMER AÑO (INICIAL)</td>
                  <td className="p-5 text-right font-black text-lg">{stats.firstYear}</td>
                </tr>
                <tr className="border-b last:border-0 hover:bg-slate-50/50">
                  <td className="p-5">CATEQUESIS DE SEGUNDO AÑO (CONFIRMACIÓN)</td>
                  <td className="p-5 text-right font-black text-lg">{stats.secondYear}</td>
                </tr>
                <tr className="border-b last:border-0 hover:bg-slate-50/50">
                  <td className="p-5">CURSO INTENSIVO PARA ADULTOS</td>
                  <td className="p-5 text-right font-black text-lg">{stats.adults}</td>
                </tr>
                <tr className="bg-primary/5">
                  <td className="p-6 text-base font-black text-primary uppercase">Total de Inscripciones Registradas</td>
                  <td className="p-6 text-right text-3xl font-black text-primary">{stats.total}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4 pt-8">
          <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] border-l-4 border-primary pl-4">2. Observaciones Administrativas</h3>
          <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <p className="text-xs leading-relaxed text-slate-600 font-medium italic">
              El presente informe refleja la situación actual de los postulantes inscritos para el ciclo 2026. 
              Los datos han sido extraídos automáticamente del Sistema de Gestión de Confirmación Juvenil NSPS.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-32 grid grid-cols-2 gap-20">
        <div className="text-center space-y-4 relative">
          <div className="h-px w-full bg-slate-300"></div>
          <div className="space-y-1">
            <p className="text-xs font-black uppercase text-slate-900 leading-none">{reporterName}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{reporterRole}</p>
          </div>
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 opacity-80">
            <div className="p-1 border border-slate-100 rounded-lg bg-white shadow-sm">
              <QRCodeCanvas value={`NSPS-AUTH-GEN-${profile?.id || 'SYSTEM'}-${Date.now()}`} size={70} level="M" />
            </div>
            <p className="text-[7px] font-black text-blue-700 uppercase mt-1">Sello de Autoría</p>
          </div>
        </div>
        <div className="text-center space-y-4 relative">
          <div className="h-px w-full bg-slate-300"></div>
          <div className="space-y-1">
            <p className="text-xs font-black uppercase text-slate-900 leading-none">CARLONGO BENITEZ</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">COORDINADOR GENERAL</p>
          </div>
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 opacity-80">
            <div className="p-1 border border-slate-100 rounded-lg bg-white shadow-sm">
              <QRCodeCanvas value={`NSPS-REPORT-VAL-${Date.now()}`} size={70} level="M" />
            </div>
            <p className="text-[7px] font-black text-primary uppercase mt-1">Sello Digital</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-10 left-16 right-16 flex items-center justify-between border-t pt-4">
        <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.3em]">Documento Oficial del Santuario Nacional NSPS</p>
        <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.3em]">Página 1 de 1</p>
      </div>
    </div>
  )
}
