
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

    // Escuchar el evento de instalación en Android/Chrome/Computadora
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Mostrar el prompt después de un momento de interacción
      setTimeout(() => setShowPrompt(true), 2500)
    }

    window.addEventListener("beforeinstallprompt", handler)

    // Para iOS o computadoras donde el evento no se dispara rápido
    const timer = setTimeout(() => {
      if (!isStandalone) {
        setShowPrompt(true)
      }
    }, 5000)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      clearTimeout(timer)
    }
  }, [isStandalone])

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Si no hay prompt diferido (ej. escritorio Safari/Firefox), mostramos ayuda
      alert("Para instalar esta aplicación, busca el botón de instalación en la barra de direcciones o usa el menú de tu navegador.")
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
      <Card className="border-none shadow-2xl bg-white rounded-3xl overflow-visible relative">
        <button 
          onClick={() => setShowPrompt(false)}
          className="absolute -top-2 -right-2 h-8 w-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 shadow-md hover:bg-slate-200 transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="p-5 flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white border-2 border-primary/10 shadow-sm flex items-center justify-center p-1.5 shrink-0 overflow-hidden relative">
            <Image src="/icon.png" alt="Logo App" fill className="object-contain p-1" />
          </div>
          <div className="flex-1 space-y-0.5">
            <p className="text-sm font-black text-slate-900 leading-tight uppercase">Instalar Aplicación</p>
            <p className="text-[10px] text-slate-500 leading-tight font-medium uppercase tracking-tight">Acceso directo desde tu pantalla</p>
          </div>
        </div>

        <div className="px-5 pb-5 pt-0">
          {isIOS ? (
            <div className="bg-slate-50 p-3 rounded-2xl space-y-2 border border-slate-100">
              <p className="text-[10px] font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                <Info className="h-3 w-3" /> Instrucciones para iPhone
              </p>
              <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium">
                <span>1. Toca compartir</span>
                <Share className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium">
                <span>2. Selecciona "Agregar a inicio"</span>
                <PlusSquare className="h-3.5 w-3.5 text-slate-700" />
              </div>
            </div>
          ) : (
            <Button 
              onClick={handleInstallClick}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl shadow-lg gap-2 active:scale-95 transition-all"
            >
              <Download className="h-4 w-4" /> INSTALAR EN DISPOSITIVO
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
