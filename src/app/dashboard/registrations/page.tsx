
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
  Check
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

type ViewMode = "LIST" | "GROUPS"

export default function RegistrationsListPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("GROUPS")
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
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
                            <DropdownMenuItem className="rounded-lg h-10 gap-2"><UserCircle className="h-4 w-4" /> Ver Detalles</DropdownMenuItem>
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
    </div>
  )
}

function StudentTable({ 
  students, 
  formatYear, 
  getBadge, 
  isAdmin, 
  onAssignGroup, 
  onDelete 
}: { 
  students: any[], 
  formatYear: any, 
  getBadge: any, 
  isAdmin: boolean,
  onAssignGroup: (reg: any) => void,
  onDelete: (reg: any) => void
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
                  <DropdownMenuItem className="rounded-lg h-9 gap-2 text-xs font-medium">Ver Detalles</DropdownMenuItem>
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
