
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, User, Globe, ShieldCheck, Clock, Circle, Activity, History, Calendar } from "lucide-react"
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
    if (!mounted) return false
    if (currentUser && user.id === currentUser.uid) return true
    if (user.status !== "online") return false
    if (!user.lastSeen) return false
    const lastSeenDate = user.lastSeen.toDate ? user.lastSeen.toDate() : new Date(user.lastSeen)
    const now = new Date()
    const diffInSeconds = Math.abs((now.getTime() - lastSeenDate.getTime()) / 1000)
    return diffInSeconds < 900 
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

  const recentUsers = useMemo(() => {
    if (!users || !mounted) return []
    return users
      .filter(u => !isOnline(u))
      .sort((a, b) => {
        const dateA = a.lastSeen?.toDate ? a.lastSeen.toDate() : new Date(a.lastSeen || 0)
        const dateB = b.lastSeen?.toDate ? b.lastSeen.toDate() : new Date(b.lastSeen || 0)
        return dateB.getTime() - dateA.getTime()
      })
      .slice(0, 15)
  }, [users, mounted])

  const getUserLastAction = (userId: string) => {
    if (!auditLogs) return null
    return auditLogs.find(log => log.userId === userId)
  }

  const formatTimestamp = (ts: any) => {
    if (!ts || !mounted) return "N/A"
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts)
      if (isNaN(date.getTime())) return "N/A"
      return date.toLocaleString('es-PY', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: 'America/Asuncion'
      })
    } catch (e) { return "N/A" }
  }

  const formatDistance = (ts: any) => {
    if (!ts || !mounted) return "---"
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts)
      return formatDistanceToNow(date, { addSuffix: true, locale: es })
    } catch (e) { return "hace un momento" }
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Monitoreo de Conexiones</h1>
          <p className="text-muted-foreground">Supervisa el estado de actividad de los catequistas.</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-bold text-slate-700">{onlineUsers.length} Activos</span>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <Card className="border-none shadow-xl bg-white overflow-hidden">
          <CardHeader className="bg-primary text-white p-6"><CardTitle className="text-lg">Sesiones Activas</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loading ? (<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) : onlineUsers.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground italic">No hay catequistas conectados.</div>
            ) : (
              <Table><TableHeader><TableRow className="bg-slate-50/50"><TableHead className="font-bold">Usuario</TableHead><TableHead className="font-bold">Rol</TableHead><TableHead className="font-bold">Actividad</TableHead><TableHead className="text-right pr-8 font-bold">Estado</TableHead></TableRow></TableHeader><TableBody>
                  {onlineUsers.map((u: any) => (
                    <TableRow key={u.id} className="h-20 transition-colors">
                      <TableCell><div className="flex items-center gap-3"><Avatar className="h-10 w-10 border"><AvatarImage src={u.photoUrl || undefined} /><AvatarFallback><User /></AvatarFallback></Avatar><div><p className="font-bold text-sm">{u.firstName} {u.lastName}</p><p className="text-[10px] text-slate-500">{u.email}</p></div></div></TableCell>
                      <TableCell><Badge variant="outline" className="text-[9px] uppercase">{u.role}</Badge></TableCell>
                      <TableCell><div className="flex flex-col"><div className="flex items-center gap-1.5 text-xs font-bold"><Calendar className="h-3 w-3" /> {formatTimestamp(u.lastSeen)}</div><span className="text-[9px] text-slate-400">({formatDistance(u.lastSeen)})</span></div></TableCell>
                      <TableCell className="text-right pr-8"><Badge className="bg-green-500 gap-1.5 h-6"><Circle className="h-2 w-2 fill-white animate-pulse" /> En Línea</Badge></TableCell>
                    </TableRow>
                  ))}
              </TableBody></Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
