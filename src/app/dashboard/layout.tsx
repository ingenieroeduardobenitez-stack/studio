"use client"

import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { Menu, Loader2 } from "lucide-react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { UserNav } from "@/components/user-nav"
import { NotificationBell } from "@/components/notification-bell"
import { useEffect } from "react"
import { useUser } from "@/firebase"
import { useRouter } from "next/navigation"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser()
  const router = useRouter()

  // Guardia de Autenticación
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/")
    }
  }, [user, isUserLoading, router])

  /**
   * OPTIMIZACIÓN: Se ha eliminado el sistema de presencia (online/offline)
   * para reducir drásticamente las solicitudes de escritura y lectura en Firebase.
   */

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