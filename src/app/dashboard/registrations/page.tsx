
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
  X,
  Eye,
  CheckCircle2,
  AlertCircle
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, updateDoc, deleteDoc, serverTimestamp, addDoc } from "firebase/firestore"
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
  const [isProofViewOpen, setIsProofViewOpen] = useState(false)
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
  const isTesorero = profile?.role === "Tesorero"

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

  const handleValidatePayment = async () => {
    if (!db || !selectedReg) return
    setIsSubmitting(true)

    try {
      await updateDoc(doc(db, "confirmations", selectedReg.id), {
        status: "INSCRITO",
        amountPaid: selectedReg.registrationCost || 0,
        paymentStatus: "PAGADO",
        validatedAt: serverTimestamp(),
        validatedBy: profile ? `${profile.firstName} ${profile.lastName}` : "Personal"
      })

      await addDoc(collection(db, "audit_logs"), {
        userId: user?.uid || "unknown",
        userName: profile ? `${profile.firstName} ${profile.lastName}` : "Catequista",
        action: "Validación de Pago",
        module: "tesoreria",
        details: `Se validó el pago de ${selectedReg.fullName}`,
        timestamp: serverTimestamp()
      })

      toast({ title: "Pago Validado", description: "Se ha registrado el ingreso y el alumno está inscrito oficialmente." })
      setIsDetailsDialogOpen(false)
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error", description: "No se pudo realizar la validación." })
    } finally {
      setIsSubmitting(false)
    }
  }

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
      toast({ title: "Registro eliminado" })
      setIsDeleteDialogOpen(false)
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error" })
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
      case "INSCRITO": return <Badge className="bg-green-500 hover:bg-green-600">Inscrito</Badge>
      case "POR_VALIDAR": return <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">Por Validar</Badge>
      case "PENDIENTE_PAGO": return <Badge variant="outline" className="text-blue-500 border-blue-200">Pendiente Pago</Badge>
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
          <p className="text-muted-foreground">Consulta y valida los registros de la parroquia.</p>
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
        </div>
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
        ) : (
          <div className="space-y-4">
            <Accordion type="multiple" defaultValue={["none", ...(groups?.map(g => g.id) || [])]} className="space-y-4">
              {registrationsByGroup["none"]?.length > 0 && (
                <AccordionItem value="none" className="border-none">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <AccordionTrigger className="px-6 h-16 hover:no-underline hover:bg-slate-50">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
                          <AlertCircle className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-slate-900">Pendientes de Grupo o Validación</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{registrationsByGroup["none"].length} registros</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0 border-t border-slate-50">
                      <StudentTable 
                        students={registrationsByGroup["none"]} 
                        formatYear={formatCatechesisYear} 
                        getBadge={getStatusBadge} 
                        isAdmin={isAdmin || isTesorero} 
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
                        <StudentTable 
                          students={groupStudents} 
                          formatYear={formatCatechesisYear} 
                          getBadge={getStatusBadge} 
                          isAdmin={isAdmin || isTesorero} 
                          onAssignGroup={openAssignDialog}
                          onDelete={openDeleteDialog}
                          onViewDetails={openDetailsDialog}
                        />
                      </AccordionContent>
                    </div>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </div>
        )}
      </div>

      {/* DIALOGO DE DETALLES Y VALIDACIÓN */}
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
              <div className="flex flex-col items-end gap-2">
                {getStatusBadge(selectedReg?.status)}
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="max-h-[70vh]">
            <div className="p-8 space-y-8">
              {/* COMPROBANTE DE PAGO (NUEVO) */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                  <CreditCard className="h-3 w-3" /> Comprobante de Transferencia
                </h4>
                {selectedReg?.paymentProofUrl ? (
                  <div className="relative group rounded-3xl overflow-hidden border-4 border-slate-100 shadow-sm max-w-sm mx-auto">
                    <img 
                      src={selectedReg.paymentProofUrl} 
                      alt="Comprobante" 
                      className="w-full h-auto cursor-pointer transition-transform hover:scale-105"
                      onClick={() => setIsProofViewOpen(true)}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <Eye className="text-white h-8 w-8" />
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-8 rounded-3xl border border-dashed border-slate-200 text-center">
                    <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-bold uppercase">No se adjuntó comprobante</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* SECCIÓN PERSONAL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                    <UserCircle className="h-3 w-3" /> Datos Personales
                  </h4>
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-center"><span className="text-xs text-slate-500">Edad:</span><span className="text-sm font-bold">{selectedReg?.age} años</span></div>
                    <div className="flex justify-between items-center"><span className="text-xs text-slate-500">Celular:</span><span className="text-sm font-bold">{selectedReg?.phone}</span></div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                    <BookOpen className="h-3 w-3" /> Nivel Asignado
                  </h4>
                  <div className="space-y-3 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Año:</span>
                      <span className="text-sm font-bold">{formatCatechesisYear(selectedReg?.catechesisYear)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Día:</span>
                      <span className="text-sm font-bold">{selectedReg?.attendanceDay}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row justify-between gap-3">
            <Button variant="outline" className="rounded-xl px-8 h-11" onClick={() => setIsDetailsDialogOpen(false)}>Cerrar</Button>
            
            <div className="flex gap-2">
              {selectedReg?.status === "POR_VALIDAR" && (isAdmin || isTesorero) && (
                <Button 
                  className="rounded-xl px-8 h-11 bg-green-600 hover:bg-green-700 font-bold gap-2"
                  onClick={handleValidatePayment}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <><CheckCircle2 className="h-4 w-4" /> Validar y Inscribir</>}
                </Button>
              )}
              <Button className="rounded-xl px-8 h-11 gap-2" onClick={() => window.print()}>
                <Download className="h-4 w-4" /> PDF
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VISTA AMPLIADA DEL COMPROBANTE */}
      <Dialog open={isProofViewOpen} onOpenChange={setIsProofViewOpen}>
        <DialogContent className="max-w-3xl p-0 bg-transparent border-none shadow-none flex items-center justify-center">
          <div className="relative">
            <Button 
              variant="secondary" 
              size="icon" 
              className="absolute -top-12 -right-12 rounded-full h-10 w-10 bg-white/20 hover:bg-white/40 text-white"
              onClick={() => setIsProofViewOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>
            <img src={selectedReg?.paymentProofUrl} alt="Comprobante Full" className="max-h-[90vh] rounded-xl shadow-2xl" />
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOGOS DE GESTIÓN (IDEM PREVIO) */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader><DialogTitle>Asignar Grupo</DialogTitle></DialogHeader>
          <div className="py-4"><Select value={newGroupId} onValueChange={setNewGroupId}><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Elige un grupo" /></SelectTrigger><SelectContent>{groups?.filter(g => g.catechesisYear === selectedReg?.catechesisYear).map((g: any) => (<SelectItem key={g.id} value={g.id}>{g.name} ({g.attendanceDay}s)</SelectItem>))}</SelectContent></Select></div>
          <DialogFooter><Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancelar</Button><Button onClick={handleAssignGroup} disabled={isSubmitting || !newGroupId}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteRegistration} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function StudentTable({ students, formatYear, getBadge, isAdmin, onAssignGroup, onDelete, onViewDetails }: any) {
  return (
    <Table>
      <TableHeader className="bg-slate-50/30"><TableRow><TableHead className="w-[60px] pl-6"></TableHead><TableHead className="font-bold text-xs uppercase">Confirmando</TableHead><TableHead className="font-bold text-xs uppercase">C.I. N°</TableHead><TableHead className="font-bold text-xs uppercase">Año</TableHead><TableHead className="font-bold text-xs uppercase">Estado</TableHead><TableHead className="text-right font-bold text-xs uppercase pr-8">Acciones</TableHead></TableRow></TableHeader>
      <TableBody>
        {students.map((reg: any) => (
          <TableRow key={reg.id} className="hover:bg-slate-50/30 h-14">
            <TableCell className="pl-6"><Avatar className="h-8 w-8 border"><AvatarImage src={reg.photoUrl} /><AvatarFallback><User className="h-4 w-4" /></AvatarFallback></Avatar></TableCell>
            <TableCell><div className="flex flex-col"><span className="font-bold text-slate-900 text-xs">{reg.fullName}</span><span className="text-[10px] text-slate-500">{reg.phone}</span></div></TableCell>
            <TableCell className="text-xs">{reg.ciNumber}</TableCell>
            <TableCell><span className="text-[10px] font-bold text-slate-400">{formatYear(reg.catechesisYear)}</span></TableCell>
            <TableCell>{getBadge(reg.status)}</TableCell>
            <TableCell className="text-right pr-8">
              <div className="flex justify-end gap-2">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onViewDetails(reg)}><Eye className="h-4 w-4 text-slate-400" /></Button>
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl p-2 shadow-xl border-none"><DropdownMenuItem onClick={() => onAssignGroup(reg)} className="gap-2"><UserPlus className="h-4 w-4" /> Asignar Grupo</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => onDelete(reg)} className="text-destructive gap-2"><Trash2 className="h-4 w-4" /> Eliminar</DropdownMenuItem></DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
