
"use client"

import { ConfirmationForm } from "@/components/confirmation-form"
import { Church, Clock, Calendar, Info } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export default function RegistrationPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="bg-primary/10 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <Church className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-headline font-bold text-primary">Inscripción a Confirmación</h1>
      </div>

      {/* SECCIÓN PLEGABLE DE HORARIOS */}
      <div className="max-w-4xl mx-auto">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="horarios" className="border-none">
            <AccordionTrigger className="bg-white px-6 py-4 rounded-xl border shadow-sm hover:no-underline transition-all">
              <div className="flex items-center gap-3 text-slate-700 font-bold">
                <Clock className="h-5 w-5 text-primary" />
                <span>Ver Días y Horarios de Catequesis</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="bg-white/50 px-6 py-5 rounded-b-xl border-x border-b shadow-sm -mt-2">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-accent" />
                    <p className="font-bold text-slate-800">Sábados</p>
                  </div>
                  <p className="text-sm text-slate-600 ml-6">
                    <span className="font-semibold">Horario:</span> 15:30 a 18:30 hs
                  </p>
                  <p className="text-[10px] text-slate-400 ml-6 italic">
                    Disponible para Jóvenes y Adultos
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-accent" />
                    <p className="font-bold text-slate-800">Domingos</p>
                  </div>
                  <p className="text-sm text-slate-600 ml-6">
                    <span className="font-semibold">Horario:</span> 08:00 a 11:00 hs
                  </p>
                  <p className="text-[10px] text-slate-400 ml-6 italic">
                    Disponible para Jóvenes y Adultos
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-primary bg-primary/5 p-3 rounded-lg border border-primary/10">
                <Info className="h-4 w-4 shrink-0" />
                <p>Recuerda informar al confirmando que la asistencia es obligatoria en el día seleccionado.</p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <ConfirmationForm />
    </div>
  )
}
