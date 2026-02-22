
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, User, Globe, ShieldCheck, Clock, Circle, Activity, History } from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, orderBy, limit } from "firebase/firestore"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

export default function ConnectionsMonitorPage() {
  const [mounted, setMounted] = useState(false)
  const { user: currentUser } = useUser()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Consulta de usuarios
  const usersQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "users")
  }, [db])

  const { data: users, loading } = useCollection(usersQuery)

  // Consulta de los últimos registros de auditoría para mapear actividad
  const auditQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(200))
  }, [db])

  const { data: auditLogs } = useCollection(auditQuery)

  const isOnline = (user: any) => {
    // Si es el usuario actual, está en línea por definición
    if (currentUser && user.id === currentUser.uid) return true
    
    // Prioridad al estado 'online' definido por el heartbeat
    if (user.status !== "online") return false
    if (!user.lastSeen) return false
    
    const lastSeenDate = user.lastSeen.toDate ? user.lastSeen.toDate() : new Date(user.lastSeen)
    const now = new Date()
    
    // Margen amplio de 15 minutos para evitar problemas de sincronización de reloj
    const diffInSeconds = Math.abs((now.getTime() - lastSeenDate.getTime()) / 1000)
    return diffInSeconds < 900 
  }

  const onlineUsers = useMemo(() => {
    if (!users) return []
    // Filtramos y aseguramos que el usuario actual siempre esté al principio si está en la lista
    return users
      .filter(u => isOnline(u))
      .sort((a, b) => {
        if (a.id === currentUser?.uid) return -1
        if (b.id === currentUser?.uid) return 1
        return 0
      })
  }, [users, currentUser])

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

  // Obtener la última acción de auditoría para un usuario específico
  const getUserLastAction = (userId: string) => {
    if (!auditLogs) return null
    return auditLogs.find(log => log.userId === userId)
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Monitoreo de Conexiones</h1>
          <p className="text-muted-foreground">Supervisa el estado de actividad y las últimas acciones de los catequistas.</p>
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
                <CardDescription className="text-white/70">Personal navegando y su última acción registrada.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : onlineUsers.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground italic flex flex-col items-center gap-3">
                <Activity className="h-10 w-10 text-slate-200" />
                No hay catequistas conectados en este momento.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="font-bold">Usuario</TableHead>
                    <TableHead className="font-bold">Rol</TableHead>
                    <TableHead className="font-bold">Última Acción Realizada</TableHead>
                    <TableHead className="text-right pr-8 font-bold">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onlineUsers.map((u: any) => {
                    const lastAction = getUserLastAction(u.id)
                    const isMe = u.id === currentUser?.uid
                    
                    return (
                      <TableRow key={u.id} className={cn("hover:bg-slate-50/30 h-20 transition-colors", isMe && "bg-green-50/30")}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar className={cn("h-10 w-10 border shadow-sm", isMe ? "ring-2 ring-primary" : "ring-2 ring-green-100")}>
                                <AvatarImage src={u.photoUrl || undefined} className="object-cover" />
                                <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                              </Avatar>
                              {isMe && (
                                <span className="absolute -top-1 -left-1 bg-primary text-white text-[7px] font-black px-1 rounded-sm shadow-sm">TÚ</span>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-slate-900">{u.firstName} {u.lastName}</span>
                              <span className="text-[10px] text-slate-500">{u.email}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[9px] uppercase tracking-tighter"><ShieldCheck className="h-3 w-3 mr-1" /> {u.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {lastAction ? (
                            <div className="flex items-start gap-2">
                              <div className="p-1.5 bg-primary/5 rounded-lg mt-0.5">
                                <History className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <div className="flex flex-col max-w-[250px]">
                                <span className="text-[10px] font-bold text-primary uppercase">{lastAction.action}</span>
                                <span className="text-[10px] text-slate-500 truncate italic" title={lastAction.details}>
                                  {lastAction.details}
                                </span>
                                <span className="text-[8px] text-slate-400">
                                  {lastAction.timestamp ? formatDistanceToNow(lastAction.timestamp.toDate ? lastAction.timestamp.toDate() : new Date(lastAction.timestamp), { addSuffix: true, locale: es }) : ''}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Sin acciones registradas hoy</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          <Badge className="bg-green-500 hover:bg-green-600 gap-1.5 h-6">
                            <Circle className="h-2 w-2 fill-white border-none animate-pulse" /> En Línea
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
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
                {recentUsers.map((u: any) => {
                  const lastAction = getUserLastAction(u.id)
                  return (
                    <div key={u.id} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-orange-200 transition-all group">
                      <Avatar className="h-12 w-12 grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all border-2 border-white shadow-sm">
                        <AvatarImage src={u.photoUrl || undefined} className="object-cover" />
                        <AvatarFallback><User className="h-6 w-6" /></AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{u.firstName} {u.lastName}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">
                          {u.lastSeen ? `Visto ${formatDistanceToNow(u.lastSeen.toDate ? u.lastSeen.toDate() : new Date(u.lastSeen), { addSuffix: true, locale: es })}` : "Sin actividad registrada"}
                        </p>
                        {lastAction && (
                          <p className="text-[8px] text-primary font-medium truncate mt-1">
                            Última acción: {lastAction.action}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
