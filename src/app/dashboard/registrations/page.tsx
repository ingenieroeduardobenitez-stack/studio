
"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Search, 
  Loader2, 
  MoreHorizontal, 
  User, 
  Trash2, 
  CheckCircle2, 
  ImageIcon,
  Edit,
  Save,
  Wallet,
  Download,
  FilterX,
  Maximize2,
  Printer,
  ChevronRight,
  MessageCircle,
  Receipt,
  Eye,
  Users,
  Venus,
  Mars,
  FileText,
  Church,
  Calendar,
  Phone,
  BookOpen,
  X,
  Globe,
  Clock,
  ZoomIn,
  ZoomOut,
  Camera,
  FlipHorizontal,
  UserX,
  Shapes,
  Info,
  AlertTriangle,
  ArrowDown
} from "lucide-react"
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase"
import { collection, doc, updateDoc, deleteDoc, serverTimestamp, addDoc, runTransaction, query, orderBy, limit, startAfter, getDocs, where, increment } from "firebase/firestore"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { ScrollArea } from "@/components/ui/scroll-area"
import { QRCodeCanvas } from "qrcode.react"
import Image from "next/image"

const PAGE_SIZE = 20;

export default function RegistrationsListPage() {
  const [mounted, setMounted] = useState(false)
  const [registrations, setRegistrations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const [hasMore, setHasMore] = useState(true)
  
  const [searchTerm, setSearchTerm] = useState("")
  const [filterSex, setFilterSex] = useState("all")
  const [filterYear, setFilterYear] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterDay, setFilterDay] = useState("all")

  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isValidationOpen, setIsValidationOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [valAmount, setValAmount] = useState(0)

  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()

  useEffect(() => { setMounted(true); fetchInitialData(); }, [db])

  // LÓGICA DE PAGINACIÓN Y BÚSQUEDA
  const fetchInitialData = async () => {
    if (!db) return
    setIsLoading(true)
    try {
      const q = query(collection(db, "confirmations"), where("isArchived", "==", false), orderBy("createdAt", "desc"), limit(PAGE_SIZE))
      const snap = await getDocs(q)
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setRegistrations(data)
      setLastDoc(snap.docs[snap.docs.length - 1])
      setHasMore(snap.docs.length === PAGE_SIZE)
    } finally { setIsLoading(false) }
  }

  const loadMore = async () => {
    if (!db || !lastDoc || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const q = query(collection(db, "confirmations"), where("isArchived", "==", false), orderBy("createdAt", "desc"), startAfter(lastDoc), limit(PAGE_SIZE))
      const snap = await getDocs(q)
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setRegistrations(prev => [...prev, ...data])
      setLastDoc(snap.docs[snap.docs.length - 1])
      setHasMore(snap.docs.length === PAGE_SIZE)
    } finally { setIsLoadingMore(false) }
  }

  const handleSearch = async () => {
    if (!db || !searchTerm) { fetchInitialData(); return; }
    setIsLoading(true)
    try {
      const q = query(collection(db, "confirmations"), where("isArchived", "==", false), orderBy("fullName"), limit(50))
      const snap = await getDocs(q)
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // Filtrado local para "contiene"
      const filtered = data.filter((r: any) => 
        r.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.ciNumber?.includes(searchTerm)
      )
      setRegistrations(filtered)
      setHasMore(false)
    } finally { setIsLoading(false) }
  }

  const handleDelete = async () => {
    if (!db || !selectedReg) return
    setIsProcessing(true)
    try {
      const regRef = doc(db, "confirmations", selectedReg.id);
      const statsRef = doc(db, "settings", "stats");
      
      await runTransaction(db, async (transaction) => {
        transaction.delete(regRef);
        const updateObj: any = { total: increment(-1) };
        if (selectedReg.catechesisYear === "PRIMER_AÑO") {
          updateObj.firstYear = increment(-1);
          if (selectedReg.attendanceDay === "SABADO") updateObj.firstYearSabado = increment(-1); else updateObj.firstYearDomingo = increment(-1);
        } else if (selectedReg.catechesisYear === "SEGUNDO_AÑO") {
          updateObj.secondYear = increment(-1);
          if (selectedReg.attendanceDay === "SABADO") updateObj.secondYearSabado = increment(-1); else updateObj.secondYearDomingo = increment(-1);
        } else if (selectedReg.catechesisYear === "ADULTOS") {
          updateObj.adults = increment(-1);
          if (selectedReg.attendanceDay === "SABADO") updateObj.adultsSabado = increment(-1); else updateObj.adultsDomingo = increment(-1);
        }
        transaction.update(statsRef, updateObj);
      });

      setRegistrations(prev => prev.filter(r => r.id !== selectedReg.id))
      toast({ title: "Registro eliminado y estadísticas actualizadas" })
      setIsDeleteDialogOpen(false)
    } finally { setIsProcessing(false) }
  }

  const statsRef = useMemoFirebase(() => db ? doc(db, "settings", "stats") : null, [db])
  const { data: globalStats } = useDoc(statsRef)

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Lista de Confirmandos</h1>
          <p className="text-muted-foreground">Listado institucional (Total Global: {globalStats?.total || 0})</p>
        </div>
        <div className="flex gap-2">
          <Button asChild className="bg-primary hover:bg-primary/90 rounded-xl h-11 font-bold px-6 shadow-lg shadow-primary/20"><Link href="/dashboard/registration" prefetch={false}>Nueva Ficha</Link></Button>
        </div>
      </div>

      <Card className="border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b p-6 space-y-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Buscar por Nombre o C.I..." className="pl-10 h-12 rounded-xl bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
            </div>
            <Button onClick={handleSearch} className="h-12 rounded-xl font-bold px-8">BUSCAR</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="pl-8 font-bold">Confirmando</TableHead>
                  <TableHead className="font-bold">Nivel</TableHead>
                  <TableHead className="font-bold">Día</TableHead>
                  <TableHead className="font-bold">Estado</TableHead>
                  <TableHead className="text-right pr-8 font-bold">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.map((reg) => (
                  <TableRow key={reg.id} className="h-20 hover:bg-slate-50/50">
                    <TableCell className="pl-8">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10 border shadow-sm"><AvatarImage src={reg.photoUrl} className="object-cover" /><AvatarFallback><User /></AvatarFallback></Avatar>
                        <div className="flex flex-col"><span className="font-bold text-sm text-slate-900 uppercase">{reg.fullName}</span><span className="text-[10px] font-black text-primary">{reg.ciNumber}</span></div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[9px] uppercase">{reg.catechesisYear?.replace("_", " ")}</Badge></TableCell>
                    <TableCell><span className="text-[10px] font-bold text-slate-500 uppercase">{reg.attendanceDay}</span></TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-[9px]", reg.status === "POR_VALIDAR" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600")}>{reg.status}</Badge></TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => { setSelectedReg(reg); setIsDetailsDialogOpen(true); }}><Eye className="h-4 w-4" /></Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[180px] p-2 rounded-xl">
                            <DropdownMenuItem onClick={() => { setSelectedReg(reg); setIsDeleteDialogOpen(true); }} className="h-10 rounded-lg text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Eliminar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {hasMore && !searchTerm && (
            <div className="p-6 flex justify-center bg-slate-50 border-t">
              <Button variant="outline" onClick={loadMore} disabled={isLoadingMore} className="rounded-xl font-bold h-11 px-10 gap-2">
                {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDown className="h-4 w-4" />}
                CARGAR MÁS CONFIRMANDOS
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle><AlertDialogDescription>Se borrarán los datos y se ajustarán las estadísticas globales automáticamente.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-white" onClick={handleDelete} disabled={isProcessing}>{isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : "Confirmar Eliminación"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
