"use client"

import { ConfirmationForm } from "@/components/confirmation-form"
import { Church, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"

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
        <div className="bg-primary/10 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <Church className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-headline font-bold text-primary">Inscripción a Confirmación</h1>
        <p className="text-muted-foreground font-medium italic">Parroquia Perpetuo Socorro</p>
      </div>

      <ConfirmationForm />
    </div>
  )
}