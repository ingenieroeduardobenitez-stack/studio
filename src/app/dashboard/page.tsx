"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { ClipboardCheck, Users, Calendar, ArrowUpRight, Loader2, Church, User, QrCode, Share2, Printer } from "lucide-react"
import { useUser, useDoc, useFirestore, useCollection } from "@/firebase"
import { doc, collection } from "firebase/firestore"
import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { QRCodeCanvas } from "qrcode.react"

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  const [isQrOpen, setIsQrOpen] = useState(false)
  const { user, loading: userLoading } = useUser()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])
  
  const userProfileRef = useMemo(() => {
    if (!db || !user?.uid) return null
    return doc(db, "users", user.uid)
  }, [db, user?.uid])

  const { data: profile, loading: profileLoading } = useDoc(userProfileRef)

  const registrationsQuery = useMemo(() => {
    if (!db) return null
    return collection(db, "confirmations")
  }, [db])

  const { data: registrations, loading: regsLoading } = useCollection(registrationsQuery)

  const registrationUrl = typeof window !== 'undefined' ? `${window.location.origin}/inscripcion` : ""

  if (!mounted || userLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">
            Bienvenido, {profile?.firstName || "Catequista"}
          </h1>
          <p className="text-muted-foreground">Sistema de Gestión de Confirmaciones - Parroquia Perpetuo Socorro</p>
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
        <Card className="border-border/50 shadow-sm border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Inscritos</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{regsLoading ? "..." : (registrations?.length || 0)}</div>
            <p className="text-[10px] text-muted-foreground">Postulantes 2026</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm border-l-4 border-l-accent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">1er Año</CardTitle>
            <Church className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {regsLoading ? "..." : (registrations?.filter(r => r.catechesisYear === "PRIMER_AÑO").length || 0)}
            </div>
            <p className="text-[10px] text-muted-foreground">Etapa de inicio</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">2do Año</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {regsLoading ? "..." : (registrations?.filter(r => r.catechesisYear === "SEGUNDO_AÑO").length || 0)}
            </div>
            <p className="text-[10px] text-muted-foreground">Candidatos al sacramento</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">Adultos</CardTitle>
            <User className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {regsLoading ? "..." : (registrations?.filter(r => r.catechesisYear === "ADULTOS").length || 0)}
            </div>
            <p className="text-[10px] text-muted-foreground">Formación intensiva</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 border-border/50 shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="font-headline text-lg">Últimas Inscripciones</CardTitle>
            <CardDescription>Resumen de los últimos registros realizados en el sistema.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {regsLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                </div>
              ) : !registrations || registrations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12 italic">No hay inscripciones registradas aún.</p>
              ) : (
                registrations.slice(0, 6).map((reg) => (
                  <div key={reg.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                    <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center border">
                      <User className="h-5 w-5 text-primary" />
                    </div>
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

        <Card className="border-none shadow-xl bg-primary text-white flex flex-col justify-between overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <QrCode className="h-32 w-32 rotate-12" />
          </div>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <Share2 className="h-5 w-5" /> Compartir Inscripción
            </CardTitle>
            <CardDescription className="text-white/80">
              Usa el código QR para que los postulantes se inscriban solos desde su celular.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6 pt-4">
            <div className="bg-white p-3 rounded-2xl shadow-lg">
              <QRCodeCanvas 
                value={registrationUrl} 
                size={140}
                level="H"
                includeMargin={false}
              />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-center">
              Escanear para inscripción 2026
            </p>
          </CardContent>
          <CardFooter className="pt-2">
            <Button className="w-full bg-white text-primary hover:bg-white/90 font-bold rounded-xl gap-2 h-11" onClick={() => setIsQrOpen(true)}>
              Ver QR e Imprimir
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* DIALOGO QR */}
      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-12 bg-white flex flex-col items-center space-y-8 print:p-8" id="qr-print-area">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Church className="h-6 w-6 text-primary" />
                <h2 className="font-headline font-bold text-xl uppercase tracking-tighter">Parroquia Perpetuo Socorro</h2>
              </div>
              <h3 className="text-3xl font-headline font-bold text-slate-900 leading-tight">INSCRIBITE AQUÍ</h3>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Ciclo de Catequesis 2026</p>
            </div>

            <div className="p-4 border-4 border-primary rounded-[2.5rem] bg-white shadow-inner">
              <QRCodeCanvas 
                value={registrationUrl} 
                size={220}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="text-center space-y-4">
              <p className="text-xs font-medium text-slate-500 max-w-[250px] mx-auto italic">
                Escanea este código con la cámara de tu celular para completar el formulario digital.
              </p>
              <div className="h-px w-20 bg-slate-200 mx-auto"></div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Secretaría de Catequesis</p>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3 print:hidden">
            <Button variant="outline" className="flex-1 rounded-xl font-bold h-12" onClick={() => setIsQrOpen(false)}>Cerrar</Button>
            <Button className="flex-1 rounded-xl bg-primary font-bold shadow-lg h-12 gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir Cartel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
