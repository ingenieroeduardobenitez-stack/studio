
"use client"

import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { Menu, Loader2 } from "lucide-react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { UserNav } from "@/components/user-nav"
import { NotificationBell } from "@/components/notification-bell"
import { useEffect, useRef } from "react"
import { useUser, useFirestore } from "@/firebase"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { useRouter } from "next/navigation"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isUserLoading } = useUser()
  const db = useFirestore()
  const router = useRouter()
  const presenceInterval = useRef<NodeJS.Timeout | null>(null)
  const lastUpdateRef = useRef<number>(0)

  // Guardia de Autenticación
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/")
    }
  }, [user, isUserLoading, router])

  // Sistema de Presencia (Heartbeat) ULTRA-CONSERVADOR
  // Solo actualiza una vez cada 5 minutos (300,000 ms) para evitar Rate Exceeded
  useEffect(() => {
    if (!db || !user?.uid) return

    const userRef = doc(db, "users", user.uid)
    
    const updatePresence = (status: "online" | "offline") => {
      const now = Date.now()
      
      // Bloqueo estricto: no más de una actualización cada 5 minutos para presencia online
      if (status === "online" && (now - lastUpdateRef.current < 300000)) {
        return
      }

      lastUpdateRef.current = now
      updateDoc(userRef, {
        status: status,
        lastSeen: serverTimestamp()
      }).catch(() => {
        // Silencio para no saturar logs si falla por cuota
      })
    }

    // Primera señal de vida al entrar
    updatePresence("online")

    // Heartbeat cada 5 minutos
    presenceInterval.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updatePresence("online")
      }
    }, 300000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updatePresence("online")
      }
    }

    window.addEventListener("beforeunload", () => updatePresence("offline"))
    document.addEventListener("visibilitychange", handleVisibilityChange)
    
    return () => {
      if (presenceInterval.current) clearInterval(presenceInterval.current)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [db, user?.uid])

  if (isUserLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sincronizando con el Santuario...</p>
        </div>
      </div>
    )
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen bg-slate-50/50 w-full relative">
        <DashboardSidebar />
        
        <div className="fixed top-4 left-4 z-50">
          <SidebarTrigger className="h-12 w-12 rounded-full border border-slate-200 bg-white shadow-xl hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-all duration-300 active:scale-95">
            <Menu className="h-6 w-6" />
          </SidebarTrigger>
        </div>

        <SidebarInset className="flex flex-col min-w-0 bg-transparent">
          <header className="h-16 bg-white/80 backdrop-blur-md border-b px-6 flex items-center justify-between sticky top-0 z-30 ml-0">
            <div className="flex items-center gap-4 pl-14">
              <div className="h-6 w-px bg-border hidden sm:block"></div>
              <h2 className="text-sm font-bold text-slate-600 hidden sm:block uppercase tracking-widest">SISTEMA DE GESTIÓN CONFIRMACIÓN</h2>
            </div>
            <div className="flex items-center gap-6">
              <NotificationBell />
              <UserNav />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8 flex flex-col">
            <div className="max-w-6xl mx-auto w-full flex-1">
              {children}
            </div>
            <footer className="max-w-6xl mx-auto w-full mt-12 pt-8 border-t border-slate-200 text-center pb-8">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                © 2026 Ing. Eduardo Benítez | Desarrollo de Software - Todos los derechos reservados.
              </p>
            </footer>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
