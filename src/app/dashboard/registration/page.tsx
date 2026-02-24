"use client"

import { ConfirmationForm } from "@/components/confirmation-form"
import { Church, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import Image from "next/image"

export default function RegistrationPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="bg-white w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-4 shadow-xl border-2 border-primary/5 relative overflow-hidden p-3">
          <Image src="/logo.png" alt="Logo Santuario" fill className="object-contain p-2" priority />
        </div>
        <h1 className="text-3xl font-headline font-bold text-primary">Inscripción a Confirmación</h1>
        <p className="text-muted-foreground font-medium italic">Santuario Nacional Nuestra Señora del Perpetuo Socorro</p>
      </div>

      <ConfirmationForm />
    </div>
  )
}
