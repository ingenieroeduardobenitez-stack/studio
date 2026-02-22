
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Search, 
  Loader2, 
  Download, 
  Filter, 
  MoreHorizontal, 
  User, 
  LayoutList, 
  Users,
  ChevronRight,
  UserCircle,
  UserPlus,
  Trash2,
  Check,
  Calendar,
  Phone,
  CreditCard,
  Church,
  BookOpen,
  Info,
  X
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

type ViewMode = "LIST" | "GROUPS"

export default function RegistrationsListPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("GROUPS")
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [newGroupId, setNewGroupId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const userProfileRef = useMemo(() => db && user?.uid ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc(userProfileRef)
  const isAdmin = profile?.role === "Administrador"

  const regsQuery = useMemoFirebase(() => db ? collection(db, "confirmations") : null, [db])
  const groupsQuery = useMemoFirebase(() => db ? collection(db, "groups") : null, [db])

  const { data: registrations, loading: loadingRegs } = useCollection(regsQuery)
  const { data: groups, loading: loadingGroups } = useCollection(groupsQuery)

  const filteredRegistrations = useMemo(() => {
    if (!registrations) return []
    return registrations.filter(reg => 
      reg.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.ciNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [registrations, searchTerm])

  const registrationsByGroup = useMemo(() => {
    if (!registrations || !groups) return {}
    
    const grouped: Record<string, any[]> = {}
    groups.forEach(g => { grouped[g.id] = [] })
    grouped["none"] = []

    filteredRegistrations.forEach(reg => {
      const gId = reg.groupId && grouped[reg.groupId] ? reg.groupId : "none"
      grouped[gId].push(reg)
    })

    return grouped
  }, [filteredRegistrations, groups])

  const handleAssignGroup = async () => {
    if (!db || !selectedReg || !newGroupId) return
    setIsSubmitting(true)

    const group = groups?.find(g => g.id === newGroupId)
    if (!group) return

    try {
      await updateDoc(doc(db, "confirmations", selectedReg.id), {
        groupId: newGroupId,
        attendanceDay: group.attendanceDay,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Grupo asignado", description: `${selectedReg.fullName} ahora pertenece a ${group.name}.` })
      setIsAssignDialogOpen(false)
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error", description: "No se pudo asignar el grupo." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteRegistration = async () => {
    if (!db || !selectedReg) return
    setIsSubmitting(true)

    try {
      await deleteDoc(doc(db, "confirmations", selectedReg.id))
      toast({ title: "Registro eliminado", description: "La inscripción ha sido borrada del sistema." })
      setIsDeleteDialogOpen(false)
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el registro." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const openAssignDialog = (reg: any) => {
    setSelectedReg(reg)
    setNewGroupId(reg.groupId || "")
    setIsAssignDialogOpen(true)
  }

  const openDeleteDialog = (reg: any) => {
    setSelectedReg(reg)
    setIsDeleteDialogOpen(true)
  }

  const openDetailsDialog = (reg: any) => {
    setSelectedReg(reg)
    setIsDetailsDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "INSCRITO": return <Badge className="bg-blue-500 hover:bg-blue-600">Inscrito</Badge>
      case "PENDIENTE": return <Badge variant="secondary">Pendiente</Badge>
      case "OBSERVADO": return <Badge variant="destructive">Observado</Badge>
      case "ARCHIVADO": return <Badge variant="outline" className="bg-slate-100">Archivado</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatCatechesisYear = (year: string) => {
    switch (year) {
      case "PRIMER_AÑO": return "1° Año"
      case "SEGUNDO_AÑO": return "2° Año"
      case "ADULTOS": return "Adultos"
      default: return year
    }
  }

  if (!mounted) return null

  const loading = loadingRegs || loadingGroups

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Lista de Confirmandos</h1>
          <p className="text-muted-foreground">Consulta y gestiona todos los registros de la parroquia.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Button 
              variant={viewMode === "LIST" ? "default" : "ghost"} 
              size="sm" 
              className={cn("h-8 rounded-lg text-xs font-bold gap-2", viewMode === "LIST" ? "shadow-sm" : "text-slate-500")}
              onClick={() => setViewMode("LIST")}
            >
              <LayoutList className="h-3.5 w-3.5" /> Lista Plana
            </Button>
            <Button 
              variant={viewMode === "GROUPS" ? "default" : "ghost"} 
              size="sm" 
              className={cn("h-8 rounded-lg text-xs font-bold gap-2", viewMode === "GROUPS" ? "shadow-sm" : "text-slate-500")}
              onClick={() => setViewMode("GROUPS")}
            >
              <Users className="h-3.5 w-3.5" /> Por Grupos
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold border-slate-200">
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-none shadow-xl bg-white">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Inscritos</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-primary">{registrations?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl bg-white">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Primer Año</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">
              {registrations?.filter(r => r.catechesisYear === "PRIMER_AÑO").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl bg-white">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Segundo Año</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">
              {registrations?.filter(r => r.catechesisYear === "SEGUNDO_AÑO").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl bg-white">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Adultos</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">
              {registrations?.filter(r => r.catechesisYear === "ADULTOS").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nombre o C.I..." 
              className="pl-9 bg-slate-50 border-none h-11 rounded-xl" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl border-slate-200">
            <Filter className="h-4 w-4 text-slate-500" />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border shadow-sm">
            <User className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No se encontraron inscripciones.</p>
          </div>
        ) : viewMode === "LIST" ? (
          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-transparent">
                    <TableHead className="w-[60px]"></TableHead>
                    <TableHead className="font-bold">Confirmando</TableHead>
                    <TableHead className="font-bold">C.I. N°</TableHead>
                    <TableHead className="font-bold">Año</TableHead>
                    <TableHead className="font-bold">Día</TableHead>
                    <TableHead className="font-bold">Estado</TableHead>
                    <TableHead className="text-right font-bold pr-8">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistrations.map((reg: any) => (
                    <TableRow key={reg.id} className="hover:bg-slate-50/30 transition-colors h-16">
                      <TableCell>
                        <Avatar className="h-10 w-10 border shadow-sm">
                          <AvatarImage src={reg.photoUrl || undefined} className="object-cover" />
                          <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm">{reg.fullName}</span>
                          <span className="text-[10px] text-slate-500 uppercase">{reg.phone}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-slate-600 text-sm">{reg.ciNumber}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-700">
                          {formatCatechesisYear(reg.catechesisYear)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 italic">
                        {reg.attendanceDay === "SABADO" ? "Sábado" : "Domingo"}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(reg.status)}
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl p-2 border-none shadow-xl">
                            <DropdownMenuLabel className="text-[10px] uppercase text-slate-400">Gestión</DropdownMenuLabel>
                            <DropdownMenuItem className="rounded-lg h-10 gap-2" onClick={() => openDetailsDialog(reg)}>
                              <UserCircle className="h-4 w-4" /> Ver Detalles
                            </DropdownMenuItem>
                            {isAdmin && (
                              <>
                                <DropdownMenuItem className="rounded-lg h-10 gap-2" onClick={() => openAssignDialog(reg)}>
                                  <UserPlus className="h-4 w-4" /> Asignar Grupo
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive rounded-lg h-10 gap-2" onClick={() => openDeleteDialog(reg)}>
                                  <Trash2 className="h-4 w-4" /> Eliminar Registro
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Accordion type="multiple" defaultValue={["none", ...(groups?.map(g => g.id) || [])]} className="space-y-4">
              {registrationsByGroup["none"]?.length > 0 && (
                <AccordionItem value="none" className="border-none">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <AccordionTrigger className="px-6 h-16 hover:no-underline hover:bg-slate-50">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
                          <UserCircle className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-slate-900">Alumnos sin grupo asignado</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{registrationsByGroup["none"].length} alumnos pendientes</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0 border-t border-slate-50">
                      <StudentTable 
                        students={registrationsByGroup["none"]} 
                        formatYear={formatCatechesisYear} 
                        getBadge={getStatusBadge} 
                        isAdmin={isAdmin} 
                        onAssignGroup={openAssignDialog}
                        onDelete={openDeleteDialog}
                        onViewDetails={openDetailsDialog}
                      />
                    </AccordionContent>
                  </div>
                </AccordionItem>
              )}

              {groups?.map((group: any) => {
                const groupStudents = registrationsByGroup[group.id] || []
                if (groupStudents.length === 0 && searchTerm) return null
                
                return (
                  <AccordionItem key={group.id} value={group.id} className="border-none">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                      <AccordionTrigger className="px-6 h-16 hover:no-underline hover:bg-slate-50">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                            <Users className="h-5 w-5" />
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-900">{group.name}</p>
                              <Badge variant="secondary" className="text-[9px] h-4 uppercase tracking-tighter">
                                {formatCatechesisYear(group.catechesisYear)}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                              {group.attendanceDay}s • {groupStudents.length} alumnos
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0 border-t border-slate-50">
                        {groupStudents.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 italic text-sm">No hay alumnos asignados a este grupo aún.</div>
                        ) : (
                          <StudentTable 
                            students={groupStudents} 
                            formatYear={formatCatechesisYear} 
                            getBadge={getStatusBadge} 
                            isAdmin={isAdmin} 
                            onAssignGroup={openAssignDialog}
                            onDelete={openDeleteDialog}
                            onViewDetails={openDetailsDialog}
                          />
                        )}
                      </AccordionContent>
                    </div>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </div>
        )}
      </div>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Asignar Grupo</DialogTitle>
            <DialogDescription>Mueve a {selectedReg?.fullName} a un grupo específico.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Seleccionar Grupo</Label>
              <Select value={newGroupId} onValueChange={setNewGroupId}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Elige un grupo" />
                </SelectTrigger>
                <SelectContent>
                  {groups?.filter(g => g.catechesisYear === selectedReg?.catechesisYear).map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} ({g.attendanceDay}s)
                    </SelectItem>
                  ))}
                  {groups?.filter(g => g.catechesisYear === selectedReg?.catechesisYear).length === 0 && (
                    <p className="p-4 text-xs text-muted-foreground text-center">No hay grupos creados para este año.</p>
                  )}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground italic">Solo se muestran grupos del mismo año de catequesis ({formatCatechesisYear(selectedReg?.catechesisYear)}).</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleAssignGroup} disabled={isSubmitting || !newGroupId}>
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Guardar Cambio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará definitivamente el registro de <strong>{selectedReg?.fullName}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); handleDeleteRegistration(); }} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Sí, Eliminar Registro"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOGO DE DETALLES DEL ALUMNO */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-white/20">
                  <AvatarImage src={selectedReg?.photoUrl} className="object-cover" />
                  <AvatarFallback className="bg-white/10 text-white"><User className="h-8 w-8" /></AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-xl font-bold uppercase tracking-tight">{selectedReg?.fullName}</DialogTitle>
                  <p className="text-sm text-white/80 font-medium">C.I. N° {selectedReg?.ciNumber}</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-[10px] uppercase font-bold px-3">
                {selectedReg?.status || "INSCRITO"}
              </Badge>
            </div>
          </DialogHeader>
          
          <ScrollArea className="max-h-[70vh]">
            <div className="p-8 space-y-8">
              {/* SECCIÓN PERSONAL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                    <UserCircle className="h-3 w-3" /> Datos Personales
                  </h4>
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Nacimiento:</span>
                      <span className="text-sm font-bold text-slate-900">{selectedReg?.birthDate || "---"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Edad:</span>
                      <span className="text-sm font-bold text-slate-900">{selectedReg?.age} años</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Celular:</span>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-primary" />
                        <span className="text-sm font-bold text-slate-900">{selectedReg?.phone || "---"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                    <BookOpen className="h-3 w-3" /> Nivel Asignado
                  </h4>
                  <div className="space-y-3 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Año de Catequesis:</span>
                      <Badge variant="secondary" className="text-[10px] h-5">{formatCatechesisYear(selectedReg?.catechesisYear)}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Día de Asistencia:</span>
                      <span className="text-sm font-bold text-primary">{selectedReg?.attendanceDay === "SABADO" ? "Sábados" : "Domingos"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Grupo Actual:</span>
                      <span className="text-sm font-bold text-slate-900">
                        {groups?.find(g => g.id === selectedReg?.groupId)?.name || "Sin Asignar"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* SECCIÓN FAMILIAR */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                  <Users className="h-3 w-3" /> Familia y Referencias
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl border border-slate-100 bg-white space-y-2">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Referencia Materna</p>
                    <p className="text-sm font-bold text-slate-900">{selectedReg?.motherName || "---"}</p>
                    <p className="text-xs text-slate-500">{selectedReg?.motherPhone}</p>
                  </div>
                  <div className="p-4 rounded-2xl border border-slate-100 bg-white space-y-2">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Referencia Paterna</p>
                    <p className="text-sm font-bold text-slate-900">{selectedReg?.fatherName || "---"}</p>
                    <p className="text-xs text-slate-500">{selectedReg?.fatherPhone}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* SECCIÓN SACRAMENTOS */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                  <Church className="h-3 w-3" /> Sacramentos Recibidos
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", selectedReg?.hasBaptism ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                      {selectedReg?.hasBaptism ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">Bautismo</span>
                      <span className="text-[10px] text-slate-500 uppercase">{selectedReg?.hasBaptism ? `Parroquia: ${selectedReg.baptismParish}` : "Pendiente"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", selectedReg?.hasFirstCommunion ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                      {selectedReg?.hasFirstCommunion ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">1ra Comunión</span>
                      <span className="text-[10px] text-slate-500 uppercase">{selectedReg?.hasFirstCommunion ? "Sacramento Recibido" : "Pendiente"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* SECCIÓN TESORERÍA */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                  <CreditCard className="h-3 w-3" /> Situación Financiera (Inscripción)
                </h4>
                <div className="bg-slate-900 text-white p-6 rounded-[2rem] relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10">
                    <CreditCard className="h-20 w-20" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                    <div>
                      <p className="text-[9px] font-bold text-white/50 uppercase mb-1">Costo Total</p>
                      <p className="text-xl font-bold">{selectedReg?.registrationCost?.toLocaleString()} Gs.</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-white/50 uppercase mb-1">Total Abonado</p>
                      <p className="text-xl font-bold text-green-400">{selectedReg?.amountPaid?.toLocaleString()} Gs.</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-white/50 uppercase mb-1">Saldo Pendiente</p>
                      <p className="text-xl font-bold text-red-400">
                        {((selectedReg?.registrationCost || 0) - (selectedReg?.amountPaid || 0)).toLocaleString()} Gs.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row justify-end gap-3">
            <Button variant="outline" className="rounded-xl px-8 h-11" onClick={() => setIsDetailsDialogOpen(false)}>Cerrar Ficha</Button>
            <Button className="rounded-xl px-8 h-11 gap-2" onClick={() => window.print()}>
              <Download className="h-4 w-4" /> Exportar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StudentTable({ 
  students, 
  formatYear, 
  getBadge, 
  isAdmin, 
  onAssignGroup, 
  onDelete,
  onViewDetails
}: { 
  students: any[], 
  formatYear: any, 
  getBadge: any, 
  isAdmin: boolean,
  onAssignGroup: (reg: any) => void,
  onDelete: (reg: any) => void,
  onViewDetails: (reg: any) => void
}) {
  return (
    <Table>
      <TableHeader className="bg-slate-50/30">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[60px] pl-6"></TableHead>
          <TableHead className="font-bold text-xs uppercase tracking-wider">Confirmando</TableHead>
          <TableHead className="font-bold text-xs uppercase tracking-wider">C.I. N°</TableHead>
          <TableHead className="font-bold text-xs uppercase tracking-wider">Año</TableHead>
          <TableHead className="font-bold text-xs uppercase tracking-wider text-center">Asistencia</TableHead>
          <TableHead className="font-bold text-xs uppercase tracking-wider">Estado</TableHead>
          <TableHead className="text-right font-bold text-xs uppercase tracking-wider pr-8">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((reg) => (
          <TableRow key={reg.id} className="hover:bg-slate-50/30 transition-colors h-14 border-slate-50">
            <TableCell className="pl-6">
              <Avatar className="h-8 w-8 border shadow-sm">
                <AvatarImage src={reg.photoUrl || undefined} className="object-cover" />
                <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
              </Avatar>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-bold text-slate-900 text-xs">{reg.fullName}</span>
                <span className="text-[10px] text-slate-500">{reg.phone}</span>
              </div>
            </TableCell>
            <TableCell className="font-medium text-slate-600 text-xs">{reg.ciNumber}</TableCell>
            <TableCell>
              <span className="text-[10px] font-bold text-slate-400">
                {formatYear(reg.catechesisYear)}
              </span>
            </TableCell>
            <TableCell className="text-center">
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[9px] uppercase font-bold",
                  reg.attendanceStatus === "PRESENTE" ? "bg-green-50 text-green-600 border-green-100" : 
                  reg.attendanceStatus === "AUSENTE" ? "bg-red-50 text-red-600 border-red-100" : "text-slate-400"
                )}
              >
                {reg.attendanceStatus || "PENDIENTE"}
              </Badge>
            </TableCell>
            <TableCell>
              {getBadge(reg.status)}
            </TableCell>
            <TableCell className="text-right pr-8">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl p-2 border-none shadow-xl">
                  <DropdownMenuLabel className="text-[10px] uppercase text-slate-400">Opciones</DropdownMenuLabel>
                  <DropdownMenuItem className="rounded-lg h-9 gap-2 text-xs font-medium" onClick={() => onViewDetails(reg)}>
                    <UserCircle className="h-4 w-4" /> Ver Detalles
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuItem className="rounded-lg h-9 gap-2 text-xs font-medium" onClick={() => onAssignGroup(reg)}>
                        <UserPlus className="h-4 w-4" /> Asignar Grupo
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive rounded-lg h-9 gap-2 text-xs font-medium" onClick={() => onDelete(reg)}>
                        <Trash2 className="h-4 w-4" /> Eliminar
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
