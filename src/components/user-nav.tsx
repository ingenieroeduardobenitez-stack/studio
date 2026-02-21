
"use client"

import { useUser, useDoc, useFirestore } from "@/firebase"
import { doc } from "firebase/firestore"
import { useMemo, useState, useEffect } from "react"
import { signOut } from "firebase/auth"
import { useAuth } from "@/firebase/provider"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { LogOut, User as UserIcon } from "lucide-react"

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
        <button className="flex items-center gap-3 hover:bg-slate-100 p-1.5 rounded-full transition-all outline-none">
          <Avatar className="h-10 w-10 border-2 border-slate-200 shadow-sm">
            <AvatarImage src={profile?.photoUrl || undefined} />
            <AvatarFallback className="bg-primary/5 text-primary">
              <UserIcon className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col text-left mr-2">
            <span className="text-sm font-bold text-slate-800 leading-none mb-1">{displayName}</span>
            <span className="text-[10px] text-primary font-bold uppercase tracking-tight">{role}</span>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px] mt-2 p-2 rounded-2xl shadow-xl border-none">
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:bg-red-50 focus:text-destructive rounded-xl h-11 px-4 gap-3 cursor-pointer">
          <LogOut className="h-5 w-5" />
          <span className="font-bold">Cerrar Sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
