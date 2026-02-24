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
import { Wallet, Settings, Search, Loader2, CreditCard, FileText, User, Church, QrCode, Info, Copy } from "lucide-react"
import { useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase"
import { collection, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { QRCodeCanvas } from "qrcode.react"
import { cn } from "@/lib/utils"

/**
 * MOTOR PY-QR ESTÁNDAR BCP (COMPATIBILIDAD UENO / BNF / FAMILIAR / ITAU)
 */
const cleanS = (s: string) => {
  if (!s) return "";
  return s.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
    .replace(/[^a-zA-Z0-9 ]/g, "") // Solo alfanumérico
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
};

const formatTag = (tag: string, value: string) => {
  const len = value.length.toString().padStart(2, '0');
  return tag + len + value;
};

const generatePyQr = ({ alias, bankName, accountNumber, accountOwner, amount, concept }: any) => {
  try {
    let payload = "";
    payload += formatTag("00", "01"); // Payload Format Indicator
    payload += formatTag("01", "12"); // Method (12 = Dynamic with amount)

    // Tag 26: Merchant Account Information (SIPAP/SPI Paraguay)
    let merchantInfo = formatTag("00", "py.gov.bcp.spi");
    if (alias) {
      const cleanAlias = alias.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      merchantInfo += formatTag("01", cleanAlias);
    } else if (accountNumber) {
      const cleanAcc = accountNumber.replace(/[^0-9]/g, '');
      merchantInfo += formatTag("01", cleanAcc);
      if (bankName) {
        merchantInfo += formatTag("02", cleanS(bankName).substring(0, 10));
      }
    }
    payload += formatTag("26", merchantInfo);

    payload += formatTag("52", "8661"); // MCC: Organizaciones Religiosas
    payload += formatTag("53", "600");  // Currency PYG
    
    if (amount > 0) {
      payload += formatTag("54", Math.floor(amount).toString()); 
    }

    payload += formatTag("58", "PY");   
    payload += formatTag("59", cleanS(accountOwner || "PARROQUIA").substring(0, 25)); 
    payload += formatTag("60", "ASUNCION"); 

    const cleanConcept = cleanS(concept || "INSCRIPCION").substring(0, 20);
    payload += formatTag("62", formatTag("05", cleanConcept));

    payload += "6304"; 

    // CRC-16/CCITT-FALSE
    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : (crc << 1);
      }
    }
    const finalCrc = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    payload += finalCrc;

    return payload;
  } catch (e) {
    return "";
  }
};

