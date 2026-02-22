
"use client"

import Link from "next/link"
import { Church, ArrowRight, Users, Calendar, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import { PlaceHolderImages } from "@/lib/placeholder-images"

export default function LandingPage() {
  const heroImage = PlaceHolderImages.find(img => img.id === "hero-image")
  const logoData = PlaceHolderImages.find(img => img.id === "parish-logo")

  return (
    <div className="flex min-h-screen flex-col bg-white font-body">
      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative h-8 w-8">
              {logoData && (
                <Image 
                  src={logoData.imageUrl} 
                  alt="Logo" 
                  fill 
                  className="object-contain"
                  data-ai-hint="church logo"
                />
              )}
            </div>
            <span className="font-headline font-bold text-primary hidden sm:block">Perpetuo Socorro</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild className="text-slate-500 font-bold text-xs hover:text-primary">
              <Link href="/login">
                Acceso Catequistas
              </Link>
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90 rounded-xl font-bold px-6 shadow-md">
              <Link href="/inscripcion">
                Inscribirme <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          {heroImage && (
            <Image 
              src={heroImage.imageUrl} 
              alt="Parroquia Hero" 
              fill 
              className="object-cover opacity-10"
              priority
              data-ai-hint="church background"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-white to-white"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest animate-in fade-in slide-in-from-bottom-2">
              <Church className="h-3 w-3" /> Inscripciones Abiertas Ciclo 2026
            </div>
            <h1 className="text-5xl md:text-7xl font-headline font-bold text-slate-900 leading-[1.1] animate-in fade-in slide-in-from-bottom-4 duration-700">
              Camina con Fe en la <span className="text-primary">Catequesis de Confirmación</span>
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-1000">
              Invitamos a todos los jóvenes y adultos a iniciar su proceso de formación espiritual en la Parroquia Perpetuo Socorro.
            </p>
            <div className="flex flex-col items-center justify-center pt-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <Button asChild className="h-16 px-12 text-xl font-bold rounded-2xl shadow-xl bg-primary hover:bg-primary/90 w-full sm:w-auto transform transition-transform hover:scale-105 active:scale-95">
                <Link href="/inscripcion">
                  Iniciar Inscripción Digital
                </Link>
              </Button>
              <p className="mt-6 text-sm text-slate-400 font-medium">
                Proceso rápido, seguro y 100% digital.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Info Cards */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-none shadow-lg rounded-3xl overflow-hidden hover:shadow-xl transition-shadow">
              <CardContent className="p-8 space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500">
                  <Calendar className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-headline font-bold text-slate-900">Horarios Flexibles</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Contamos con grupos los días sábados por la tarde y domingos por la mañana para adaptarnos a tu tiempo.
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg rounded-3xl overflow-hidden hover:shadow-xl transition-shadow">
              <CardContent className="p-8 space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-headline font-bold text-slate-900">Comunidad Activa</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Forma parte de una comunidad joven, llena de vida y actividades pastorales durante todo el año.
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg rounded-3xl overflow-hidden hover:shadow-xl transition-shadow">
              <CardContent className="p-8 space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500">
                  <MapPin className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-headline font-bold text-slate-900">Ubicación</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Te esperamos en nuestra sede parroquial para todas las jornadas y encuentros presenciales.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <Church className="h-6 w-6 text-slate-300" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">Parroquia Perpetuo Socorro</span>
          </div>
          <div className="flex gap-6">
            <Link href="/login" className="text-xs text-slate-400 hover:text-primary font-bold uppercase tracking-widest transition-colors">
              Gestión Interna
            </Link>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            © {new Date().getFullYear()} Sistema de Gestión de Sacramentos. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
