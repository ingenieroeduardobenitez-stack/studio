
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
  ChevronRight,
  UserCheck,
  X,
  Settings,
  Briefcase
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

const operationsItems = [
  { name: "Inicio", href: "/dashboard", icon: LayoutDashboard },
  { name: "Mi Lista (Asistencia)", href: "/dashboard/my-list", icon: UserCheck },
  { name: "Confirmandos", href: "/dashboard/registrations", icon: ListChecks },
  { name: "Nueva Inscripción", href: "/dashboard/registration", icon: ClipboardCheck },
]

const accountItems = [
  { name: "Mi Perfil", href: "/dashboard/profile", icon: User },
]

const adminItems = [
  { name: "Gestión de Usuarios", href: "/dashboard/admin/users", icon: Users },
  { name: "Gestión de Grupos", href: "/dashboard/admin/groups", icon: Shapes },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const { setOpen } = useSidebar()
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
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between text-slate-400 hover:text-primary transition-colors cursor-pointer px-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  <span className="text-[10px] uppercase tracking-widest font-bold">Operaciones</span>
                </div>
                <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-300 group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent className="mt-2">
                <SidebarMenu className="gap-2">
                  {operationsItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={pathname === item.href}
                        className={cn(
                          "transition-all duration-300 h-11 px-4 rounded-xl",
                          pathname === item.href 
                            ? "bg-primary text-white hover:bg-primary shadow-lg shadow-primary/20" 
                            : "text-slate-600 hover:bg-slate-50 hover:text-primary"
                        )}
                      >
                        <Link href={item.href} onClick={() => setOpen(false)}>
                          <item.icon className={cn("h-5 w-5 shrink-0", pathname === item.href ? "text-white" : "text-slate-400")} />
                          <span className="font-medium">{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* GRUPO: MI CUENTA */}
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between text-slate-400 hover:text-primary transition-colors cursor-pointer px-2">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="text-[10px] uppercase tracking-widest font-bold">Mi Cuenta</span>
                </div>
                <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-300 group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent className="mt-2">
                <SidebarMenu className="gap-2">
                  {accountItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={pathname === item.href}
                        className={cn(
                          "transition-all duration-300 h-11 px-4 rounded-xl",
                          pathname === item.href 
                            ? "bg-primary text-white hover:bg-primary shadow-lg shadow-primary/20" 
                            : "text-slate-600 hover:bg-slate-50 hover:text-primary"
                        )}
                      >
                        <Link href={item.href} onClick={() => setOpen(false)}>
                          <item.icon className={cn("h-5 w-5 shrink-0", pathname === item.href ? "text-white" : "text-slate-400")} />
                          <span className="font-medium">{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* GRUPO: ADMINISTRACIÓN */}
        {isAdmin && (
          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between text-slate-400 hover:text-primary transition-colors cursor-pointer px-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="text-[10px] uppercase tracking-widest font-bold">Administración</span>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-300 group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent className="mt-2">
                  <SidebarMenu className="gap-2">
                    {adminItems.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton 
                          asChild 
                          isActive={pathname === item.href}
                          className={cn(
                            "transition-all duration-300 h-11 px-4 rounded-xl",
                            pathname === item.href 
                              ? "bg-primary text-white hover:bg-primary shadow-lg shadow-primary/20" 
                              : "text-slate-600 hover:bg-slate-50 hover:text-primary"
                        )}
                        >
                          <Link href={item.href} onClick={() => setOpen(false)}>
                            <item.icon className={cn("h-5 w-5 shrink-0", pathname === item.href ? "text-white" : "text-slate-400")} />
                            <span className="font-medium">{item.name}</span>
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

      <SidebarFooter className="p-6 border-t mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="w-full h-14 hover:bg-slate-50 rounded-2xl transition-colors px-2">
                    <div className="flex items-center gap-3 w-full text-left">
                      <Avatar className="h-10 w-10 rounded-xl shrink-0 border-2 border-slate-100">
                        <AvatarImage src={profile?.photoUrl || undefined} />
                        <AvatarFallback className="bg-primary/5 text-primary">
                          <User className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col truncate">
                        <span className="text-sm font-bold text-slate-800 truncate">{displayName}</span>
                        <span className="text-[10px] text-primary font-bold uppercase tracking-tighter truncate">{profile?.role || "Catequista"}</span>
                      </div>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-[240px] mb-4 p-2 rounded-2xl shadow-2xl border-none">
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:bg-red-50 focus:text-destructive rounded-xl h-11 px-4 gap-3 cursor-pointer">
                    <LogOut className="h-5 w-5" />
                    <span className="font-bold">Cerrar Sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-3 w-full px-2 py-2">
                <div className="h-10 w-10 rounded-xl bg-slate-100 animate-pulse shrink-0" />
                <div className="flex flex-col gap-1 w-full">
                  <div className="h-4 w-24 bg-slate-100 animate-pulse rounded" />
                  <div className="h-3 w-16 bg-slate-100 animate-pulse rounded" />
                </div>
              </div>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
