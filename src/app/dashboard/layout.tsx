
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background w-full">
        <DashboardSidebar />
        <SidebarInset className="flex flex-col min-w-0 bg-slate-50/50">
          <header className="h-16 bg-white border-b px-4 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-primary" />
              <div className="h-6 w-px bg-border hidden sm:block"></div>
              <h2 className="text-sm font-semibold text-slate-500 hidden sm:block uppercase tracking-wider">Sistema de Seguridad Nacional</h2>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-accent rounded-full border-2 border-white"></span>
              </Button>
              <div className="h-8 w-px bg-border mx-2 hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-block text-sm font-medium">Estado NSPS:</span>
                <div className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold border border-accent/20">
                  PENDIENTE
                </div>
              </div>
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
