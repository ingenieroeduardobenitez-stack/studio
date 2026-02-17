
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  User, 
  LogOut, 
  Shield, 
  FileText,
  Lock,
  Settings,
  ChevronUp
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const menuItems = [
  { name: "Panel de Control", href: "/dashboard", icon: LayoutDashboard },
  { name: "Registro NSPS", href: "/dashboard/registration", icon: FileText },
  { name: "Perfil de Usuario", href: "/dashboard/profile", icon: User },
]

const adminItems = [
  { name: "Panel de Administración", href: "/dashboard/admin", icon: Lock },
  { name: "Configuración Sistema", href: "#", icon: Settings },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200">
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-xl shrink-0 shadow-lg shadow-primary/20">
            <Shield className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && (
            <span className="text-xl font-headline font-bold text-primary tracking-tight">Confir NSPS</span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-slate-400 font-semibold text-[10px] uppercase tracking-widest mb-2">
            Menú Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.href}
                    tooltip={item.name}
                    className={cn(
                      "transition-all duration-200 h-10 px-3",
                      pathname === item.href 
                        ? "bg-primary text-white hover:bg-primary/90 shadow-md" 
                        : "text-slate-600 hover:bg-slate-100 hover:text-primary"
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon className={cn("h-4 w-4 shrink-0", pathname === item.href ? "text-white" : "text-slate-500")} />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-2 text-slate-400 font-semibold text-[10px] uppercase tracking-widest mb-2">
            Administración
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.href}
                    tooltip={item.name}
                    className={cn(
                      "transition-all duration-200 h-10 px-3",
                      pathname === item.href 
                        ? "bg-primary text-white hover:bg-primary/90 shadow-md" 
                        : "text-slate-600 hover:bg-slate-100 hover:text-primary"
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon className={cn("h-4 w-4 shrink-0", pathname === item.href ? "text-white" : "text-slate-500")} />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-slate-100">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton 
                  size="lg" 
                  className="w-full data-[state=open]:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-accent" />
                    </div>
                    {!isCollapsed && (
                      <div className="flex flex-col text-left overflow-hidden">
                        <span className="text-sm font-bold truncate text-slate-800">Juan Pérez</span>
                        <span className="text-[10px] text-slate-500 truncate">juan.perez@gov.us</span>
                      </div>
                    )}
                    {!isCollapsed && <ChevronUp className="ml-auto h-4 w-4 text-slate-400" />}
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[--radix-dropdown-menu-trigger-width] mb-2 p-2 rounded-xl shadow-xl border-slate-200">
                <DropdownMenuItem className="rounded-lg py-2 focus:bg-slate-100">
                  <User className="mr-2 h-4 w-4" />
                  <span>Ver Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-lg py-2 focus:bg-slate-100">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Ajustes</span>
                </DropdownMenuItem>
                <div className="h-px bg-slate-100 my-1"></div>
                <DropdownMenuItem className="rounded-lg py-2 focus:bg-destructive/10 text-destructive hover:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <Link href="/">Cerrar Sesión</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
