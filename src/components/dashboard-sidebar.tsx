
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  User, 
  LogOut, 
  Church, 
  Users,
  ClipboardCheck,
  ListChecks,
  Shapes,
  ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useUser, useDoc, useFirestore } from "@/firebase"
import { doc } from "firebase/firestore"
import { useMemo, useState, useEffect } from "react"
import { signOut } from "firebase/auth"
import { useAuth } from "@/firebase/provider"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const menuItems = [
  { name: "Inicio", href: "/dashboard", icon: LayoutDashboard },
  { name: "Lista de Confirmandos", href: "/dashboard/registrations", icon: ListChecks },
  { name: "Nueva Inscripción", href: "/dashboard/registration", icon: ClipboardCheck },
  { name: "Mi Perfil", href: "/dashboard/profile", icon: User },
]

const adminItems = [
  { name: "Gestión de Usuarios", href: "/dashboard/admin/users", icon: Users },
  { name: "Gestión de Grupos", href: "/dashboard/admin/groups", icon: Shapes },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const router = useRouter()
  const auth = useAuth()
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

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth)
      router.push("/")
    }
  }

  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : (user?.displayName || "Catequista")
  const isAdmin = profile?.role === "Administrador"

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200">
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
          <div className="bg-primary p-2 rounded-xl shrink-0 shadow-lg shadow-primary/20">
            <Church className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-headline font-bold text-primary tracking-tight truncate">Confir NSPS</span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="px-2 text-slate-400 font-semibold text-[10px] uppercase tracking-widest mb-2">
              Gestión Parroquial
            </SidebarGroupLabel>
          )}
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

        {isAdmin && (
          <Collapsible asChild defaultOpen className="group/collapsible">
            <SidebarGroup>
              {!isCollapsed && (
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center justify-between text-slate-400 hover:text-primary transition-colors cursor-pointer">
                    <span className="text-[10px] uppercase tracking-widest font-semibold">Administración</span>
                    <ChevronRight className="ml-auto h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
              )}
              <CollapsibleContent>
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
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-slate-100">
        <SidebarMenu>
          <SidebarMenuItem>
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="w-full h-12">
                    <div className="flex items-center gap-3 w-full text-left overflow-hidden">
                      <Avatar className="h-8 w-8 rounded-full shrink-0 border border-slate-100">
                        <AvatarImage src={profile?.photoUrl || undefined} />
                        <AvatarFallback className="bg-accent/10 text-accent">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      {!isCollapsed && (
                        <div className="flex flex-col truncate">
                          <span className="text-xs font-bold text-slate-800 truncate">{displayName}</span>
                          <span className="text-[9px] text-slate-400 uppercase tracking-tighter truncate">{profile?.role || "Catequista"}</span>
                        </div>
                      )}
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-[200px] mb-2 p-2 rounded-xl shadow-xl">
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:bg-destructive/10 focus:text-destructive rounded-lg gap-3">
                    <LogOut className="h-4 w-4" />
                    <span className="font-semibold">Cerrar Sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-3 w-full px-2 py-2">
                <div className="h-8 w-8 rounded-full bg-slate-100 animate-pulse shrink-0" />
                {!isCollapsed && (
                  <div className="flex flex-col gap-1 w-full">
                    <div className="h-3 w-20 bg-slate-100 animate-pulse rounded" />
                    <div className="h-2 w-12 bg-slate-100 animate-pulse rounded" />
                  </div>
                )}
              </div>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
