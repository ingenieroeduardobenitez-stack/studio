
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, User, Globe, ShieldCheck, Clock, Circle, Activity, History, Calendar, UserX } from "lucide-react"
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

  // Consulta de todos los usuarios del personal
  const usersQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "users")
  }, [db])

  const { data: users, loading } = useCollection(usersQuery)

  const isOnline = (user: any) => {
    if (!mounted) return false
    // Si es el usuario actual viendo la página, siempre está online
    if (currentUser && user.id === currentUser.uid) return true
    
    // Verificación de status y timestamp (margen de 5 minutos para latencia)
    if (user.status !== "online") return false
    if (!user.lastSeen) return false
    
    const lastSeenDate = user.lastSeen.toDate ? user.lastSeen.toDate() : new Date(user.lastSeen)
    const now = new Date()
    const diffInSeconds = Math.abs((now.getTime() - lastSeenDate.getTime()) / 1000)
    return diffInSeconds < 300 
  }

  const onlineUsers = useMemo(() => {
    if (!users || !mounted) return []
    return users
      .filter(u => isOnline(u))
      .sort((a, b) => {
        if (a.id === currentUser?.uid) return -1
        if (b.id === currentUser?.uid) return 1
        return 0
      })
  }, [users, currentUser, mounted])

  const offlineUsers = useMemo(() => {
    if (!users || !mounted) return []
    return users
      .filter(u => !isOnline(u))
      .sort((a, b) => {
        const dateA = a.lastSeen?.toDate ? a.lastSeen.toDate() : new Date(a.lastSeen || 0)
        const dateB = b.lastSeen?.toDate ? b.lastSeen.toDate() : new Date(b.lastSeen || 0)
        return dateB.getTime() - dateA.getTime()
      })
  }, [users, mounted])

  const formatTimestamp = (ts: any) => {
    if (!ts || !mounted) return "Sin registro"
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts)
      if (isNaN(date.getTime())) return "Sin registro"
      return date.toLocaleString('es-PY', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/Asuncion'
      })
    } catch (e) { return "N/A" }
  }

  const formatDistance = (ts: any) => {
    if (!ts || !mounted) return "Nunca"
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts)
      return formatDistanceToNow(date, { addSuffix: true, locale: es })
    } catch (e) { return "Recientemente" }
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Monitoreo de Conexiones</h1>
          <p className="text-muted-foreground font-medium">Supervisa el estado de actividad de los catequistas y coordinadores.</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border shadow-sm flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-bold text-slate-700">{onlineUsers.length} Activos ahora</span>
          </div>
          <div className="h-8 w-px bg-slate-100" />
          <div className="flex items-center gap-2 text-slate-400">
            <User className="h-4 w-4" />
            <span className="text-sm font-bold">{users?.length || 0} Total Personal</span>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* SECCIÓN 1: USUARIOS EN LÍNEA */}
        <Card className="border-none shadow-xl bg-white overflow-hidden border-t-4 border-t-green-500">
          <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5 text-green-500" /> Sesiones Activas
              </CardTitle>
              <CardDescription>Usuarios interactuando con el sistema en este momento.</CardDescription>
            </div>
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">TIEMPO REAL</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : onlineUsers.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground italic flex flex-col items-center gap-2">
                <UserX className="h-10 w-10 text-slate-200" />
                No hay otros usuarios conectados.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/30">
                    <TableHead className="font-bold pl-8">Usuario</TableHead>
                    <TableHead className="font-bold">Rol</TableHead>
                    <TableHead className="font-bold">Último Pulso</TableHead>
                    <TableHead className="text-right pr-8 font-bold">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onlineUsers.map((u: any) => (
                    <TableRow key={u.id} className="h-20 hover:bg-green-50/20 transition-colors">
                      <TableCell className="pl-8">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                            <AvatarImage src={u.photoUrl || undefined} className="object-cover" />
                            <AvatarFallback className="bg-primary/5 text-primary"><User /></AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-bold text-sm text-slate-900">{u.firstName} {u.lastName} {u.id === currentUser?.uid && <span className="text-[10px] text-primary font-black ml-1">(TÚ)</span>}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest">{u.role}</Badge></TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                            <Clock className="h-3 w-3 text-slate-400" /> {formatTimestamp(u.lastSeen)}
                          </div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase">Activo ahora</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <Badge className="bg-green-500 gap-1.5 h-7 px-3 border-none shadow-sm animate-in zoom-in-95">
                          <Circle className="h-2 w-2 fill-white animate-pulse border-none" /> EN LÍNEA
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* SECCIÓN 2: USUARIOS DESCONECTADOS */}
        <Card className="border-none shadow-xl bg-white overflow-hidden border-t-4 border-t-slate-300">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-600">
              <History className="h-5 w-5 text-slate-400" /> Historial de Actividad
            </CardTitle>
            <CardDescription>Registro de las últimas conexiones de todo el personal.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : offlineUsers.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground italic">No hay otros registros de usuarios.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/30">
                    <TableHead className="font-bold pl-8">Usuario</TableHead>
                    <TableHead className="font-bold">Rol</TableHead>
                    <TableHead className="font-bold">Última Vez Visto</TableHead>
                    <TableHead className="text-right pr-8 font-bold">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offlineUsers.map((u: any) => (
                    <TableRow key={u.id} className="h-20 hover:bg-slate-50/50 grayscale-[0.5] opacity-80 transition-all">
                      <TableCell className="pl-8">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border shadow-sm">
                            <AvatarImage src={u.photoUrl || undefined} className="object-cover" />
                            <AvatarFallback className="bg-slate-100 text-slate-400"><User /></AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-bold text-sm text-slate-700">{u.firstName} {u.lastName}</p>
                            <p className="text-[10px] text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="text-[9px] font-bold uppercase bg-slate-100 text-slate-500 border-none">{u.role}</Badge></TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                            <Calendar className="h-3 w-3" /> {formatTimestamp(u.lastSeen)}
                          </div>
                          <span className="text-[9px] text-slate-400 italic">({formatDistance(u.lastSeen)})</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <Badge variant="outline" className="text-slate-400 border-slate-200 font-bold text-[9px] uppercase h-6">Desconectado</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
