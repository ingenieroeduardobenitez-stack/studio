
"use client"

import { ConfirmationForm } from "@/components/confirmation-form"
import { Church, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"

export default function PublicRegistrationPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-body">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-primary transition-all font-bold text-sm bg-white px-4 py-2 rounded-xl shadow-sm border">
            <ArrowLeft className="h-4 w-4" /> Volver al Inicio
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Santuario Nacional</p>
              <p className="text-[9px] font-black text-primary uppercase leading-tight">Ntra. Sra. del Perpetuo Socorro</p>
            </div>
            <div className="bg-white p-2 rounded-xl border shadow-sm">
              <Church className="h-6 w-6 text-primary" />
            </div>
          </div>
        </div>

        <div className="text-center space-y-3">
          <h1 className="text-4xl font-headline font-bold text-primary tracking-tight md:text-5xl">Formulario de Inscripción</h1>
          <p className="text-slate-500 font-medium text-lg max-w-2xl mx-auto italic">
            Bienvenido al proceso de inscripción para la Catequesis de Confirmación 2026. Santuario Nacional Nuestra Señora del Perpetuo Socorro.
          </p>
        </div>

        <ConfirmationForm isPublic={true} />
        
        <div className="text-center pt-8">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
            Sistema de Gestión de Santuarios • © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}
