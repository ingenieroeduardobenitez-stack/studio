
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Eye,
  AlertTriangle,
  FilterX,
  Download,
  Users,
  Banknote,
  ArrowRightLeft,
  FileText
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, deleteDoc } from "firebase/firestore"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

export default function RegistrationsListPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  // Filtros de estado local
  const [filterSex, setFilterSex] = useState<string>("all")
  const [filterYear, setFilterYear] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterOrigin, setFilterOrigin] = useState<string>("all")
  const [filterDay, setFilterDay] = useState<string>("all")
  const [filterMethod, setFilterMethod] = useState<string>("all")
  
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const db = useFirestore()
  const { toast } = useToast()

  useEffect(() => { 
    setMounted(true)
  }, [])

  // Consulta simple para evitar errores de índice compuesto
  const regsQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "confirmations")
  }, [db])

  const { data: rawData, loading } = useCollection(regsQuery)

  const usersQuery = useMemoFirebase(() => db ? collection(db, "users") : null, [db])
  const { data: allUsers } = useCollection(usersQuery, { once: true })

  // Procesamiento de datos en memoria (Ordenamiento y Filtrado de activos)
  const registrations = useMemo(() => {
    if (!rawData) return []
    return [...rawData]
      .filter(r => r.isArchived !== true) // Solo activos
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0))
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0))
        return dateB.getTime() - dateA.getTime() // Más nuevos primero
      })
  }, [rawData])

  const stats = useMemo(() => {
    if (!registrations) return { total: 0, masc: 0, fem: 0 }
    return {
      total: registrations.length,
      masc: registrations.filter(r => r.sexo === "M").length,
      fem: registrations.filter(r => r.sexo === "F").length
    }
  }, [registrations])

  const duplicateCis = useMemo(() => {
    if (!registrations) return new Set<string>()
    const counts: Record<string, number> = {}
    registrations.forEach(r => {
      if (r.ciNumber) {
        const cleanCi = r.ciNumber.replace(/[^0-9]/g, '')
        counts[cleanCi] = (counts[cleanCi] || 0) + 1
      }
    })
    return new Set(Object.keys(counts).filter(ci => counts[ci] > 1))
  }, [registrations])

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r: any) => {
      const cleanCi = r.ciNumber?.replace(/[^0-9]/g, '') || ""
      const matchesSearch = !searchTerm || 
        r.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        cleanCi.includes(searchTerm.replace(/[^0-9]/g, ''))
      
      const isRepetido = duplicateCis.has(cleanCi)
      
      const matchesSex = filterSex === "all" || r.sexo === filterSex
      const matchesYear = filterYear === "all" || r.catechesisYear === filterYear
      const matchesStatus = filterStatus === "all" || (filterStatus === "REPETIDO" ? isRepetido : r.status === filterStatus)
      const matchesOrigin = filterOrigin === "all" || (filterOrigin === "MANUAL" ? r.userId !== "public_registration" : r.userId === "public_registration")
      const matchesDay = filterDay === "all" || r.attendanceDay === filterDay
      const matchesMethod = filterMethod === "all" || r.paymentMethod === filterMethod

      return matchesSearch && matchesSex && matchesYear && matchesStatus && matchesOrigin && matchesDay && matchesMethod
    })
  }, [registrations, searchTerm, filterSex, filterYear, filterStatus, filterOrigin, filterDay, filterMethod, duplicateCis])

  const handleDelete = async () => {
    if (!db || !selectedReg) return
    setIsProcessing(true)
    try {
      await deleteDoc(doc(db, "confirmations", selectedReg.id));
      toast({ title: "Registro eliminado" })
      setIsDeleteDialogOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" })
    } finally { setIsProcessing(false) }
  }

  const resetFilters = () => {
    setSearchTerm("")
    setFilterSex("all")
    setFilterYear("all")
    setFilterStatus("all")
    setFilterOrigin("all")
    setFilterDay("all")
    setFilterMethod("all")
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold text-primary tracking-tight">Lista de Confirmandos</h1>
          <p className="text-muted-foreground font-medium">Listado general de postulantes del ciclo 2026.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl h-12 font-bold px-6 border-slate-200 bg-white hover:bg-slate-50 gap-2 shadow-sm" onClick={() => {
            if (filteredRegistrations.length === 0) return;
            const headers = ["Nombre", "CI", "Celular", "Año", "Dia", "Estado"];
            const rows = filteredRegistrations.map(r => [r.fullName, r.ciNumber, r.phone, r.catechesisYear, r.attendanceDay, r.status]);
            const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "lista_confirmandos.csv");
            document.body.appendChild(link);
            link.click();
          }}>
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Button asChild className="bg-primary hover:bg-primary/90 rounded-2xl h-12 font-black px-8 shadow-lg shadow-primary/20 text-white">
            <Link href="/dashboard/registration" prefetch={false}>Nueva Ficha</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-none shadow-xl bg-white rounded-3xl p-6 border-l-4 border-l-primary">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Inscritos</p>
            <Users className="h-4 w-4 text-primary opacity-40" />
          </div>
          <p className="text-4xl font-black text-slate-900 leading-none">{loading ? "..." : stats.total}</p>
        </Card>
        <Card className="border-none shadow-xl bg-white rounded-3xl p-6 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Masculinos</p>
            <div className="text-blue-500 font-black text-xs">♂</div>
          </div>
          <p className="text-4xl font-black text-slate-900 leading-none">{loading ? "..." : stats.masc}</p>
        </Card>
        <Card className="border-none shadow-xl bg-white rounded-3xl p-6 border-l-4 border-l-pink-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Femeninos</p>
            <div className="text-pink-500 font-black text-xs">♀</div>
          </div>
          <p className="text-4xl font-black text-slate-900 leading-none">{loading ? "..." : stats.fem}</p>
        </Card>
      </div>

      <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
        <CardHeader className="bg-slate-50/30 p-8 pb-0">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Buscador Principal</Label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por Nombre o C.I..." 
                  className="pl-12 h-14 rounded-2xl bg-white border-slate-200 shadow-sm text-lg" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4 pb-8 border-b border-slate-100">
              <div className="space-y-1.5 flex-1 min-w-[140px]">
                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sexo</Label>
                <Select value={filterSex} onValueChange={setFilterSex}>
                  <SelectTrigger className="h-12 rounded-2xl bg-white border-slate-200"><SelectValue placeholder="Sexo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Sexos</SelectItem>
                    <SelectItem value="M">Masculinos</SelectItem>
                    <SelectItem value="F">Femeninos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-1 min-w-[140px]">
                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nivel</Label>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger className="h-12 rounded-2xl bg-white border-slate-200"><SelectValue placeholder="Nivel" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Niveles</SelectItem>
                    <SelectItem value="PRIMER_AÑO">Primer Año</SelectItem>
                    <SelectItem value="SEGUNDO_AÑO">Segundo Año</SelectItem>
                    <SelectItem value="ADULTOS">Adultos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-1 min-w-[140px]">
                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-12 rounded-2xl bg-white border-slate-200"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Estados</SelectItem>
                    <SelectItem value="INSCRITO">Inscritos</SelectItem>
                    <SelectItem value="POR_VALIDAR">Por Validar</SelectItem>
                    <SelectItem value="REPETIDO">Solo Repetidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-1 min-w-[140px]">
                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Origen</Label>
                <Select value={filterOrigin} onValueChange={setFilterOrigin}>
                  <SelectTrigger className="h-12 rounded-2xl bg-white border-slate-200"><SelectValue placeholder="Origen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Orígenes</SelectItem>
                    <SelectItem value="MANUAL">Manual (Personal)</SelectItem>
                    <SelectItem value="PUBLICO">Público (Web)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-1 min-w-[140px]">
                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Horario</Label>
                <Select value={filterDay} onValueChange={setFilterDay}>
                  <SelectTrigger className="h-12 rounded-2xl bg-white border-slate-200"><SelectValue placeholder="Horario" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Horarios</SelectItem>
                    <SelectItem value="SABADO">Sábados</SelectItem>
                    <SelectItem value="DOMINGO">Domingos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-1 min-w-[140px]">
                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Forma de Pago</Label>
                <Select value={filterMethod} onValueChange={setFilterMethod}>
                  <SelectTrigger className="h-12 rounded-2xl bg-white border-slate-200"><SelectValue placeholder="Pago" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Métodos</SelectItem>
                    <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-100" onClick={resetFilters}>
                  <FilterX className="h-5 w-5 text-slate-400" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cargando base de datos...</p>
            </div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="py-32 text-center">
              <div className="bg-slate-50 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="h-10 w-10 text-slate-200" />
              </div>
              <p className="text-slate-500 font-bold">No se encontraron confirmandos activos.</p>
              <p className="text-slate-400 text-xs">Prueba ajustando los filtros de búsqueda.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50 border-y">
                <TableRow>
                  <TableHead className="pl-8 py-5 font-bold text-slate-500">Confirmando</TableHead>
                  <TableHead className="font-bold text-slate-500">Origen</TableHead>
                  <TableHead className="font-bold text-slate-500">Año / Nivel</TableHead>
                  <TableHead className="font-bold text-slate-500">Forma Pago</TableHead>
                  <TableHead className="text-center font-bold text-slate-500">Estado</TableHead>
                  <TableHead className="font-bold text-slate-500">Fecha Insc.</TableHead>
                  <TableHead className="text-right pr-8 font-bold text-slate-500">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg) => {
                  const cleanCi = reg.ciNumber?.replace(/[^0-9]/g, '') || ""
                  const isRepetido = duplicateCis.has(cleanCi)
                  const isManual = reg.userId !== "public_registration"
                  const creator = allUsers?.find(u => u.id === reg.userId)
                  const createdDate = reg.createdAt?.toDate ? reg.createdAt.toDate() : (reg.createdAt ? new Date(reg.createdAt) : new Date())
                  
                  return (
                    <TableRow key={reg.id} className="h-24 hover:bg-slate-50/50 transition-colors border-slate-100">
                      <TableCell className="pl-8">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12 border-2 border-white shadow-sm ring-1 ring-slate-100">
                            <AvatarImage src={reg.photoUrl} className="object-cover" />
                            <AvatarFallback className="bg-slate-50 text-slate-300 font-black"><User /></AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-base text-slate-900 uppercase tracking-tight leading-none">{reg.fullName}</span>
                              {isRepetido && (
                                <Badge className="bg-red-500 hover:bg-red-600 text-white text-[8px] font-black h-4 px-1.5 rounded-full animate-pulse">REPETIDO</Badge>
                              )}
                            </div>
                            <span className="text-sm font-bold text-blue-600 tracking-tighter mt-1">{reg.ciNumber}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{reg.phone}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant="secondary" className={cn("text-[9px] font-black tracking-widest h-5 px-2", isManual ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700")}>
                            {isManual ? "MANUAL" : "PÚBLICO"}
                          </Badge>
                          {isManual && (
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter ml-1">
                              {creator ? creator.firstName : "SISTEMA"}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-slate-200 bg-white">
                            {reg.catechesisYear?.replace("_", " ")}
                          </Badge>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                            {reg.attendanceDay}S
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-accent uppercase">
                            {reg.paymentMethod === "EFECTIVO" ? <Banknote className="h-3 w-3" /> : <ArrowRightLeft className="h-3 w-3" />}
                            {reg.paymentMethod}
                          </div>
                          <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                            {(reg.registrationCost || 35000).toLocaleString('es-PY')} Gs.
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn("h-7 px-4 rounded-full text-[10px] font-black tracking-widest border-none shadow-sm", 
                          reg.status === "POR_VALIDAR" ? "bg-amber-500 text-white" : "bg-emerald-500 text-white")}>
                          {reg.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-700 tracking-tighter">{createdDate.toLocaleDateString('es-PY')}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{createdDate.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full text-slate-300 hover:text-primary hover:bg-primary/5">
                            <Eye className="h-5 w-5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-300 hover:bg-slate-100">
                                <MoreHorizontal className="h-5 w-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[200px] p-2 rounded-2xl border-none shadow-2xl">
                              <DropdownMenuLabel className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1">Opciones</DropdownMenuLabel>
                              <DropdownMenuItem className="h-11 rounded-xl cursor-pointer gap-3" asChild>
                                <Link href="/dashboard/registration">
                                  <FileText className="h-4 w-4 text-slate-400" /> <span className="font-bold">Editar Ficha</span>
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => { setSelectedReg(reg); setIsDeleteDialogOpen(true); }} 
                                className="h-11 rounded-xl text-destructive focus:bg-red-50 focus:text-destructive cursor-pointer gap-3"
                              >
                                <Trash2 className="h-4 w-4" /> <span className="font-bold">Eliminar Permanentemente</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-red-600 p-8 text-white">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
            <AlertDialogTitle className="text-2xl font-black text-center uppercase tracking-tight">¿Confirmar Eliminación?</AlertDialogTitle>
          </div>
          <div className="p-8 space-y-4">
            <AlertDialogDescription className="text-center text-slate-600 font-medium">
              Esta acción es irreversible. Se borrará permanentemente la ficha de <br/>
              <strong className="text-slate-900 font-black text-lg">"{selectedReg?.fullName}"</strong> <br/>
              incluyendo fotos y registros asociados.
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter className="p-8 bg-slate-50 gap-3 border-t">
            <AlertDialogCancel className="rounded-2xl h-14 font-black flex-1 border-slate-200">CANCELAR</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white rounded-2xl h-14 font-black flex-1 shadow-xl shadow-red-100" onClick={handleDelete} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : "ELIMINAR AHORA"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
