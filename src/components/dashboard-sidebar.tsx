
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  Church, 
  Users,
  ClipboardCheck,
  ListChecks,
  Shapes,
  ChevronRight,
  UserCheck,
  X,
  Briefcase,
  Wallet,
  CreditCard,
  ArrowLeftRight,
  Archive,
  Globe
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
import Image from "next/image"
import { PlaceHolderImages } from "@/lib/placeholder-images"

const operationsItems = [
  { id: "inicio", name: "Inicio", href: "/dashboard", icon: LayoutDashboard },
  { id: "asistencia", name: "Mi Lista (Asistencia)", href: "/dashboard/my-list", icon: UserCheck },
  { id: "confirmandos", name: "Confirmandos", href: "/dashboard/registrations", icon: ListChecks },
  { id: "inscripcion", name: "Nueva Inscripción", href: "/dashboard/registration", icon: ClipboardCheck },
  { id: "cambio_grupo", name: "Cambio de Grupo", href: "/dashboard/group-change", icon: ArrowLeftRight },
  { id: "pagos_alumnos", name: "Gestión de Pagos", href: "/dashboard/payments", icon: CreditCard },
]

const treasuryItems = [
  { id: "tesoreria", name: "Gestión Tesorería", href: "/dashboard/treasury", icon: Wallet },
]

const adminItems = [
  { id: "usuarios", name: "Gestión de Usuarios", href: "/dashboard/admin/users", icon: Users },
  { id: "grupos", name: "Gestión de Grupos", href: "/dashboard/admin/groups", icon: Shapes },
  { id: "conexiones", name: "Monitoreo Conexiones", href: "/dashboard/admin/connections", icon: Globe },
  { id: "archivar", name: "Cierre de Año / Archivo", href: "/dashboard/admin/archive", icon: Archive },
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
  const logoData = PlaceHolderImages.find(img => img.id === "parish-logo")

  const isAdmin = profile?.role === "Administrador"
  const allowedModules = profile?.allowedModules || []

  const filterItems = (items: any[]) => {
    if (!profile?.allowedModules || profile.allowedModules.length === 0) {
      if (isAdmin) return items;
      return items.filter(item => !adminItems.find(ai => ai.id === item.id) && !treasuryItems.find(ti => ti.id === item.id));
    }
    return items.filter(item => allowedModules.some(p => p.startsWith(`${item.id}:ver`)));
  }

  const filteredOperations = filterItems(operationsItems);
  const filteredTreasury = filterItems(treasuryItems);
  const filteredAdmin = filterItems(adminItems);

  if (!mounted) return null

  return (
    <Sidebar collapsible="offcanvas" className="z-[60] shadow-2xl border-r bg-white">
      <SidebarHeader className="p-6 border-b">
        <div className="flex items-center justify-between w-full">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="relative h-10 w-10 bg-white rounded-xl shadow-md border flex items-center justify-center overflow-hidden">
              {logoData ? (
                <Image 
                  src={logoData.imageUrl} 
                  alt={logoData.description} 
                  fill
                  className="object-contain p-1"
                  data-ai-hint={logoData.imageHint}
                />
              ) : (
                <Church className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-headline font-bold text-primary tracking-tight">Confir NSPS</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Parroquia PS</span>
            </div>
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
                          <SidebarMenuButton asChild isActive={isActive}>
                            <Link href={item.href} onClick={() => setOpen(false)}>
                              <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-slate-400")} />
                              <span className="font-bold">{item.name}</span>
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

        {filteredTreasury.length > 0 && (
          <Collapsible defaultOpen={true} className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between text-slate-500 hover:text-primary transition-colors cursor-pointer px-2 py-6">
                  <div className="flex items-center gap-3">
                    <div className="p-1 rounded-lg bg-primary/5">
                      <Wallet className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-xs uppercase tracking-[0.15em] font-bold">Tesorería</span>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-300 group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-4">
                  <SidebarMenu className="gap-3">
                    {filteredTreasury.map((item) => {
                      const isActive = pathname === item.href
                      return (
                        <SidebarMenuItem key={item.href} className="px-2">
                          <SidebarMenuButton asChild isActive={isActive}>
                            <Link href={item.href} onClick={() => setOpen(false)}>
                              <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-slate-400")} />
                              <span className="font-bold">{item.name}</span>
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
                          <SidebarMenuButton asChild isActive={isActive}>
                            <Link href={item.href} onClick={() => setOpen(false)}>
                              <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-slate-400")} />
                              <span className="font-bold">{item.name}</span>
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
