
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  User, 
  ShieldCheck, 
  Settings, 
  LogOut, 
  Shield, 
  FileText,
  Lock
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const menuItems = [
  { name: "Panel de Control", href: "/dashboard", icon: LayoutDashboard },
  { name: "Registro NSPS", href: "/dashboard/registration", icon: FileText },
  { name: "Perfil", href: "/dashboard/profile", icon: User },
  { name: "Panel Admin", href: "/dashboard/admin", icon: Lock },
]

export function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <div className="hidden lg:flex w-64 flex-col bg-white border-r h-screen sticky top-0">
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="bg-primary p-1.5 rounded-lg">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-headline font-bold text-primary">Confir NSPS</span>
        </Link>
      </div>
      <div className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
              pathname === item.href
                ? "bg-primary text-white shadow-md"
                : "text-muted-foreground hover:bg-secondary hover:text-primary"
            )}
          >
            <item.icon className={cn("h-4 w-4", pathname === item.href ? "text-white" : "group-hover:text-primary")} />
            {item.name}
          </Link>
        ))}
      </div>
      <div className="p-4 border-t mt-auto">
        <div className="bg-secondary/50 rounded-xl p-3 mb-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center">
            <User className="h-4 w-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">Juan Pérez</p>
            <p className="text-xs text-muted-foreground truncate">juan.perez@gov.us</p>
          </div>
        </div>
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" asChild>
          <Link href="/">
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Link>
        </Button>
      </div>
    </div>
  )
}
