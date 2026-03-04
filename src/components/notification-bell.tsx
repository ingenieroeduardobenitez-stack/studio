
"use client"

import { useState, useMemo, useEffect } from "react"
import { Bell, Cake, FileWarning, AlertTriangle, ChevronRight, Loader2, Info, UserCheck } from "lucide-react"
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
import { collection } from "firebase/firestore"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function NotificationBell() {
  const [mounted, setMounted] = useState(false)
  const { user } = useUser()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const regsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "confirmations")
  }, [db, user])

  const usersQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "users")
  }, [db, user])

  const { data: registrations, loading: loadingRegs } = useCollection(regsQuery)
  const { data: catechists, loading: loadingUsers } = useCollection(usersQuery)

  const notifications = useMemo(() => {
    if (!registrations) return []
    const items: any[] = []
    const today = new Date()
    
    // Función para obtener mes-día (MM-DD) para comparaciones de cumpleaños
    const getMonthDay = (date: Date) => `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    
    const todayMD = getMonthDay(today)
    
    // Fecha de dentro de 3 días
    const inThreeDays = new Date()
    inThreeDays.setDate(today.getDate() + 3)
    const inThreeDaysMD = getMonthDay(inThreeDays)

    // 1. Notificaciones de Confirmandos
    registrations.filter(r => !r.isArchived).forEach(reg => {
      // Alertas de inasistencia
      if ((reg.absenceCount || 0) >= 3) {
        items.push({
          id: `abs-${reg.id}`,
          type: "ABSENCE",
          title: "Alerta de Inasistencia",
          description: `${reg.fullName} acumuló ${reg.absenceCount} ausencias.`,
          href: "/dashboard/attendance-control",
          icon: AlertTriangle,
          color: "text-red-500",
          bgColor: "bg-red-50"
        })
      }

      // Documentación pendiente
      const needsCert = reg.hasBaptism && !reg.baptismCertificatePhotoUrl
      if (needsCert || !reg.hasBaptism || !reg.hasFirstCommunion) {
        items.push({
          id: `doc-${reg.id}`,
          type: "DOCUMENT",
          title: "Documento Pendiente",
          description: `${reg.fullName} tiene sacramentos/fotos pendientes.`,
          href: "/dashboard/documentation",
          icon: FileWarning,
          color: "text-orange-500",
          bgColor: "bg-orange-50"
        })
      }

      // CUMPLEAÑOS CONFIRMANDOS (Hoy o en 3 días)
      if (reg.birthDate) {
        if (reg.birthDate.includes(`-${todayMD}`)) {
          items.push({
            id: `bday-now-${reg.id}`,
            type: "BIRTHDAY",
            title: "¡Cumpleaños Hoy!",
            description: `Felicita a ${reg.fullName} (Confirmando) en su día.`,
            href: "/dashboard/registrations",
            icon: Cake,
            color: "text-pink-500",
            bgColor: "bg-pink-50"
          })
        } else if (reg.birthDate.includes(`-${inThreeDaysMD}`)) {
          items.push({
            id: `bday-pre-${reg.id}`,
            type: "BIRTHDAY_PRE",
            title: "Cumpleaños en 3 días",
            description: `${reg.fullName} (Confirmando) cumple años el ${inThreeDays.toLocaleDateString('es-PY', { day: 'numeric', month: 'long' })}.`,
            href: "/dashboard/registrations",
            icon: Clock,
            color: "text-blue-500",
            bgColor: "bg-blue-50"
          })
        }
      }
    })

    // 2. Notificaciones de Catequistas (Cumpleaños)
    catechists?.forEach(cat => {
      if (cat.birthDate) {
        if (cat.birthDate.includes(`-${todayMD}`)) {
          items.push({
            id: `cat-bday-now-${cat.id}`,
            type: "BIRTHDAY_CAT",
            title: "Cumpleaños de Colega",
            description: `Hoy es el cumpleaños de ${cat.firstName} ${cat.lastName}.`,
            href: "/dashboard/admin/users",
            icon: UserCheck,
            color: "text-purple-500",
            bgColor: "bg-purple-50"
          })
        } else if (cat.birthDate.includes(`-${inThreeDaysMD}`)) {
          items.push({
            id: `cat-bday-pre-${cat.id}`,
            type: "BIRTHDAY_CAT_PRE",
            title: "Colega cumple en 3 días",
            description: `${cat.firstName} cumple años este ${inThreeDays.toLocaleDateString('es-PY', { day: 'numeric', month: 'long' })}.`,
            href: "/dashboard/admin/users",
            icon: Clock,
            color: "text-purple-400",
            bgColor: "bg-purple-50/50"
          })
        }
      }
    })

    return items
  }, [registrations, catechists])

  if (!mounted || !user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-slate-100">
          <Bell className="h-5 w-5 text-slate-500" />
          {notifications.length > 0 && (
            <span className="absolute top-2 right-2 h-4 w-4 bg-accent text-[8px] font-black text-white rounded-full border-2 border-white flex items-center justify-center animate-in zoom-in duration-300">
              {notifications.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[350px] p-0 rounded-2xl shadow-2xl border-none overflow-hidden">
        <DropdownMenuLabel className="p-4 bg-slate-50/80 flex items-center justify-between border-b">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">Notificaciones</span>
            <Badge variant="outline" className="bg-white text-[10px]">{notifications.length}</Badge>
          </div>
          {(loadingRegs || loadingUsers) && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
        </DropdownMenuLabel>
        
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <Info className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-xs text-slate-400 font-medium italic">No hay alertas institucionales por ahora.</p>
            </div>
          ) : (
            <div className="py-2">
              {notifications.map((n) => (
                <DropdownMenuItem key={n.id} asChild>
                  <Link href={n.href} className="flex items-start gap-4 p-4 cursor-pointer hover:bg-slate-50 focus:bg-slate-50 outline-none transition-colors border-b last:border-0 border-slate-50">
                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", n.bgColor)}>
                      <n.icon className={cn("h-5 w-5", n.color)} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-bold text-slate-900 uppercase tracking-tight">{n.title}</p>
                      <p className="text-[11px] text-slate-500 leading-snug">{n.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 mt-1" />
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <DropdownMenuSeparator className="m-0" />
        <div className="p-3 bg-slate-50/50 text-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none px-4">Santuario Nacional Nuestra Señora del Perpetuo Socorro</p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
