
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  User, 
  LogOut, 
  Church, 
  Settings,
  ChevronUp,
  Loader2,
  Users,
  ClipboardCheck
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
import { useUser, useDoc, useFirestore } from "@/firebase"
import { doc } from "firebase/firestore"
import { useMemo } from "react"
import { signOut } from "firebase/auth"
import { useAuth } from "@/firebase/provider"
import { useRouter } from "next/navigation"

const menuItems = [
  { name: "Inicio", href: "/dashboard", icon: LayoutDashboard },
  { name: "Nueva Inscripción", href: "/dashboard/registration", icon: ClipboardCheck },
  { name: "Mi Perfil", href: "/dashboard/profile", icon: User },
]

const adminItems = [
  { name: "Gestión de Usuarios", href: "/dashboard/admin/users", icon: Users },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const router = useRouter()
  const auth = useAuth()
  
  const { user } = useUser()
  const db = useFirestore()
  
  const userProfileRef = useMemo(() => {
    if (!db || !user?.uid) return null
    return doc(db, "users", user.uid)
  }, [db, user?.uid])

  const { data: profile, loading: profileLoading } = useDoc(userProfileRef)

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth)
      router.push("/")
    }
  }

  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : (user?.displayName || "Usuario")
  const isAdmin = profile?.role === "Administrador"

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200">
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-xl shrink-0 shadow-lg shadow-primary/20">
            <Church className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-headline font-bold text-primary tracking-tight">P. Perpetuo Socorro</span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-slate-400 font-semibold text-[10px] uppercase tracking-widest mb-2">
            Gestión Parroquial
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

        {isAdmin && (
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
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-slate-100">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="w-full">
                  <div className="flex items-center gap-3 w-full text-left overflow-hidden">
                    <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-accent" />
                    </div>
                    {!isCollapsed && (
                      <div className="flex flex-col truncate">
                        <span className="text-sm font-bold text-slate-800">{displayName}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-tighter">{profile?.role || "Catequista"}</span>
                      </div>
                    )}
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[--radix-dropdown-menu-trigger-width] mb-2 p-2">
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