export default function TreasuryPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isCostSaving, setIsCostSaving] = useState(false)
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [showPaymentQr, setShowPaymentQr] = useState(false)
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
        toast({ title: "Configuración actualizada" })
      })
      .catch(() => toast({ variant: "destructive", title: "Error" }))
      .finally(() => setIsCostSaving(false))
  }

  const handleOpenPayment = (reg: any) => {
    setSelectedReg(reg)
    setPaymentAmount(0)
    setShowPaymentQr(false)
    setIsPaymentDialogOpen(true)
  }

  const pendingBalance = selectedReg ? (selectedReg.registrationCost || 0) - (selectedReg.amountPaid || 0) : 0
  const isOverpaid = paymentAmount > pendingBalance

  const qrPaymentData = useMemo(() => {
    if (!costs || !selectedReg || paymentAmount <= 0) return ""
    return generatePyQr({
      alias: costs.paymentMethod === "ALIAS" ? costs.alias : null,
      bankName: costs.bankName,
      accountNumber: costs.accountNumber,
      accountOwner: costs.accountOwner,
      amount: paymentAmount,
      concept: `INS ${selectedReg.fullName}`
    });
  }, [costs, selectedReg, paymentAmount])

  const handleProcessPayment = async () => {
    if (!db || !selectedReg) return
    if (isOverpaid) {
      toast({ variant: "destructive", title: "Monto excedido" })
      return
    }
    const newPaid = (selectedReg.amountPaid || 0) + paymentAmount
    const status = newPaid >= (selectedReg.registrationCost || 0) ? "PAGADO" : "PARCIAL"
    updateDoc(doc(db, "confirmations", selectedReg.id), {
      amountPaid: newPaid,
      paymentStatus: status,
      lastPaymentDate: serverTimestamp()
    })
      .then(() => {
        toast({ title: "Pago registrado" })
        setIsPaymentDialogOpen(false)
        setIsReceiptOpen(true)
      })
      .catch(() => toast({ variant: "destructive", title: "Error" }))
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
          <p className="text-muted-foreground">Control administrativo de cobros y pagos.</p>
        </div>
      </div>

      <Tabs defaultValue="pagos" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[600px] mb-6">
          <TabsTrigger value="pagos" className="gap-2"><CreditCard className="h-4 w-4" /> Pagos</TabsTrigger>
          <TabsTrigger value="eventos" className="gap-2"><Wallet className="h-4 w-4" /> Otros Ingresos</TabsTrigger>
          <TabsTrigger value="config" className="gap-2"><Settings className="h-4 w-4" /> Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="pagos">
          <Card className="border-none shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle>Control de Inscripciones</CardTitle>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar..." className="pl-9 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                      <TableHead className="font-bold">Confirmando</TableHead>
                      <TableHead className="font-bold text-center">Estado</TableHead>
                      <TableHead className="font-bold text-center">Saldo</TableHead>
                      <TableHead className="text-right font-bold pr-8">Acciones</TableHead>
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
                              {pending > 0 && <Button size="sm" variant="outline" className="h-8 gap-2" onClick={() => handleOpenPayment(reg)}><Wallet className="h-3 w-3" /> Cobrar</Button>}
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
            <Card className="border-none shadow-xl">
              <CardHeader className="bg-primary text-white">
                <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Configuración de Pagos</CardTitle>
              </CardHeader>
              <form onSubmit={handleUpdateCosts}>
                <CardContent className="p-8 space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label>Juvenil (Gs)</Label><Input name="juvenile" type="number" defaultValue={costs?.juvenileCost || 35000} className="h-11 rounded-xl" required /></div>
                    <div className="space-y-2"><Label>Adultos (Gs)</Label><Input name="adult" type="number" defaultValue={costs?.adultCost || 50000} className="h-11 rounded-xl" required /></div>
                  </div>
                  <Separator />
                  <div className="space-y-6">
                    <Label className="text-primary font-bold uppercase text-xs">Modo de Cobro</Label>
                    <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="flex gap-6 p-4 bg-slate-50 rounded-2xl border">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="ACCOUNT" id="mode-acc" /><Label htmlFor="mode-acc" className="font-bold cursor-pointer">Cuenta</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="ALIAS" id="mode-ali" /><Label htmlFor="mode-ali" className="font-bold cursor-pointer">Alias</Label></div>
                    </RadioGroup>
                    <div className="grid gap-4 p-6 border rounded-2xl bg-white shadow-sm">
                      {paymentMethod === "ALIAS" ? (
                        <>
                          <div className="space-y-2"><Label>Alias de Transferencia</Label><Input name="alias" defaultValue={costs?.alias} placeholder="Ej. 0981123456" className="h-12 rounded-xl font-bold text-primary" required /></div>
                          <div className="space-y-2"><Label>Titular</Label><Input name="accountOwner" defaultValue={costs?.accountOwner} className="h-12 rounded-xl" required /></div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-2"><Label>Banco</Label><Input name="bankName" defaultValue={costs?.bankName} className="h-10 rounded-lg" /></div>
                          <div className="space-y-2"><Label>N° Cuenta</Label><Input name="accountNumber" defaultValue={costs?.accountNumber} className="h-10 rounded-lg" /></div>
                          <div className="space-y-2"><Label>Titular</Label><Input name="accountOwner" defaultValue={costs?.accountOwner} className="h-10 rounded-lg" /></div>
                          <div className="space-y-2"><Label>C.I. Titular</Label><Input name="ownerCi" defaultValue={costs?.ownerCi} className="h-10 rounded-lg" /></div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-slate-50 p-6 border-t flex justify-end">
                  <Button type="submit" disabled={isCostSaving} className="h-11 px-8 rounded-xl font-bold shadow-lg">
                    {isCostSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Guardar Cambios"}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            <Card className="border-none shadow-xl bg-slate-50 p-8 flex flex-col items-center justify-center space-y-6">
              <div className="bg-white p-8 rounded-3xl border shadow-md w-full max-w-[350px] space-y-6 text-center">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto"><Wallet className="h-8 w-8 text-green-600" /></div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400 font-bold uppercase">Vista Previa Postulante</p>
                  <p className="text-xl font-black text-primary uppercase">{paymentMethod === "ALIAS" ? costs?.alias : costs?.accountNumber || "---"}</p>
                  <p className="text-xs text-slate-500 font-medium">{costs?.accountOwner || "---"}</p>
                </div>
                <div className="p-4 border-2 border-dashed rounded-2xl flex flex-col items-center gap-2">
                  <QrCode className="h-20 w-20 text-slate-200" />
                  <p className="text-[9px] font-bold text-slate-400">QR SPI NACIONAL HABILITADO</p>
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
            <DialogDescription className="text-white/80">Pago para {selectedReg?.fullName}</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="p-4 bg-slate-50 rounded-xl border flex justify-between items-center"><span className="text-xs font-bold text-slate-400 uppercase">Saldo Pendiente:</span><span className="text-xl font-bold text-red-500">{pendingBalance.toLocaleString()} Gs.</span></div>
            <div className="space-y-2">
              <Label className="font-bold">Monto a cobrar ahora</Label>
              <Input type="number" className={cn("h-14 text-2xl font-bold rounded-xl", isOverpaid ? "border-red-500 bg-red-50" : "bg-slate-50")} value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} max={pendingBalance} />
            </div>
            {paymentAmount > 0 && (
              <div className="pt-2">
                {!showPaymentQr ? (
                  <Button variant="outline" className="w-full h-12 rounded-xl gap-2 font-bold" onClick={() => setShowPaymentQr(true)}><QrCode className="h-4 w-4" /> Generar PY-QR Estándar</Button>
                ) : (
                  <div className="flex flex-col items-center bg-slate-50 p-6 rounded-2xl border border-primary/10 animate-in zoom-in-95">
                    <div className="bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded-full mb-3 uppercase tracking-tighter">PY-QR VÁLIDO PARA PAGO</div>
                    <QRCodeCanvas value={qrPaymentData} size={180} level="M" />
                    <div className="mt-4 w-full space-y-2">
                      <div className="p-2 bg-blue-50 rounded-lg border border-blue-100 flex items-center gap-2 text-[9px] text-blue-700 leading-none">
                        <Info className="h-3 w-3" /> Compatible con Ueno, Itaú, BNF y todos los bancos.
                      </div>
                      <div className="bg-white p-3 rounded-xl border space-y-1">
                        <div className="flex justify-between text-[10px]"><span className="text-slate-400 font-bold uppercase">Alias:</span><span className="font-black text-primary">{costs?.alias}</span></div>
                        <div className="flex justify-between text-[10px]"><span className="text-slate-400 font-bold uppercase">Monto:</span><span className="font-bold text-green-600">{paymentAmount.toLocaleString()} Gs.</span></div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="mt-2 text-[10px]" onClick={() => setShowPaymentQr(false)}>Ocultar QR</Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 font-bold text-white shadow-lg" onClick={handleProcessPayment} disabled={paymentAmount <= 0 || isOverpaid}>Confirmar Cobro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-10 bg-white space-y-8" id="receipt-content">
            <div className="flex items-center justify-between border-b pb-6">
              <Church className="h-10 w-10 text-primary" />
              <div className="text-right"><p className="text-xs font-bold text-primary uppercase">Recibo de Pago</p></div>
            </div>
            <div className="space-y-4">
              <div><p className="text-[10px] text-muted-foreground uppercase">Confirmando</p><p className="text-lg font-bold text-primary">{selectedReg?.fullName}</p></div>
              <div className="bg-slate-50 p-6 rounded-2xl border border-dashed space-y-2">
                <div className="flex justify-between text-sm"><span>Monto Abonado</span><span className="font-bold text-green-600">{paymentAmount.toLocaleString()} Gs.</span></div>
                <Separator />
                <div className="flex justify-between text-xs"><span>Saldo</span><span className="font-bold text-red-500">{(pendingBalance - paymentAmount).toLocaleString()} Gs.</span></div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsReceiptOpen(false)}>Cerrar</Button>
            <Button className="flex-1 gap-2 rounded-xl bg-primary text-white" onClick={() => window.print()}>Imprimir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
