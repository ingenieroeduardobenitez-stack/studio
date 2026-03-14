
"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { 
  Wallet, 
  Settings, 
  Search, 
  Loader2, 
  CreditCard, 
  FileText, 
  User, 
  Church, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Receipt, 
  Eye,
  ImageIcon,
  FilterX
} from "lucide-react"
import { useFirestore, useCollection, useDoc, useMemoFirebase, useUser } from "@/firebase"
import { collection, doc, setDoc, serverTimestamp, deleteDoc, addDoc, runTransaction, query, orderBy, limit } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function TreasuryPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterYear, setFilterYear] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [isCostSaving, setIsCostSaving] = useState(false)
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string>("ACCOUNT")

  const { user: currentUser } = useUser()
  const { toast } = useToast()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const treasuryRef = useMemoFirebase(() => db ? doc(db, "settings", "treasury") : null, [db])
  const { data: costs } = useDoc(treasuryRef)

  const regsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "confirmations"), orderBy("createdAt", "desc"), limit(100))
  }, [db])
  const { data: registrations, loading: loadingRegs } = useCollection(regsQuery)

  const userProfileRef = useMemoFirebase(() => db && currentUser?.uid ? doc(db, "users", currentUser.uid) : null, [db, currentUser?.uid])
  const { data: profile } = useDoc(userProfileRef)

  useEffect(() => {
    if (costs?.paymentMethod) {
      setPaymentMethod(costs.paymentMethod)
    }
  }, [costs])

  const filteredRegs = useMemo(() => {
    if (!registrations) return []
    return registrations.filter(reg => {
      if (reg.isArchived) return false
      const matchesSearch = !searchTerm || 
        reg.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        reg.ciNumber?.includes(searchTerm)
      const matchesYear = filterYear === "all" || reg.catechesisYear === filterYear
      const matchesStatus = filterStatus === "all" || reg.status === filterStatus
      return matchesSearch && matchesYear && matchesStatus
    })
  }, [registrations, searchTerm, filterYear, filterStatus])

  const handleUpdateCosts = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !treasuryRef) return
    setIsCostSaving(true)
    const formData = new FormData(e.currentTarget)
    const data: any = {
      juvenileCost: Number(formData.get("juvenile")),
      adultCost: Number(formData.get("adult")),
      paymentMethod: paymentMethod,
      updatedAt: serverTimestamp()
    }
    try {
      await setDoc(treasuryRef, data, { merge: true })
      toast({ title: "Configuración guardada" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setIsCostSaving(false)
    }
  }

  const handleProcessPayment = async () => {
    if (!db || !selectedReg || isSubmittingPayment || !treasuryRef) return
    setIsSubmittingPayment(true)
    const regRef = doc(db, "confirmations", selectedReg.id)
    const catechistName = profile ? `${profile.firstName} ${profile.lastName}` : "Tesorero"
    try {
      await runTransaction(db, async (transaction) => {
        const treasurySnap = await transaction.get(treasuryRef);
        const regSnap = await transaction.get(regRef);
        if (!regSnap.exists()) throw "Error";
        
        const currentNext = treasurySnap.exists() ? (treasurySnap.data()?.nextReceiptNumber || 1) : 1;
        const formattedReceipt = `001-001-${String(currentNext).padStart(7, '0')}`;
        const newPaid = (regSnap.data().amountPaid || 0) + paymentAmount;
        const regCost = regSnap.data().registrationCost || (regSnap.data().catechesisYear === "ADULTOS" ? 50000 : 35000);
        
        transaction.update(regRef, { 
          amountPaid: newPaid, 
          paymentStatus: newPaid >= regCost ? "PAGADO" : "PARCIAL", 
          status: "INSCRITO",
          receiptNumber: formattedReceipt,
          validatedBy: catechistName,
          lastPaymentDate: serverTimestamp()
        });
        transaction.update(treasuryRef, { nextReceiptNumber: currentNext + 1 });
      });
      toast({ title: "Pago confirmado" })
      setIsPaymentDialogOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Error al procesar" })
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4">
        <div className="bg-primary/10 p-3 rounded-2xl"><Church className="h-8 w-8 text-primary" /></div>
        <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Tesorería</h1>
      </div>

      <Tabs defaultValue="pagos" className="w-full">
        <TabsList className="mb-6"><TabsTrigger value="pagos">Inscripciones</TabsTrigger><TabsTrigger value="config">Ajustes</TabsTrigger></TabsList>

        <TabsContent value="pagos" className="space-y-6">
          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b">
              <div className="flex gap-4">
                <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar..." className="pl-9 h-11 bg-white rounded-xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/30"><TableRow><TableHead className="pl-8">Confirmando</TableHead><TableHead className="text-center">Estado</TableHead><TableHead className="text-right pr-8">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredRegs.map((reg) => (
                    <TableRow key={reg.id} className="h-16">
                      <TableCell className="pl-8"><div className="flex items-center gap-3"><Avatar className="h-9 w-9 border"><AvatarImage src={reg.photoUrl} /><AvatarFallback><User /></AvatarFallback></Avatar><div className="flex flex-col"><span className="font-bold text-sm">{reg.fullName}</span></div></div></TableCell>
                      <TableCell className="text-center">{reg.paymentStatus}</TableCell>
                      <TableCell className="text-right pr-8"><Button size="sm" variant="outline" onClick={() => { setSelectedReg(reg); setPaymentAmount((reg.registrationCost || 35000) - (reg.amountPaid || 0)); setIsPaymentDialogOpen(true); }}>Cobrar</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <Card className="max-w-xl">
            <CardHeader><CardTitle>Costos Institucionales</CardTitle></CardHeader>
            <form onSubmit={handleUpdateCosts}>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Arancel Juvenil (Gs)</Label><Input name="juvenile" type="number" defaultValue={costs?.juvenileCost || 35000} /></div>
                <div className="space-y-2"><Label>Arancel Adultos (Gs)</Label><Input name="adult" type="number" defaultValue={costs?.adultCost || 50000} /></div>
              </CardContent>
              <CardFooter><Button type="submit" disabled={isCostSaving}>{isCostSaving ? <Loader2 className="animate-spin h-4 w-4" /> : "Guardar Ajustes"}</Button></CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Confirmar Cobro</DialogTitle><DialogDescription>Registra el ingreso de {selectedReg?.fullName}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Monto Recibido</Label>
            <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} className="text-xl font-bold" />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button><Button onClick={handleProcessPayment} disabled={isSubmittingPayment}>Confirmar Pago</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatYear(year: string) {
  switch (year) {
    case "PRIMER_AÑO": return "1° Año"; case "SEGUNDO_AÑO": return "2° Año"; case "ADULTOS": return "Adultos"; default: return year;
  }
}
