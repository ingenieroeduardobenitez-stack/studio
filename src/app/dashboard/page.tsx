
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ClipboardCheck, Users, Calendar, ArrowUpRight, Loader2, Church } from "lucide-react"
import { useUser, useDoc, useFirestore, useCollection } from "@/firebase"
import { doc, collection } from "firebase/firestore"
import { useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser()
  const db = useFirestore()
  
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

  if (userLoading || profileLoading) {
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
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/dashboard/registration">
            <ClipboardCheck className="mr-2 h-4 w-4" /> Nueva Inscripción
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inscritos</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{regsLoading ? "..." : registrations.length}</div>
            <p className="text-xs text-muted-foreground">Postulantes este año</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categoría Juvenil</CardTitle>
            <Church className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {regsLoading ? "..." : registrations.filter(r => r.category === "JUVENIL").length}
            </div>
            <p className="text-xs text-muted-foreground">Confirmación Jóvenes</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categoría Adultos</CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {regsLoading ? "..." : registrations.filter(r => r.category === "ADULTO").length}
            </div>
            <p className="text-xs text-muted-foreground">Confirmación Adultos</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline">Últimas Inscripciones</CardTitle>
          <CardDescription>Resumen de los últimos registros realizados.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {regsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : registrations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay inscripciones registradas aún.</p>
            ) : (
              registrations.slice(0, 5).map((reg) => (
                <div key={reg.id} className="flex items-center gap-4 p-3 border rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{reg.fullName}</p>
                    <p className="text-xs text-muted-foreground">{reg.category} • {reg.age} años</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase text-accent">{reg.status}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
