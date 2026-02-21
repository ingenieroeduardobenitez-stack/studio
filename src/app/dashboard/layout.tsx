
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { Bell, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
          <header className="h-16 bg-white/80 backdrop-blur-md border-b px-4 flex items-center justify-between sticky top-0 z-30 ml-0">
            <div className="flex items-center gap-4 pl-16">
              <div className="h-6 w-px bg-border hidden sm:block"></div>
              <h2 className="text-sm font-bold text-slate-600 hidden sm:block uppercase tracking-widest">SISTEMA DE GESTIÓN CONFIRMACIÓN JUVENIL</h2>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="relative rounded-full">
                <Bell className="h-5 w-5 text-slate-500" />
              </Button>
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
