
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
import { collection } from "firebase/firestore"
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
      if (!('Notification' in window)) {
        setPermissionStatus('unsupported')
      } else {
        setPermissionStatus(Notification.permission)
      }
    }
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

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    try {
      const permission = await Notification.requestPermission()
      setPermissionStatus(permission)
      
      if (permission === 'granted') {
        toast({
          title: "¡Notificaciones activadas!",
          description: "Este dispositivo ahora recibirá alertas institucionales."
        })
        new Notification("Santuario Nacional NSPS", {
          body: "Las notificaciones han sido configuradas correctamente en este dispositivo.",
          icon: "/icon.png"
        })
      } else if (permission === 'denied') {
        toast({
          variant: "destructive",
          title: "Acceso denegado",
          description: "Debes habilitar las notificaciones desde la configuración de tu navegador."
        })
      }
    } catch (error) {
      console.error("Error al solicitar permisos:", error)
    }
  }

  useEffect(() => {
    if (!mounted || !registrations) {
      setNotifications([])
      return
    }

    const items: any[] = []
    const today = new Date()
    
    const getMonthDay = (date: Date) => `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const todayMD = getMonthDay(today)
    
    const inThreeDays = new Date()
    inThreeDays.setDate(today.getDate() + 3)
    const inThreeDaysMD = getMonthDay(inThreeDays)

    registrations.filter(r => !r.isArchived).forEach(reg => {
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
            description: `${reg.fullName} cumple años pronto.`,
            href: "/dashboard/registrations",
            icon: Clock,
            color: "text-blue-500",
            bgColor: "bg-blue-50"
          })
        }
      }
    })

    catechists?.forEach(cat => {
      if (cat.birthDate && cat.birthDate.includes(`-${todayMD}`)) {
        items.push({
          id: `cat-bday-now-${cat.id}`,
          type: "BIRTHDAY_CAT",
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
  }, [registrations, catechists, mounted])

  useEffect(() => {
    if (mounted && typeof window !== 'undefined' && 'Notification' in window && notifications.length > 0) {
      try {
        if (window.Notification.permission === 'granted') {
          notifications.forEach(n => {
            if (n.type === 'BIRTHDAY' || n.type === 'ABSENCE') {
              const key = `sys-notif-${n.id}-${new Date().toISOString().split('T')[0]}`;
              if (!localStorage.getItem(key)) {
                new window.Notification(n.title, { body: n.description, icon: '/icon.png' });
                localStorage.setItem(key, 'true');
              }
            }
          });
        }
      } catch (e) {
        console.warn("Notificación nativa omitida por restricciones del navegador.");
      }
    }
  }, [notifications, mounted]);

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
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">Notificaciones</span>
            <Badge variant="outline" className="bg-white text-[10px]">{notifications.length}</Badge>
          </div>
          {(loadingRegs || loadingUsers) && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
        </DropdownMenuLabel>

        {/* SECCIÓN DE CONFIGURACIÓN DE DISPOSITIVO */}
        {permissionStatus !== 'granted' && permissionStatus !== 'unsupported' && (
          <div className="p-4 bg-primary/5 border-b">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Settings2 className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest leading-none">Configuración de Alertas</p>
                <p className="text-[11px] text-slate-600 leading-tight">¿Deseas recibir notificaciones de la app en este dispositivo?</p>
                {permissionStatus === 'default' ? (
                  <Button 
                    size="sm" 
                    className="h-8 rounded-lg bg-primary hover:bg-primary/90 text-[10px] font-black w-full"
                    onClick={handleRequestPermission}
                  >
                    ACTIVAR NOTIFICACIONES
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 text-[9px] text-red-500 font-bold bg-white p-2 rounded-lg border border-red-100 italic">
                    <XCircle className="h-3 w-3" /> Notificaciones bloqueadas en el navegador
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <ScrollArea className="h-[350px]">
          {notifications.length === 0 ? (
            <div className="p-12 text-center">
              <Info className="h-6 w-6 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400 italic">No hay alertas institucionales.</p>
            </div>
          ) : (
            <div className="py-2">
              {notifications.map((n) => (
                <DropdownMenuItem key={n.id} asChild>
                  <Link href={n.href} className="flex items-start gap-4 p-4 cursor-pointer hover:bg-slate-50 border-b last:border-0 border-slate-50">
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
        <div className="p-3 bg-slate-50/50 flex items-center justify-between px-4 border-t">
          <p className="text-[9px] font-bold text-slate-400 uppercase">Santuario Nacional NSPS</p>
          {permissionStatus === 'granted' && (
            <div className="flex items-center gap-1 text-[8px] font-black text-green-600 uppercase">
              <ShieldCheck className="h-2.5 w-2.5" /> Dispositivo Vinculado
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
