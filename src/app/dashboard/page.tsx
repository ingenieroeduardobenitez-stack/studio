
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Clock, AlertTriangle, FileText, ArrowUpRight, Loader2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useUser, useDoc, useFirestore } from "@/firebase"
import { doc } from "firebase/firestore"
import { useMemo } from "react"

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser()
  const db = useFirestore()
  
  const userProfileRef = useMemo(() => {
    if (!db || !user?.uid) return null
    return doc(db, "users", user.uid)
  }, [db, user?.uid])

  const { data: profile, loading: profileLoading } = useDoc(userProfileRef)

  if (userLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold text-primary">
          Bienvenido de nuevo, {profile?.firstName || "Usuario"}
        </h1>
        <p className="text-muted-foreground">Aquí tienes un resumen de tu estado de registro NSPS.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado</CardTitle>
            <Clock className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">En progreso</div>
            <p className="text-xs text-muted-foreground">Finalización estimada: 2 días</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Siguiente Acción</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Registro</div>
            <p className="text-xs text-muted-foreground">Se requieren detalles del formulario</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documentos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2 / 3</div>
            <p className="text-xs text-muted-foreground">Identidad verificada</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Sin problemas pendientes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="font-headline">Actualizaciones Recientes</CardTitle>
            <CardDescription>Últimas acciones en tu perfil</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Documento ID-Verificacion.pdf subido</p>
                    <p className="text-xs text-muted-foreground">Hace {i * 2} horas</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 border-border/50 shadow-sm bg-primary text-white">
          <CardHeader>
            <CardTitle className="font-headline">Acciones Rápidas</CardTitle>
            <CardDescription className="text-primary-foreground/70">Finaliza tu configuración hoy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">Completa tu formulario de registro NSPS para activar el proceso automático de confirmación de estado.</p>
            <Button asChild className="w-full bg-accent hover:bg-accent/90 border-none shadow-lg">
              <Link href="/dashboard/registration">Comenzar Formulario</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
