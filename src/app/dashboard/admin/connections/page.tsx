
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, User, Globe, ShieldCheck, Clock, Circle } from "lucide-react"
import { useFirestore, useCollection } from "@/firebase"
import { collection } from "firebase/firestore"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

export default function ConnectionsMonitorPage() {
  const [mounted, setMounted] = useState(false)
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const usersQuery = useMemo(() => {
    if (!db) return null
    return collection(db, "users")
  }, [db])

  const { data: users, loading } = useCollection(usersQuery)

  const isOnline = (user: any) => {
    if (user.status !== "online") return false
    if (!user.lastSeen) return false
    
    // Usamos una ventana de tiempo más amplia (5 minutos) para evitar falsos offline por desincronización de reloj
    const lastSeenDate = user.lastSeen.toDate ? user.lastSeen.toDate() : new Date(user.lastSeen)
    const diff = (new Date().getTime() - lastSeenDate.getTime()) / 1000
    return Math.abs(diff) < 300 
  }

  const onlineUsers = useMemo(() => {
    if (!users) return []
    return users.filter(u => isOnline(u))
  }, [users])

  const recentUsers = useMemo(() => {
    if (!users) return []
    return users
      .filter(u => !isOnline(u))
      .sort((a, b) => {
        const dateA = a.lastSeen?.toDate ? a.lastSeen.toDate() : new Date(a.lastSeen || 0)
        const dateB = b.lastSeen?.toDate ? b.lastSeen.toDate() : new Date(b.lastSeen || 0)
        return dateB.getTime() - dateA.getTime()
      })
      .slice(0, 15)
  }, [users])

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Monitoreo de Conexiones</h1>
          <p className="text-muted-foreground">Supervisa el estado de actividad de los catequistas en tiempo real.</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-bold text-slate-700">{onlineUsers.length} Activos ahora</span>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* TABLA DE ACTIVOS */}
        <Card className="border-none shadow-xl bg-white overflow-hidden">
          <CardHeader className="bg-primary text-white p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg"><Globe className="h-5 w-5" /></div>
              <div>
                <CardTitle className="text-lg">Sesiones Activas</CardTitle>
                <CardDescription className="text-white/70">Personal que se encuentra navegando el sistema en este momento.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : onlineUsers.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground italic">No hay catequistas conectados en este momento.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="font-bold">Usuario</TableHead>
                    <TableHead className="font-bold">Rol</TableHead>
                    <TableHead className="font-bold">Estado</TableHead>
                    <TableHead className="text-right pr-8 font-bold">Actividad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onlineUsers.map((u: any) => (
                    <TableRow key={u.id} className="hover:bg-slate-50/30 h-16">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border shadow-sm">
                            <AvatarImage src={u.photoUrl || undefined} className="object-cover" />
                            <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-slate-900">{u.firstName} {u.lastName}</span>
                            <span className="text-[10px] text-slate-500">{u.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]"><ShieldCheck className="h-3 w-3 mr-1" /> {u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-500 hover:bg-green-600 gap-1.5 h-6">
                          <Circle className="h-2 w-2 fill-white border-none" /> En Línea
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-8 text-xs font-bold text-green-600">
                        Activo ahora
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* LISTA DE RECIENTES DEBAJO */}
        <Card className="border-none shadow-xl bg-white overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg"><Clock className="h-5 w-5 text-orange-500" /></div>
              <div>
                <CardTitle className="text-lg">Últimas Conexiones</CardTitle>
                <CardDescription>Historial de actividad de los catequistas que cerraron sesión recientemente.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-10">No hay registros de actividad previa disponible.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentUsers.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-orange-200 transition-all group">
                    <Avatar className="h-12 w-12 grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all border-2 border-white shadow-sm">
                      <AvatarImage src={u.photoUrl || undefined} className="object-cover" />
                      <AvatarFallback><User className="h-6 w-6 text-slate-300" /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{u.firstName} {u.lastName}</p>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                        {u.lastSeen ? `Visto ${formatDistanceToNow(u.lastSeen.toDate ? u.lastSeen.toDate() : new Date(u.lastSeen), { addSuffix: true, locale: es })}` : "Sin actividad registrada"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
