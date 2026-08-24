"use client"

import React from "react"
import Image from "next/image"

interface ReportTemplateProps {
  request: any;
  includeAnexoV: boolean;
}

export const ReportTemplate = React.forwardRef<HTMLDivElement, ReportTemplateProps>(({ request, includeAnexoV }, ref) => {
  if (!request) return null;

  return (
    <div ref={ref} className="bg-white p-10 w-[210mm] min-h-[297mm] font-serif text-slate-900 mx-auto border shadow-lg" id="report-template">
      {/* Cabecera Institucional */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
        <div className="flex items-center gap-4">
           <div className="relative h-16 w-16 bg-slate-100 rounded-lg flex items-center justify-center font-black text-xl border">
             TSJE
           </div>
           <div className="flex flex-col">
             <h1 className="text-xl font-black uppercase tracking-tight">Tribunal Superior de Justicia Electoral</h1>
             <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Dirección de Tecnologías de la Información y Comunicación</p>
           </div>
        </div>
        <div className="text-right">
           <h2 className="text-lg font-black uppercase">Ficha General de Divulgación</h2>
           <p className="text-xs font-bold text-slate-500">ID: {request.id?.substring(0,8).toUpperCase()}</p>
        </div>
      </div>

      {/* Cuerpo del Informe */}
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-8">
          <section className="space-y-4">
             <h3 className="text-xs font-black uppercase border-b pb-1 tracking-widest text-slate-400">Datos del Divulgador</h3>
             <div className="flex gap-4">
                <div className="h-32 w-32 bg-slate-50 border rounded-lg overflow-hidden relative">
                   {request.divulgadorPhoto ? (
                      <img src={request.divulgadorPhoto} className="object-cover w-full h-full" alt="Divulgador" />
                   ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">SIN FOTO</div>
                   )}
                </div>
                <div className="flex flex-col justify-center gap-2">
                   <div>
                      <p className="text-[8px] font-black uppercase text-slate-400">Nombre Completo</p>
                      <p className="text-sm font-black uppercase">{request.divulgadorName}</p>
                   </div>
                   <div>
                      <p className="text-[8px] font-black uppercase text-slate-400">Ubicación</p>
                      <p className="text-xs font-bold">{request.departamento} - {request.distrito}</p>
                   </div>
                </div>
             </div>
          </section>

          <section className="space-y-4">
             <h3 className="text-xs font-black uppercase border-b pb-1 tracking-widest text-slate-400">Estado del Equipo</h3>
             <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border">
                   <p className="text-[8px] font-black uppercase text-slate-400">ID Máquina</p>
                   <p className="text-sm font-black">{request.machineId}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border text-center">
                   <p className="text-[8px] font-black uppercase text-slate-400">Personas Divulgadas</p>
                   <p className="text-xl font-black">{request.divulgadosCount}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border">
                   <p className="text-[8px] font-black uppercase text-slate-400">Salida</p>
                   <p className="text-[10px] font-bold">{request.machineExitDate?.toDate ? request.machineExitDate.toDate().toLocaleString('es-PY') : 'REGISTRADA'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border">
                   <p className="text-[8px] font-black uppercase text-slate-400">Retorno</p>
                   <p className="text-[10px] font-bold">{request.machineReturnDate?.toDate ? request.machineReturnDate.toDate().toLocaleString('es-PY') : 'PENDIENTE'}</p>
                </div>
             </div>
          </section>
        </div>

        {/* Galería de Evidencias */}
        <section className="space-y-4">
           <h3 className="text-xs font-black uppercase border-b pb-1 tracking-widest text-slate-400">Evidencias de la Actividad</h3>
           <div className="grid grid-cols-3 gap-4">
              {request.activityPhotos && request.activityPhotos.length > 0 ? (
                 request.activityPhotos.map((photo: string, idx: number) => (
                    <div key={idx} className="aspect-video bg-slate-50 border rounded-lg overflow-hidden">
                       <img src={photo} className="object-cover w-full h-full" alt={`Evidencia ${idx + 1}`} />
                    </div>
                 ))
              ) : (
                 <div className="col-span-3 py-10 border-2 border-dashed border-slate-100 rounded-xl text-center text-slate-300 italic text-sm">
                    No se han cargado fotografías de la actividad aún.
                 </div>
              )}
           </div>
        </section>

        {/* Anexo V (Opcional) */}
        {includeAnexoV && (
           <div className="mt-12 pt-12 border-t-2 border-dashed border-slate-200">
              <div className="bg-slate-50 p-8 rounded-2xl border-2 border-slate-900 relative">
                 <div className="absolute -top-4 left-8 bg-slate-900 text-white px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-full">
                    Anexo V - TSJE
                 </div>
                 <div className="space-y-6">
                    <h4 className="text-center font-black uppercase underline">Certificado de Divulgación y Capacitación</h4>
                    <p className="text-xs leading-relaxed text-justify">
                       Por la presente se deja constancia que el Sr./Sra. <strong>{request.divulgadorName}</strong> ha cumplido con la jornada de divulgación de máquinas de votación en el distrito de <strong>{request.distrito}</strong>, departamento de <strong>{request.departamento}</strong>.
                    </p>
                    <div className="grid grid-cols-2 gap-12 mt-12">
                       <div className="border-t border-slate-900 pt-2 text-center">
                          <p className="text-[10px] font-black uppercase">Firma del Divulgador</p>
                       </div>
                       <div className="border-t border-slate-900 pt-2 text-center">
                          <p className="text-[10px] font-black uppercase">Firma del Coordinador</p>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        )}
      </div>

      {/* Pie de página */}
      <div className="mt-20 flex justify-between items-end">
         <div className="text-[8px] font-bold text-slate-400 uppercase">
            Generado automáticamente por Sistema de Gestión de Divulgaciones | © 2026
         </div>
         <div className="text-[8px] font-bold text-slate-400 uppercase">
            Página 1 de 1
         </div>
      </div>
    </div>
  )
})

ReportTemplate.displayName = "ReportTemplate"
