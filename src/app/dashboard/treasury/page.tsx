
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Wallet, Settings, Search, Loader2, CreditCard, Printer, FileText, CheckCircle2, User, Church, AlertTriangle } from "lucide-react"
import { useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase"
import { collection, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export default function TreasuryPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isCostSaving, setIsCostSaving] = useState(false)
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)

  const { toast } = useToast()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const treasuryRef = useMemo(() => db ? doc(db, "settings", "treasury") : null, [db])
  const { data: costs, loading: loadingCosts } = useDoc(treasuryRef)

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
    const data = {
      juvenileCost: Number(formData.get("juvenile")),
      adultCost: Number(formData.get("adult")),
      updatedAt: serverTimestamp()
    }

    setDoc(treasuryRef, data, { merge: true })
      .then(() => {
        toast({ title: "Costos actualizados", description: "Los nuevos montos se han guardado." })
      })
      .catch(() => toast({ variant: "destructive", title: "Error", description: "No se pudo guardar." }))
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
      toast({
        variant: "destructive",
        title: "Monto excedido",
        description: `No puedes cobrar más del saldo pendiente (${pendingBalance.toLocaleString()} Gs).`
      })
      return
    }

    const newPaid = (selectedReg.amountPaid || 0) + paymentAmount
    const total = selectedReg.registrationCost || 0
    const status = newPaid >= total ? "PAGADO" : "PARCIAL"

    const regRef = doc(db, "confirmations", selectedReg.id)
    updateDoc(regRef, {
      amountPaid: newPaid,
      paymentStatus: status,
      lastPaymentDate: serverTimestamp()
    })
      .then(() => {
        toast({ title: "Pago registrado", description: `Se abonó ${paymentAmount.toLocaleString()} Gs.` })
        setIsPaymentDialogOpen(false)
        setIsReceiptOpen(true)
      })
      .catch(() => toast({ variant: "destructive", title: "Error", description: "No se pudo procesar." }))
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Tesoreria Parroquial</h1>
          <p className="text-muted-foreground">Control de aranceles, cobros y saldos pendientes.</p>
        </div>
      </div>

      <Tabs defaultValue="pagos" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6">
          <TabsTrigger value="pagos" className="gap-2"><CreditCard className="h-4 w-4" /> Pagos</TabsTrigger>
          <TabsTrigger value="config" className="gap-2"><Settings className="h-4 w-4" /> Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="pagos">
          <Card className="border-none shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Control de Inscripciones</CardTitle>
                  <CardDescription>Lista de confirmandos y estado de sus cuentas.</CardDescription>
                </div>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por nombre o C.I." 
                    className="pl-9 bg-white" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingRegs ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : filteredRegs.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">No se encontraron registros.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-transparent">
                      <TableHead className="font-bold">Confirmando</TableHead>
                      <TableHead className="font-bold">Categoría</TableHead>
                      <TableHead className="font-bold">Total</TableHead>
                      <TableHead className="font-bold">Abonado</TableHead>
                      <TableHead className="font-bold">Saldo</TableHead>
                      <TableHead className="font-bold">Estado</TableHead>
                      <TableHead className="text-right font-bold">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegs.map((reg) => {
                      const pending = (reg.registrationCost || 0) - (reg.amountPaid || 0)
                      return (
                        <TableRow key={reg.id} className="hover:bg-slate-50/30">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8"><AvatarImage src={reg.photoUrl} /><AvatarFallback><User className="h-4 w-4" /></AvatarFallback></Avatar>
                              <div className="flex flex-col"><span className="font-bold text-sm">{reg.fullName}</span><span className="text-[10px] text-muted-foreground">{reg.ciNumber}</span></div>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px] uppercase">{reg.catechesisYear?.replace("_", " ")}</Badge></TableCell>
                          <TableCell className="font-medium">{reg.registrationCost?.toLocaleString()} Gs.</TableCell>
                          <TableCell className="text-green-600 font-bold">{reg.amountPaid?.toLocaleString()} Gs.</TableCell>
                          <TableCell className={cn("font-bold", pending > 0 ? "text-red-500" : "text-slate-400")}>
                            {pending > 0 ? `${pending.toLocaleString()} Gs.` : "Saldado"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={reg.paymentStatus === "PAGADO" ? "default" : reg.paymentStatus === "PARCIAL" ? "secondary" : "outline"} className={cn(reg.paymentStatus === "PAGADO" ? "bg-green-500" : "")}>
                              {reg.paymentStatus || "PENDIENTE"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {pending > 0 && (
                                <Button size="sm" variant="outline" className="h-8 gap-2" onClick={() => handleOpenPayment(reg)}>
                                  <Wallet className="h-3 w-3" /> Cobrar
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setSelectedReg(reg); setIsReceiptOpen(true); }}>
                                <FileText className="h-4 w-4" />
                              </Button>
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
          <Card className="border-none shadow-xl max-w-2xl mx-auto">
            <CardHeader className="bg-primary text-white">
              <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Montos de Inscripción</CardTitle>
              <CardDescription className="text-white/80">Define los costos base que se aplicarán en el formulario de registro.</CardDescription>
            </CardHeader>
            <form onSubmit={handleUpdateCosts}>
              <CardContent className="p-8 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="juvenile" className="font-bold">Confirmación Juvenil (Gs)</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="juvenile" name="juvenile" type="number" defaultValue={costs?.juvenileCost || 35000} className="pl-10 h-12 rounded-xl" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adult" className="font-bold">Catequesis Adultos (Gs)</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="adult" name="adult" type="number" defaultValue={costs?.adultCost || 50000} className="pl-10 h-12 rounded-xl" required />
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 p-6 border-t flex justify-end">
                <Button type="submit" disabled={isCostSaving} className="h-11 px-8 rounded-xl font-bold shadow-lg">
                  {isCostSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
                  Guardar Configuración
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOGO DE COBRO */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Registrar Cobro</DialogTitle>
            <DialogDescription>Abono para {selectedReg?.fullName}</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border space-y-2">
              <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase"><span>Total Deuda</span><span>Pendiente</span></div>
              <div className="flex justify-between text-lg font-bold">
                <span>{selectedReg?.registrationCost?.toLocaleString()} Gs.</span>
                <span className="text-red-500">{pendingBalance.toLocaleString()} Gs.</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Monto a cobrar ahora</Label>
              <Input 
                type="number" 
                className={cn(
                  "h-12 text-xl font-bold rounded-xl",
                  isOverpaid ? "border-red-500 bg-red-50" : ""
                )}
                value={paymentAmount} 
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                max={pendingBalance}
                autoFocus
              />
              {isOverpaid && (
                <p className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> No puede superar el saldo pendiente.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleProcessPayment} disabled={paymentAmount <= 0 || isOverpaid}>Confirmar Cobro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOGO DE RECIBO */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none">
          <div className="p-10 bg-white space-y-8" id="receipt-content">
            <div className="flex items-center justify-between border-b pb-6">
              <div className="flex items-center gap-2">
                <Church className="h-8 w-8 text-primary" />
                <div><h3 className="font-headline font-bold text-lg">PARROQUIA</h3><p className="text-[10px] text-muted-foreground uppercase tracking-widest">Perpetuo Socorro</p></div>
              </div>
              <div className="text-right"><p className="text-xs font-bold uppercase">Recibo de Pago</p><p className="text-[10px] text-muted-foreground">ID: {selectedReg?.id?.slice(-8)}</p></div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-[10px] text-muted-foreground uppercase font-bold">Concepto</p><p className="text-sm font-bold">Inscripción {selectedReg?.catechesisYear?.replace("_", " ")}</p></div>
                <div><p className="text-[10px] text-muted-foreground uppercase font-bold">Fecha</p><p className="text-sm font-bold">{new Date().toLocaleDateString()}</p></div>
              </div>
              <div><p className="text-[10px] text-muted-foreground uppercase font-bold">Confirmando</p><p className="text-base font-bold text-primary">{selectedReg?.fullName}</p><p className="text-xs text-muted-foreground">C.I. {selectedReg?.ciNumber}</p></div>
              
              <div className="bg-slate-50 p-6 rounded-2xl border space-y-4">
                <div className="flex justify-between text-xs border-b pb-2"><span>Monto Total Arancel</span><span className="font-bold">{selectedReg?.registrationCost?.toLocaleString()} Gs.</span></div>
                <div className="flex justify-between text-xs border-b pb-2"><span>Monto Abonado</span><span className="font-bold text-green-600">{selectedReg?.amountPaid?.toLocaleString()} Gs.</span></div>
                <div className="flex justify-between text-sm pt-2 font-bold"><span>Saldo Pendiente</span><span className="text-red-500">{((selectedReg?.registrationCost || 0) - (selectedReg?.amountPaid || 0)).toLocaleString()} Gs.</span></div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 pt-6 border-t border-dashed">
              <div className="h-10 w-40 border-b border-slate-300"></div>
              <p className="text-[10px] text-muted-foreground uppercase">Sello y Firma Tesorería</p>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t">
            <Button variant="outline" className="flex-1" onClick={() => setIsReceiptOpen(false)}>Cerrar</Button>
            <Button className="flex-1 gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir Recibo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
