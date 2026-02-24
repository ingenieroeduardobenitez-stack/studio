"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Wallet, Settings, Search, Loader2, CreditCard, FileText, User, Church, Info, Copy, Printer } from "lucide-react"
import { useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase"
import { collection, doc, setDoc, updateDoc, serverTimestamp, addDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

export default function TreasuryPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isCostSaving, setIsCostSaving] = useState(false)
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string>("ACCOUNT")

  const { toast } = useToast()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const treasuryRef = useMemo(() => db ? doc(db, "settings", "treasury") : null, [db])
  const { data: costs, loading: loadingCosts } = useDoc(treasuryRef)

  useEffect(() => {
    if (costs?.paymentMethod) {
      setPaymentMethod(costs.paymentMethod)
    }
  }, [costs])

  const regsQuery = useMemoFirebase(() => db ? collection(db, "confirmations") : null, [db])
  const { data: registrations, loading: loadingRegs } = useCollection(regsQuery)

  const filteredRegs = useMemo(() => {
    if (!registrations) return []
    return registrations.filter(r => 
      r.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.ciNumber?.includes(searchTerm)
    )
  }, [registrations, searchTerm])

  const handleUpdateCosts = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !treasuryRef) return
    setIsCostSaving(true)

    const formData = new FormData(e.currentTarget)
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
      data.bankName = ""
      data.accountNumber = ""
      data.ownerCi = ""
    }

    setDoc(treasuryRef, data, { merge: true })
      .then(() => {
        toast({ title: "Configuración de pagos actualizada" })
      })
      .catch(() => toast({ variant: "destructive", title: "Error al guardar" }))
      .finally(() => setIsCostSaving(false))
  }

  const handleOpenPayment = (reg: any) => {
    setSelectedReg(reg)
    setPaymentAmount(0)
    setIsPaymentDialogOpen(true)
  }

  const pendingBalance = selectedReg ? (selectedReg.registrationCost || 0) - (selectedReg.amountPaid || 0) : 0
  const isOverpaid = paymentAmount > pendingBalance

  const handleProcessPayment = async () => {
    if (!db || !selectedReg) return
    if (isOverpaid) {
      toast({ variant: "destructive", title: "El monto no puede superar el saldo" })
      return
    }
    const newPaid = (selectedReg.amountPaid || 0) + paymentAmount
    const status = newPaid >= (selectedReg.registrationCost || 0) ? "PAGADO" : "PARCIAL"
    
    updateDoc(doc(db, "confirmations", selectedReg.id), {
      amountPaid: newPaid,
      paymentStatus: status,
      status: "INSCRITO",
      lastPaymentDate: serverTimestamp()
    })
      .then(() => {
        toast({ title: "Pago registrado correctamente" })
        setIsPaymentDialogOpen(false)
        setIsReceiptOpen(true)
      })
      .catch(() => toast({ variant: "destructive", title: "Error al registrar" }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado" });
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Tesorería Parroquial</h1>
          <p className="text-muted-foreground">Administración de aranceles y configuración de pagos.</p>
        </div>
      </div>

      <Tabs defaultValue="pagos" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6">
          <TabsTrigger value="pagos" className="gap-2"><CreditCard className="h-4 w-4" /> Pagos Recibidos</TabsTrigger>
          <TabsTrigger value="config" className="gap-2"><Settings className="h-4 w-4" /> Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="pagos">
          <Card className="border-none shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle>Control de Inscripciones</CardTitle>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por nombre o C.I..." className="pl-9 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingRegs ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="font-bold">Alumno</TableHead>
                      <TableHead className="font-bold text-center">Estado</TableHead>
                      <TableHead className="font-bold text-center">Saldo Pendiente</TableHead>
                      <TableHead className="text-right font-bold pr-8">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegs.map((reg) => {
                      const pending = (reg.registrationCost || 0) - (reg.amountPaid || 0)
                      return (
                        <TableRow key={reg.id} className="hover:bg-slate-50/30 h-16">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 border"><AvatarImage src={reg.photoUrl} /><AvatarFallback><User className="h-4 w-4" /></AvatarFallback></Avatar>
                              <div className="flex flex-col"><span className="font-bold text-sm text-slate-900">{reg.fullName}</span><span className="text-[10px] text-muted-foreground">{reg.ciNumber}</span></div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={reg.paymentStatus === "PAGADO" ? "default" : "outline"} className={cn(reg.paymentStatus === "PAGADO" && "bg-green-500")}>
                              {reg.paymentStatus || "PENDIENTE"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={cn("font-bold text-sm", pending > 0 ? "text-red-500" : "text-slate-400")}>
                              {pending > 0 ? `${pending.toLocaleString()} Gs.` : "Saldado"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right pr-8">
                            <div className="flex justify-end gap-2">
                              {pending > 0 && <Button size="sm" variant="outline" className="h-8 gap-2 border-primary text-primary" onClick={() => handleOpenPayment(reg)}><Wallet className="h-3 w-3" /> Cobrar</Button>}
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setSelectedReg(reg); setIsReceiptOpen(true); }}><FileText className="h-4 w-4 text-slate-400" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <div className="grid gap-8 lg:grid-cols-2">
            <Card className="border-none shadow-xl bg-white overflow-hidden">
              <CardHeader className="bg-primary text-white">
                <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Parámetros de Cobro</CardTitle>
              </CardHeader>
              <form onSubmit={handleUpdateCosts}>
                <CardContent className="p-8 space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label className="font-bold">Juvenil (Gs)</Label><Input name="juvenile" type="number" defaultValue={costs?.juvenileCost || 35000} className="h-11 rounded-xl" required /></div>
                    <div className="space-y-2"><Label className="font-bold">Adultos (Gs)</Label><Input name="adult" type="number" defaultValue={costs?.adultCost || 50000} className="h-11 rounded-xl" required /></div>
                  </div>
                  <Separator />
                  <div className="space-y-6">
                    <Label className="text-primary font-bold uppercase text-xs">Método de Pago Predeterminado</Label>
                    <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="flex gap-6 p-4 bg-slate-50 rounded-2xl border">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="ACCOUNT" id="mode-acc" /><Label htmlFor="mode-acc" className="font-bold cursor-pointer">Cuenta Completa</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="ALIAS" id="mode-ali" /><Label htmlFor="mode-ali" className="font-bold cursor-pointer">Solo Alias</Label></div>
                    </RadioGroup>
                    <div className="grid gap-4 p-6 border rounded-2xl bg-white shadow-sm">
                      {paymentMethod === "ALIAS" ? (
                        <>
                          <div className="space-y-2"><Label className="font-bold">Alias de Transferencia</Label><Input name="alias" defaultValue={costs?.alias} placeholder="Ej. 0981123456" className="h-12 rounded-xl font-bold text-primary" required /></div>
                          <div className="space-y-2"><Label className="font-bold">Titular de la Cuenta</Label><Input name="accountOwner" defaultValue={costs?.accountOwner} placeholder="Nombre completo" className="h-12 rounded-xl" required /></div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-2"><Label>Nombre del Banco</Label><Input name="bankName" defaultValue={costs?.bankName} className="h-10 rounded-lg" /></div>
                          <div className="space-y-2"><Label>N° de Cuenta</Label><Input name="accountNumber" defaultValue={costs?.accountNumber} className="h-10 rounded-lg" /></div>
                          <div className="space-y-2"><Label>Titular de Cuenta</Label><Input name="accountOwner" defaultValue={costs?.accountOwner} className="h-10 rounded-lg" /></div>
                          <div className="space-y-2"><Label>C.I. del Titular</Label><Input name="ownerCi" defaultValue={costs?.ownerCi} className="h-10 rounded-lg" /></div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-slate-50 p-6 border-t flex justify-end">
                  <Button type="submit" disabled={isCostSaving} className="h-12 px-8 rounded-xl font-bold shadow-lg">
                    {isCostSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Guardar Cambios"}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            <Card className="border-none shadow-xl bg-slate-50 p-8 flex flex-col items-center justify-center space-y-6">
              <div className="bg-white p-10 rounded-3xl border shadow-md w-full max-w-[350px] space-y-6 text-center">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-inner"><Wallet className="h-8 w-8 text-green-600" /></div>
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Vista Previa para Postulantes</p>
                  <p className="text-2xl font-black text-primary uppercase break-all">{paymentMethod === "ALIAS" ? costs?.alias : costs?.accountNumber || "---"}</p>
                  <p className="text-xs text-slate-500 font-bold">{costs?.accountOwner || "---"}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-[10px] text-blue-700 italic">
                  * Estos datos aparecerán al finalizar la inscripción para que el alumno realice su transferencia.
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <DialogTitle>Registrar Cobro</DialogTitle>
            <DialogDescription className="text-white/80">Confirmando pago de {selectedReg?.fullName}</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="p-4 bg-slate-50 rounded-xl border flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase">Saldo Pendiente:</span>
              <span className="text-xl font-bold text-red-500">{pendingBalance.toLocaleString()} Gs.</span>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Monto Cobrado (Gs)</Label>
              <Input 
                type="number" 
                className={cn("h-14 text-2xl font-bold rounded-xl", isOverpaid ? "border-red-500 bg-red-50" : "bg-slate-50")} 
                value={paymentAmount} 
                onChange={(e) => setPaymentAmount(Number(e.target.value))} 
                max={pendingBalance} 
              />
            </div>
            <p className="text-[10px] text-slate-400 italic">Al confirmar, el estado del confirmando pasará a "INSCRITO" automáticamente.</p>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 font-bold text-white shadow-lg" onClick={handleProcessPayment} disabled={paymentAmount <= 0 || isOverpaid}>Confirmar Cobro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl bg-white">
          <DialogHeader className="sr-only">
            <DialogTitle>Recibo de Pago</DialogTitle>
            <DialogDescription>Comprobante de cobro de inscripción parroquial.</DialogDescription>
          </DialogHeader>
          <div className="p-10 bg-white space-y-8" id="receipt-content">
            <div className="flex items-center justify-between border-b pb-6">
              <Church className="h-10 w-10 text-primary" />
              <div className="text-right">
                <p className="text-xs font-bold text-primary uppercase">Recibo de Pago</p>
                <p className="text-[10px] text-slate-400">EMITIDO EL {new Date().toLocaleDateString()}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div><p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Inscripción a nombre de</p><p className="text-lg font-bold text-slate-900">{selectedReg?.fullName}</p></div>
              <div className="bg-slate-50 p-6 rounded-2xl border border-dashed space-y-2">
                <div className="flex justify-between text-sm"><span>Monto Abonado</span><span className="font-bold text-green-600">{paymentAmount.toLocaleString()} Gs.</span></div>
                <Separator />
                <div className="flex justify-between text-xs"><span>Saldo Restante</span><span className="font-bold text-red-500">{(pendingBalance - paymentAmount).toLocaleString()} Gs.</span></div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
            <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setIsReceiptOpen(false)}>Cerrar</Button>
            <Button className="flex-1 gap-2 rounded-xl bg-primary text-white h-11 font-bold shadow-lg" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
