
"use client"

import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { Menu } from "lucide-react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { UserNav } from "@/components/user-nav"
import { NotificationBell } from "@/components/notification-bell"
import { useEffect, useRef } from "react"
import { useUser, useFirestore } from "@/firebase"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useUser()
  const db = useFirestore()
  const presenceInterval = useRef<NodeJS.Timeout | null>(null)

  // Sistema de Presencia (Heartbeat) Robusto
  useEffect(() => {
    if (!db || !user?.uid) return

    const userRef = doc(db, "users", user.uid)
    
    const updatePresence = (status: "online" | "offline") => {
      // Usamos updateDoc sin await para ejecución inmediata y optimismo UI
      updateDoc(userRef, {
        status: status,
        lastSeen: serverTimestamp()
      }).catch(() => {
        // Silencio en caso de error para no interrumpir la navegación
      })
    }

    // Marcar como online inmediatamente al entrar
    updatePresence("online")

    // Intervalo de pulso frecuente (cada 15 segundos) para mantener la sesión viva
    presenceInterval.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updatePresence("online")
      }
    }, 15000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updatePresence("online")
      }
    }

    const handleFocus = () => {
      updatePresence("online")
    }

    window.addEventListener("focus", handleFocus)
    window.addEventListener("beforeunload", () => updatePresence("offline"))
    document.addEventListener("visibilitychange", handleVisibilityChange)
    
    return () => {
      if (presenceInterval.current) clearInterval(presenceInterval.current)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [db, user?.uid])

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen bg-slate-50/50 w-full relative">
        <DashboardSidebar />
        
        {/* Botón de Menú Circular Flotante */}
        <div className="fixed top-4 left-4 z-50">
          <SidebarTrigger className="h-12 w-12 rounded-full border border-slate-200 bg-white shadow-xl hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-all duration-300 active:scale-95">
            <Menu className="h-6 w-6" />
          </SidebarTrigger>
        </div>

        <SidebarInset className="flex flex-col min-w-0 bg-transparent">
          <header className="h-16 bg-white/80 backdrop-blur-md border-b px-6 flex items-center justify-between sticky top-0 z-30 ml-0">
            <div className="flex items-center gap-4 pl-14">
              <div className="h-6 w-px bg-border hidden sm:block"></div>
              <h2 className="text-sm font-bold text-slate-600 hidden sm:block uppercase tracking-widest">SISTEMA DE GESTIÓN CONFIRMACIÓN JUVENIL</h2>
            </div>
            <div className="flex items-center gap-6">
              <NotificationBell />
              <UserNav />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
