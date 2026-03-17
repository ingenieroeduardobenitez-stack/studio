
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
  CheckCircle2,
  Filter,
  Download,
  Receipt
} from "lucide-react"
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase"
import { collection, doc, deleteDoc, query, where, limit, orderBy } from "firebase/firestore"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"

export default function RegistrationsListPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const db = useFirestore()
  const { toast } = useToast()

  useEffect(() => { 
    setMounted(true)
  }, [])

  // Consulta estándar para recuperar datos rápidamente
  const regsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, "confirmations"), 
      limit(300)
    )
  }, [db])

  const { data: registrations, loading } = useCollection(regsQuery)

  // Identificar duplicados por CI
  const duplicateCis = useMemo(() => {
    if (!registrations) return new Set<string>()
    const counts: Record<string, number> = {}
    registrations.forEach(r => {
      if (r.ciNumber && !r.isArchived) {
        counts[r.ciNumber] = (counts[r.ciNumber] || 0) + 1
      }
    })
    return new Set(Object.keys(counts).filter(ci => counts[ci] > 1))
  }, [registrations])

  const filteredRegistrations = useMemo(() => {
    if (!registrations) return []
    return registrations.filter((r: any) => {
      const matchesSearch = !searchTerm || 
        r.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.ciNumber?.includes(searchTerm)
      
      const isRepetido = duplicateCis.has(r.ciNumber)
      const matchesStatus = filterStatus === "all" || 
        (filterStatus === "REPETIDO" ? isRepetido : r.status === filterStatus)

      return matchesSearch && matchesStatus && !r.isArchived
    })
  }, [registrations, searchTerm, filterStatus, duplicateCis])

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

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Lista de Confirmandos</h1>
          <p className="text-muted-foreground">Listado institucional (Total: {filteredRegistrations.length})</p>
        </div>
        <div className="flex gap-2">
          <Button asChild className="bg-primary hover:bg-primary/90 rounded-xl h-11 font-bold px-6 shadow-lg shadow-primary/20">
            <Link href="/dashboard/registration" prefetch={false}>Nueva Ficha</Link>
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Buscar por Nombre o C.I..." 
                className="pl-10 h-12 rounded-xl bg-white border-slate-200" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px] h-12 rounded-xl bg-white border-slate-200">
                  <SelectValue placeholder="Filtrar Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="POR_VALIDAR">Por Validar</SelectItem>
                  <SelectItem value="INSCRITO">Inscritos</SelectItem>
                  <SelectItem value="REPETIDO">Solo Repetidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="py-24 text-center">
              <User className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No se encontraron confirmandos activos.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="pl-8 font-bold">Confirmando</TableHead>
                  <TableHead className="font-bold">Nivel</TableHead>
                  <TableHead className="font-bold">Día</TableHead>
                  <TableHead className="font-bold text-center">Estado</TableHead>
                  <TableHead className="text-right pr-8 font-bold">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg) => {
                  const isRepetido = duplicateCis.has(reg.ciNumber)
                  return (
                    <TableRow key={reg.id} className="h-20 hover:bg-slate-50/50 transition-colors">
                      <TableCell className="pl-8">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-10 w-10 border shadow-sm">
                            <AvatarImage src={reg.photoUrl} className="object-cover" />
                            <AvatarFallback><User /></AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900 uppercase">{reg.fullName}</span>
                              {isRepetido && (
                                <Badge className="bg-red-500 text-white text-[8px] animate-pulse">REPETIDO</Badge>
                              )}
                            </div>
                            <span className="text-[10px] font-black text-primary">{reg.ciNumber}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] uppercase border-slate-200">
                          {reg.catechesisYear?.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{reg.attendanceDay}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn("text-[9px] border-none", reg.status === "POR_VALIDAR" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600")}>
                          {reg.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex justify-end gap-2">
                          {reg.status === "POR_VALIDAR" ? (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-10 rounded-full font-black px-6 text-primary border-slate-200 bg-white hover:bg-slate-50 transition-all active:scale-95 shadow-sm uppercase tracking-wider"
                              asChild
                            >
                              <Link href="/dashboard/payments">VALIDAR</Link>
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full">
                              <Eye className="h-4 w-4 text-slate-400" />
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                <MoreHorizontal className="h-4 w-4 text-slate-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[180px] p-2 rounded-xl border-none shadow-xl">
                              <DropdownMenuItem onClick={() => { setSelectedReg(reg); setIsDeleteDialogOpen(true); }} className="h-10 rounded-lg text-destructive focus:bg-red-50 focus:text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" /> Eliminar Permanente
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
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> ¿Eliminar este registro?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es irreversible. Se borrarán todos los datos de <strong>{selectedReg?.fullName}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white rounded-xl font-bold hover:bg-red-700" onClick={handleDelete} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : "Confirmar Eliminación"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
