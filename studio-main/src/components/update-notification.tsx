"use client"

import { useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { Sparkles } from "lucide-react"

/**
 * CAMBIA ESTA CONSTANTE cada vez que realices una actualización en el servidor.
 * Esto disparará el mensaje "Sistema Actualizado" una sola vez a todos los usuarios.
 */
const CURRENT_VERSION = "1.3.0-update-final" 

export function UpdateNotification() {
  const { toast } = useToast()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    // Verificar la versión guardada en el navegador del usuario
    const storedVersion = localStorage.getItem("nsps_app_version")
    
    if (storedVersion !== CURRENT_VERSION) {
      // Esperar 3 segundos después de la carga inicial para no saturar al usuario
      const timer = setTimeout(() => {
        toast({
          title: "¡Sistema Actualizado!",
          description: "Se ha publicado una nueva versión de la aplicación con mejoras y correcciones. La actualización se ha completado con éxito.",
        })
        // Guardar la nueva versión para que no se repita el mensaje
        localStorage.setItem("nsps_app_version", CURRENT_VERSION)
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [mounted, toast])

  return null
}
