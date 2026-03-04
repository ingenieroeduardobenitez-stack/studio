
"use client"

import { useUser, useDoc, useFirestore } from "@/firebase"
import { doc } from "firebase/firestore"
import { useMemo, useState, useEffect } from "react"
import { signOut } from "firebase/auth"
import { useAuth } from "@/firebase/provider"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { LogOut, User as UserIcon, UserCircle, Shield } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

export function UserNav() {
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
  const role = profile?.role || "Catequista"

  if (!mounted) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-4 hover:bg-slate-100 p-2 rounded-xl transition-all outline-none text-left">
          <Avatar className="h-12 w-12 border-2 border-slate-100 shadow-sm">
            <AvatarImage src={profile?.photoUrl || undefined} className="object-cover" />
            <AvatarFallback className="bg-primary/5 text-primary">
              <UserIcon className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900 leading-tight">{displayName}</span>
              {role.toLowerCase() === "administrador" && (
                <Shield className="h-3 w-3 text-primary fill-primary/10" />
              )}
            </div>
            <span className="text-[11px] text-primary font-bold uppercase tracking-wider mt-0.5">{role}</span>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px] mt-2 p-2 rounded-2xl shadow-xl border-none">
        <DropdownMenuItem asChild>
          <Link href="/dashboard/profile" className="h-11 rounded-xl px-4 gap-3 cursor-pointer flex items-center">
            <UserCircle className="h-5 w-5 text-slate-400" />
            <span className="font-bold">Mi Perfil</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:bg-red-50 focus:text-destructive rounded-xl h-11 px-4 gap-3 cursor-pointer">
          <LogOut className="h-5 w-5" />
          <span className="font-bold">Cerrar Sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
