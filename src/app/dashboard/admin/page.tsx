
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Users, 
  Shield, 
  Settings, 
  Church, 
  Loader2, 
  ArrowRight, 
  CreditCard, 
  Building2,
  Shapes,
  UserCheck,
  CheckCircle2,
  Wallet
} from "lucide-react"
import { useFirestore, useCollection, useDoc } from "@/firebase"
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export default function AdminPage() {
  const [mounted, setMounted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string>("ACCOUNT")
  
  const db = useFirestore()
  const { toast } = useToast()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Suscripciones a datos
  const regsQuery = useMemo(() => db ? collection(db, "confirmations") : null, [db])
  const groupsQuery = useMemo(() => db ? collection(db, "groups") : null, [db])
  const usersQuery = useMemo(() => db ? collection(db, "users") : null, [db])
  const treasuryRef = useMemo(() => db ? doc(db, "settings", "treasury") : null, [db])

  const { data: registrations, loading: loadingRegs } = useCollection(regsQuery)
  const { data: groups, loading: loadingGroups } = useCollection(groupsQuery)
  const { data: catechists, loading: loadingUsers } = useCollection(usersQuery)
  const { data: settings, loading: loadingSettings } = useDoc(treasuryRef)

  useEffect(() => {
    if (settings?.paymentMethod) {
      setPaymentMethod(settings.paymentMethod)
    }
  }, [settings])

  const handleSaveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !treasuryRef) return
    setIsSaving(true)

    const formData = new FormData(e.currentTarget)
    
    // Solo guardamos los datos relevantes según el método seleccionado
    const data: any = {
      juvenileCost: Number(formData.get("juvenile")),
      adultCost: Number(formData.get("adult")),
      paymentMethod: paymentMethod,
      accountOwner: formData.get("accountOwner") as string || "",
      updatedAt: serverTimestamp()
    }

    if (paymentMethod === "ACCOUNT") {
      data.bankName = formData.get("bankName") as string || ""
      data.accountNumber = formData.get("accountNumber") as string || ""
      data.ownerCi = formData.get("ownerCi") as string || ""
      data.alias = formData.get("alias") as string || ""
    } else {
      data.alias = formData.get("alias") as string || ""
      // En modo alias, los campos de cuenta se limpian o se ignoran
      data.bankName = ""
      data.accountNumber = ""
      data.ownerCi = ""
    }

    try {
      await setDoc(treasuryRef, data, { merge: true })
      toast({ title: "Configuración guardada", description: "Los datos de la parroquia han sido actualizados." })
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar los cambios." })
    } finally {
      setIsSaving(false)
    }
  }

  if (!mounted) return null

  const stats = {
    total: registrations?.length || 0,
    firstYear: registrations?.filter(r => r.catechesisYear === "PRIMER_AÑO").length || 0,
    secondYear: registrations?.filter(r => r.catechesisYear === "SEGUNDO_AÑO").length || 0,
    adults: registrations?.filter(r => r.catechesisYear === "ADULTOS").length || 0,
    groups: groups?.length || 0,
    catechists: catechists?.length || 0,
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Panel de Administración</h1>
          <p className="text-muted-foreground">Gestión global de la Catequesis de Confirmación.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="rounded-xl font-bold">
            <Link href="/dashboard/admin/users">
              <Users className="mr-2 h-4 w-4" /> Usuarios
            </Link>
          </Button>
          <Button asChild className="bg-primary hover:bg-primary/90 rounded-xl font-bold shadow-lg">
            <Link href="/dashboard/admin/groups">
              <Shapes className="mr-2 h-4 w-4" /> Grupos
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inscritos Totales</CardTitle>
            <Shield className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingRegs ? "..." : stats.total}</div>
            <p className="text-[10px] text-muted-foreground">Ciclo Lectivo 2026</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grupos Activos</CardTitle>
            <Shapes className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingGroups ? "..." : stats.groups}</div>
            <p className="text-[10px] text-muted-foreground">Sábados y Domingos</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Catequistas</CardTitle>
            <UserCheck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingUsers ? "..." : stats.catechists}</div>
            <p className="text-[10px] text-muted-foreground">Personal Autorizado</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Adultos</CardTitle>
            <Church className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.adults}</div>
            <p className="text-[10px] text-muted-foreground">Inscripción especial</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none shadow-xl bg-white overflow-hidden">
          <CardHeader className="bg-primary text-white p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg"><Settings className="h-5 w-5" /></div>
              <div>
                <CardTitle className="text-lg">Configuración de la Parroquia</CardTitle>
                <CardDescription className="text-white/70">Define cómo los postulantes verán los datos de pago.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <form onSubmit={handleSaveSettings}>
            <CardContent className="p-8 space-y-8">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Arancel Juvenil (Gs)</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input name="juvenile" type="number" defaultValue={settings?.juvenileCost || 35000} className="pl-10 h-12 rounded-xl bg-slate-50" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Arancel Adultos (Gs)</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input name="adult" type="number" defaultValue={settings?.adultCost || 50000} className="pl-10 h-12 rounded-xl bg-slate-50" required />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wider">
                    <Wallet className="h-4 w-4" /> Método de Pago Preferido
                  </h3>
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="ACCOUNT" id="mode-account" />
                      <Label htmlFor="mode-account" className="text-xs font-bold cursor-pointer">Cuenta Completa</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="ALIAS" id="mode-alias" />
                      <Label htmlFor="mode-alias" className="text-xs font-bold cursor-pointer">Solo Alias</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="grid gap-4 md:grid-cols-2 bg-slate-50/50 p-6 rounded-2xl border border-dashed border-slate-200">
                  {paymentMethod === "ACCOUNT" ? (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500">Nombre del Banco</Label>
                        <Input name="bankName" defaultValue={settings?.bankName} placeholder="Ej. Banco Familiar" className="h-11 rounded-xl bg-white" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500">N° de Cuenta</Label>
                        <Input name="accountNumber" defaultValue={settings?.accountNumber} placeholder="00000000" className="h-11 rounded-xl font-mono bg-white" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500">Titular de la Cuenta</Label>
                        <Input name="accountOwner" defaultValue={settings?.accountOwner} placeholder="Nombre completo" className="h-11 rounded-xl bg-white" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500">C.I. o RUC del Titular</Label>
                        <Input name="ownerCi" defaultValue={settings?.ownerCi} placeholder="1.234.567-8" className="h-11 rounded-xl bg-white" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-xs font-bold text-slate-500">Alias (Opcional)</Label>
                        <Input name="alias" defaultValue={settings?.alias} placeholder="Ej. parroquia.ps" className="h-11 rounded-xl font-bold text-primary bg-white" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500">Alias de Transferencia</Label>
                        <Input name="alias" defaultValue={settings?.alias} placeholder="Ej. parroquia.ps" className="h-12 rounded-xl font-bold text-primary bg-white text-lg" required />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500">Titular de la Cuenta</Label>
                        <Input name="accountOwner" defaultValue={settings?.accountOwner} placeholder="Nombre completo o Parroquia" className="h-12 rounded-xl bg-white" required />
                      </div>
                      <p className="text-[10px] text-muted-foreground italic md:col-span-2 mt-2">
                        * En este modo, el postulante solo verá el Alias y el Nombre del Titular para realizar transferencias rápidas.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 p-6 border-t flex justify-end">
              <Button type="submit" disabled={isSaving} className="rounded-xl h-12 px-8 font-bold shadow-lg gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Guardar Configuración
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-xl bg-white">
            <CardHeader>
              <CardTitle className="text-base">Mantenimiento</CardTitle>
              <CardDescription>Acciones de control del sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild variant="outline" className="w-full justify-start h-12 rounded-xl font-bold gap-3 border-slate-100 hover:bg-slate-50">
                <Link href="/dashboard/admin/users">
                  <Users className="h-5 w-5 text-blue-500" /> Gestionar Usuarios
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start h-12 rounded-xl font-bold gap-3 border-slate-100 hover:bg-slate-50">
                <Link href="/dashboard/admin/groups">
                  <Shapes className="h-5 w-5 text-accent" /> Gestionar Grupos
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start h-12 rounded-xl font-bold gap-3 border-slate-100 hover:bg-slate-50">
                <Link href="/dashboard/admin/archive">
                  <Church className="h-5 w-5 text-orange-500" /> Cierre de Año
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Shield className="h-20 w-20" />
            </div>
            <CardHeader>
              <CardTitle className="text-white">Estado del Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-bold text-green-400">Servidores Operativos</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Todas las conexiones con Firebase Firestore y Authentication están activas. Las inscripciones públicas están habilitadas.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="ghost" className="w-full text-white/50 text-[10px] hover:text-white" disabled>
                Versión 1.2.5 • Estable
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
