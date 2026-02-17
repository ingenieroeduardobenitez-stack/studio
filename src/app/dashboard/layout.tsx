
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
              <h2 className="text-sm font-semibold text-slate-500 hidden sm:block uppercase tracking-wider">Parroquia Perpetuo Socorro</h2>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5 text-muted-foreground" />
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
