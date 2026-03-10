
"use client"

import { useState, useMemo, useEffect } from "react"
import { Bell, Cake, FileWarning, AlertTriangle, ChevronRight, Loader2, Info, UserCheck, Clock, ShieldCheck, Settings2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, where, limit } from "firebase/firestore"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

export function NotificationBell() {
  const [mounted, setMounted] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default')
  
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      setPermissionStatus('Notification' in window ? Notification.permission : 'unsupported')
    }
  }, [])

  // OPTIMIZACIÓN CRÍTICA: No descargar toda la colección. 
  // Solo buscamos alumnos con inasistencias críticas (>= 3)
  const alertQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "confirmations"), where("absenceCount", ">=", 3), limit(20))
  }, [db, user])

  const { data: alerts, loading: loadingAlerts } = useCollection(alertQuery)

  // Consultar personal online para cumpleaños (limitado a 50)
  const usersQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "users"), limit(50))
  }, [db, user])

  const { data: catechists, loading: loadingUsers } = useCollection(usersQuery)

  useEffect(() => {
    if (!mounted) return

    const items: any[] = []
    const today = new Date()
    const getMonthDay = (date: Date) => `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const todayMD = getMonthDay(today)

    // Alertas de inasistencia (desde la query optimizada)
    alerts?.forEach(reg => {
      items.push({
        id: `abs-${reg.id}`,
        title: "Alerta de Inasistencia",
        description: `${reg.fullName} acumuló ${reg.absenceCount} ausencias.`,
        href: "/dashboard/attendance-control",
        icon: AlertTriangle,
        color: "text-red-500",
        bgColor: "bg-red-50"
      })
    })

    // Cumpleaños de personal
    catechists?.forEach(cat => {
      if (cat.birthDate && cat.birthDate.includes(`-${todayMD}`)) {
        items.push({
          id: `cat-bday-${cat.id}`,
          title: "Cumpleaños de Colega",
          description: `Hoy cumple ${cat.firstName} ${cat.lastName}.`,
          href: "/dashboard/admin/users",
          icon: UserCheck,
          color: "text-purple-500",
          bgColor: "bg-purple-50"
        })
      }
    })

    setNotifications(items)
  }, [alerts, catechists, mounted])

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const permission = await Notification.requestPermission()
    setPermissionStatus(permission)
    if (permission === 'granted') {
      toast({ title: "¡Notificaciones activadas!" })
    }
  }

  if (!mounted || !user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-slate-100">
          <Bell className="h-5 w-5 text-slate-500" />
          {notifications.length > 0 && (
            <span className="absolute top-2 right-2 h-4 w-4 bg-accent text-[8px] font-black text-white rounded-full border-2 border-white flex items-center justify-center">
              {notifications.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[350px] p-0 rounded-2xl shadow-2xl border-none overflow-hidden">
        <DropdownMenuLabel className="p-4 bg-slate-50/80 flex items-center justify-between border-b">
          <span className="font-bold text-slate-900 uppercase text-[10px] tracking-widest">Avisos del Sistema</span>
          {(loadingAlerts || loadingUsers) && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
        </DropdownMenuLabel>

        {permissionStatus === 'default' && (
          <div className="p-4 bg-primary/5 border-b text-center">
            <p className="text-[10px] text-slate-600 mb-2">Habilita alertas en este equipo</p>
            <Button size="sm" className="h-7 rounded-lg text-[9px] font-black" onClick={handleRequestPermission}>ACTIVAR</Button>
          </div>
        )}

        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-12 text-center text-slate-400 italic text-xs">Sin avisos pendientes.</div>
          ) : (
            <div className="py-2">
              {notifications.map((n) => (
                <DropdownMenuItem key={n.id} asChild>
                  <Link href={n.href} className="flex items-start gap-4 p-4 cursor-pointer hover:bg-slate-50 border-b last:border-0 border-slate-50 transition-colors">
                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", n.bgColor)}>
                      <n.icon className={cn("h-5 w-5", n.color)} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{n.title}</p>
                      <p className="text-[11px] text-slate-500 leading-tight font-medium">{n.description}</p>
                    </div>
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
