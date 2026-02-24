
"use client"

import { useState, useMemo, useEffect } from "react"
import { Bell, Cake, FileWarning, AlertTriangle, ChevronRight, Loader2, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function NotificationBell() {
  const [mounted, setMounted] = useState(false)
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const regsQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "confirmations")
  }, [db])

  const { data: registrations, loading } = useCollection(regsQuery)

  const notifications = useMemo(() => {
    if (!registrations) return []
    const items: any[] = []
    const today = new Date()
    const todayMonthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    registrations.filter(r => !r.isArchived).forEach(reg => {
      // 1. Alerta de Ausencias (3 o más)
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

      // 2. Alerta de Documentos Faltantes
      const needsCert = reg.hasBaptism && !reg.baptismCertificatePhotoUrl
      const noBaptism = !reg.hasBaptism
      const noCommunion = !reg.hasFirstCommunion

      if (needsCert || noBaptism || noCommunion) {
        let reason = ""
        if (noBaptism) reason = "Sin Bautismo"
        else if (noCommunion) reason = "Sin Comunión"
        else reason = "Falta Certificado"

        items.push({
          id: `doc-${reg.id}`,
          type: "DOCUMENT",
          title: "Documentación Pendiente",
          description: `${reg.fullName}: ${reason}`,
          href: "/dashboard/documentation",
          icon: FileWarning,
          color: "text-orange-500",
          bgColor: "bg-orange-50"
        })
      }

      // 3. Cumpleaños de hoy
      if (reg.birthDate && reg.birthDate.includes(`-${todayMonthDay}`)) {
        items.push({
          id: `bday-${reg.id}`,
          type: "BIRTHDAY",
          title: "¡Hoy es su Cumpleaños!",
          description: `Felicita a ${reg.fullName} en su día.`,
          href: "/dashboard/registrations",
          icon: Cake,
          color: "text-pink-500",
          bgColor: "bg-pink-50"
        })
      }
    })

    return items
  }, [registrations])

  if (!mounted) return null

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
          {loading && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
        </DropdownMenuLabel>
        
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <Info className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-xs text-slate-400 font-medium italic">No hay alertas pendientes por ahora.</p>
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
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Catequesis de Confirmación 2026</p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
