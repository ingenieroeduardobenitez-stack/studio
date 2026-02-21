
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  User, 
  Church, 
  Users,
  ClipboardCheck,
  ListChecks,
  Shapes,
  ChevronRight,
  UserCheck,
  X,
  Briefcase
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useUser, useDoc, useFirestore } from "@/firebase"
import { doc } from "firebase/firestore"
import { useMemo, useState, useEffect } from "react"

const operationsItems = [
  { id: "inicio", name: "Inicio", href: "/dashboard", icon: LayoutDashboard },
  { id: "asistencia", name: "Mi Lista (Asistencia)", href: "/dashboard/my-list", icon: UserCheck },
  { id: "confirmandos", name: "Confirmandos", href: "/dashboard/registrations", icon: ListChecks },
  { id: "inscripcion", name: "Nueva Inscripción", href: "/dashboard/registration", icon: ClipboardCheck },
]

const adminItems = [
  { id: "usuarios", name: "Gestión de Usuarios", href: "/dashboard/admin/users", icon: Users },
  { id: "grupos", name: "Gestión de Grupos", href: "/dashboard/admin/groups", icon: Shapes },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const { setOpen } = useSidebar()
  const [mounted, setMounted] = useState(false)
  
  const { user } = useUser()
  const db = useFirestore()
  
  useEffect(() => {
    setMounted(true)
  }, [])

  const userProfileRef = useMemo(() => {
    if (!db || !user?.uid) return null
    return doc(db, "users", user.uid)
  }, [db, user?.uid])

  const { data: profile } = useDoc(userProfileRef)

  const isAdmin = profile?.role === "Administrador"
  const allowedModules = profile?.allowedModules || []

  // Función para filtrar items según los módulos permitidos
  const filterItems = (items: any[]) => {
    // Si no hay módulos definidos (usuario antiguo o no configurado), usamos lógica por rol
    if (!profile?.allowedModules || profile.allowedModules.length === 0) {
      if (isAdmin) return items;
      return items.filter(item => !adminItems.find(ai => ai.id === item.id));
    }
    // Verificar si el usuario tiene permiso de "ver" para el módulo
    return items.filter(item => allowedModules.some(p => p.startsWith(`${item.id}:ver`)));
  }

  const filteredOperations = filterItems(operationsItems);
  const filteredAdmin = filterItems(adminItems);

  if (!mounted) return null

  return (
    <Sidebar collapsible="offcanvas" className="z-[60] shadow-2xl border-r bg-white">
      <SidebarHeader className="p-6 border-b">
        <div className="flex items-center justify-between w-full">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-2xl shadow-lg shadow-primary/20">
              <Church className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-headline font-bold text-primary tracking-tight">Confir NSPS</span>
          </Link>
          <button 
            onClick={() => setOpen(false)}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-6 space-y-4">
        {/* GRUPO: OPERACIONES */}
        {filteredOperations.length > 0 && (
          <Collapsible defaultOpen={true} className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between text-slate-500 hover:text-primary transition-colors cursor-pointer px-2 py-6">
                  <div className="flex items-center gap-3">
                    <div className="p-1 rounded-lg bg-primary/5">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-xs uppercase tracking-[0.15em] font-bold">Operaciones</span>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-300 group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-4">
                  <SidebarMenu className="gap-3">
                    {filteredOperations.map((item) => {
                      const isActive = pathname === item.href
                      return (
                        <SidebarMenuItem key={item.href} className="px-2">
                          <SidebarMenuButton 
                            asChild 
                            isActive={isActive}
                            className={cn(
                              "transition-all duration-300 h-14 px-5 rounded-2xl flex items-center gap-4 border-none",
                              isActive 
                                ? "bg-white text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.08)] hover:bg-white scale-[1.02]" 
                                : "text-slate-500 hover:bg-slate-50 hover:text-primary"
                            )}
                          >
                            <Link href={item.href} onClick={() => setOpen(false)}>
                              <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "text-slate-400")} />
                              <span className={cn("font-bold text-sm", isActive ? "text-slate-800" : "text-slate-600")}>{item.name}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* GRUPO: ADMINISTRACIÓN */}
        {filteredAdmin.length > 0 && (
          <Collapsible defaultOpen={false} className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between text-slate-500 hover:text-primary transition-colors cursor-pointer px-2 py-6">
                  <div className="flex items-center gap-3">
                    <div className="p-1 rounded-lg bg-primary/5">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-xs uppercase tracking-[0.15em] font-bold">Administración</span>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-300 group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-4">
                  <SidebarMenu className="gap-3">
                    {filteredAdmin.map((item) => {
                      const isActive = pathname === item.href
                      return (
                        <SidebarMenuItem key={item.id} className="px-2">
                          <SidebarMenuButton 
                            asChild 
                            isActive={isActive}
                            className={cn(
                              "transition-all duration-300 h-14 px-5 rounded-2xl flex items-center gap-4 border-none",
                              isActive 
                                ? "bg-white text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.08)] hover:bg-white scale-[1.02]" 
                                : "text-slate-500 hover:bg-slate-50 hover:text-primary"
                            )}
                          >
                            <Link href={item.href} onClick={() => setOpen(false)}>
                              <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "text-slate-400")} />
                              <span className={cn("font-bold text-sm", isActive ? "text-slate-800" : "text-slate-600")}>{item.name}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
