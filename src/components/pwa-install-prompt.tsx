
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Download, X, Share, PlusSquare, Info } from "lucide-react"
import Image from "next/image"

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Detectar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true)
      return
    }

    // Detectar iOS
    const userAgent = window.navigator.userAgent.toLowerCase()
    const ios = /iphone|ipad|ipod/.test(userAgent)
    setIsIOS(ios)

    // Escuchar el evento de instalación
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Mostrar el prompt después de un momento
      setTimeout(() => setShowPrompt(true), 3000)
    }

    window.addEventListener("beforeinstallprompt", handler)

    // Para casos donde el evento no se dispara (ej. iOS o ya instalada en cache)
    const timer = setTimeout(() => {
      if (!isStandalone) {
        setShowPrompt(true)
      }
    }, 6000)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      clearTimeout(timer)
    }
  }, [isStandalone])

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("Para instalar en este navegador, usa el menú de opciones (tres puntos o flecha) y selecciona 'Instalar aplicación' o 'Agregar a pantalla de inicio'.")
      return
    }
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  if (!showPrompt || isStandalone) return null

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[100] animate-in slide-in-from-bottom-10 duration-500 md:left-auto md:right-6 md:w-96">
      <Card className="border-none shadow-2xl bg-white rounded-3xl overflow-visible relative border-t-4 border-t-primary">
        <button 
          onClick={() => setShowPrompt(false)}
          className="absolute -top-2 -right-2 h-8 w-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 shadow-md hover:bg-slate-200 transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="p-5 flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-white border-2 border-slate-100 shadow-sm flex items-center justify-center p-1 shrink-0 overflow-hidden relative">
            {/* Fallback para el logo si el archivo no existe aún */}
            <Image 
              src="/icon.png" 
              alt="Logo Santuario" 
              width={64}
              height={64}
              className="object-contain"
              onError={(e) => {
                // Si icon.png falla, intenta cargar logo.png
                const target = e.target as HTMLImageElement;
                target.src = "/logo.png";
              }}
            />
          </div>
          <div className="flex-1 space-y-0.5">
            <p className="text-sm font-black text-slate-900 leading-tight uppercase tracking-tight">Instalar Aplicación</p>
            <p className="text-[10px] text-slate-500 leading-tight font-bold uppercase tracking-widest">Acceso directo desde tu pantalla</p>
          </div>
        </div>

        <div className="px-5 pb-5 pt-0">
          {isIOS ? (
            <div className="bg-slate-50 p-4 rounded-2xl space-y-3 border border-slate-100">
              <p className="text-[10px] font-black text-primary flex items-center gap-2 uppercase tracking-widest">
                <Info className="h-3 w-3" /> Pasos para iPhone
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-600 font-bold">
                <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center shadow-sm text-[10px]">1</div>
                <span className="flex items-center gap-2">Toca compartir <Share className="h-4 w-4 text-blue-500" /></span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-600 font-bold">
                <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center shadow-sm text-[10px]">2</div>
                <span className="flex items-center gap-2">"Agregar a inicio" <PlusSquare className="h-4 w-4 text-slate-700" /></span>
              </div>
            </div>
          ) : (
            <Button 
              onClick={handleInstallClick}
              className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl shadow-xl gap-3 active:scale-95 transition-all text-sm uppercase tracking-widest"
            >
              <Download className="h-5 w-5" /> INSTALAR AHORA
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
