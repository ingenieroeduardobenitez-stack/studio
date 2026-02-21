
"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Shapes, Plus, Search, MoreHorizontal, Loader2, Edit, Trash2, Users, Calendar, Clock, User, X, Check } from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function GroupsAdminPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [memberSearch, setMemberSearch] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [selectedCatequistaIds, setSelectedCatequistaIds] = useState<string[]>([])
  
  const { toast } = useToast()
  const db = useFirestore()

  const usersQuery = useMemoFirebase(() => db ? collection(db, "users") : null, [db])
  const groupsQuery = useMemoFirebase(() => db ? collection(db, "groups") : null, [db])

  const { data: users, loading: loadingUsers } = useCollection(usersQuery)
  const { data: groups, loading: loadingGroups } = useCollection(groupsQuery)

  const filteredGroups = useMemo(() => {
    if (!groups) return []
    return groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [groups, searchTerm])

  const filteredUsers = useMemo(() => {
    if (!users) return []
    return users.filter(u => 
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(memberSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(memberSearch.toLowerCase())
    )
  }, [users, memberSearch])

  const handleToggleCatequista = useCallback((userId: string) => {
    if (isSubmitting) return
    setSelectedCatequistaIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }, [isSubmitting])

  const handleOpenCreateDialog = () => {
    setSelectedCatequistaIds([])
    setMemberSearch("")
    setSelectedGroup(null)
    setIsCreateDialogOpen(true)
  }

  const handleOpenEditDialog = (group: any) => {
    setSelectedGroup(group)
    setMemberSearch("")
    setSelectedCatequistaIds(group.catequistaIds || [])
    setIsEditDialogOpen(true)
  }

  const handleCreateGroup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db) return
    if (selectedCatequistaIds.length === 0) {
      toast({ variant: "destructive", title: "Atención", description: "Debes seleccionar al menos un catequista." })
      return
    }

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const attendanceDay = formData.get("attendanceDay") as string
    const catechesisYear = formData.get("catechesisYear") as string
    const schedule = attendanceDay === "SABADO" ? "15:30 a 18:30 hs" : "08:00 a 11:00 hs"

    const groupId = `group_${Date.now()}`
    const groupRef = doc(db, "groups", groupId)
    
    const groupData = {
      name,
      catequistaIds: selectedCatequistaIds,
      attendanceDay,
      schedule,
      catechesisYear,
      createdAt: serverTimestamp(),
    }

    setDoc(groupRef, groupData)
      .then(() => {
        toast({ title: "Grupo creado", description: `El grupo "${name}" se creó correctamente.` })
        setIsCreateDialogOpen(false)
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: groupRef.path,
          operation: 'create',
          requestResourceData: groupData,
        })
        errorEmitter.emit('permission-error', permissionError)
      })
      .finally(() => setIsSubmitting(false))
  }

  const handleEditGroup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !selectedGroup) return
    if (selectedCatequistaIds.length === 0) {
      toast({ variant: "destructive", title: "Atención", description: "El grupo debe tener al menos un catequista." })
      return
    }

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const attendanceDay = formData.get("attendanceDay") as string
    const catechesisYear = formData.get("catechesisYear") as string
    const schedule = attendanceDay === "SABADO" ? "15:30 a 18:30 hs" : "08:00 a 11:00 hs"

    const groupRef = doc(db, "groups", selectedGroup.id)
    const groupData = {
      name,
      catequistaIds: selectedCatequistaIds,
      attendanceDay,
      schedule,
      catechesisYear
    }

    updateDoc(groupRef, groupData)
      .then(() => {
        toast({ title: "Grupo actualizado", description: "Los cambios se guardaron correctamente." })
        setIsEditDialogOpen(false)
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: groupRef.path,
          operation: 'update',
          requestResourceData: groupData,
        })
        errorEmitter.emit('permission-error', permissionError)
      })
      .finally(() => setIsSubmitting(false))
  }

  const handleDeleteGroup = async () => {
    if (!db || !selectedGroup) return
    setIsSubmitting(true)

    const groupRef = doc(db, "groups", selectedGroup.id)
    deleteDoc(groupRef)
      .then(() => {
        toast({ title: "Grupo eliminado", description: "El grupo ha sido borrado." })
        setIsDeleteDialogOpen(false)
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: groupRef.path,
          operation: 'delete',
        })
        errorEmitter.emit('permission-error', permissionError)
      })
      .finally(() => setIsSubmitting(false))
  }

  const getCatequistaInfo = (id: string) => users?.find(u => u.id === id)

  const getYearLabel = (year: string) => {
    switch (year) {
      case "PRIMER_AÑO": return "1° Año"
      case "SEGUNDO_AÑO": return "2° Año"
      case "ADULTOS": return "Adultos"
      default: return year
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Grupos de Catequesis</h1>
          <p className="text-muted-foreground">Organiza a tus catequistas en equipos de trabajo por turnos.</p>
        </div>
        
        <Button className="bg-primary hover:bg-primary/90" onClick={handleOpenCreateDialog}>
          <Plus className="mr-2 h-4 w-4" /> Crear Nuevo Grupo
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="border-b bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar grupo por nombre..." 
              className="pl-9 bg-white" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {(loadingGroups || loadingUsers) ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="py-20 text-center">
              <Shapes className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No se encontraron grupos.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-bold">Nombre del Grupo</TableHead>
                  <TableHead className="font-bold">Categoría y Horario</TableHead>
                  <TableHead className="font-bold">Miembros</TableHead>
                  <TableHead className="text-right font-bold">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.map((group: any) => (
                  <TableRow key={group.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-bold text-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                          <Users className="h-4 w-4" />
                        </div>
                        {group.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          {group.attendanceDay === "SABADO" ? "Sábados" : "Domingos"}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4 border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-tighter">
                            {getYearLabel(group.catechesisYear)}
                          </Badge>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {group.schedule}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex -space-x-2">
                        {group.catequistaIds?.slice(0, 4).map((id: string) => {
                          const info = getCatequistaInfo(id)
                          return (
                            <Avatar key={id} className="h-8 w-8 border-2 border-white shadow-sm">
                              <AvatarImage src={info?.photoUrl || undefined} />
                              <AvatarFallback className="bg-slate-200 text-[10px]">
                                <User className="h-3 w-3" />
                              </AvatarFallback>
                            </Avatar>
                          )
                        })}
                        {group.catequistaIds?.length > 4 && (
                          <div className="h-8 w-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-sm">
                            +{group.catequistaIds.length - 4}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEditDialog(group)}>
                            <Edit className="mr-2 h-4 w-4" /> Editar Grupo
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => { 
                            setSelectedGroup(group)
                            setIsDeleteDialogOpen(true) 
                          }}>
                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px] flex flex-col max-h-[90vh]">
          <form onSubmit={handleCreateGroup} className="flex flex-col h-full overflow-hidden">
            <DialogHeader>
              <DialogTitle>Nuevo Grupo de Catequesis</DialogTitle>
              <DialogDescription>
                Define un nombre, el horario y selecciona a los catequistas.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Grupo</Label>
                <Input id="name" name="name" placeholder="Ej. Jóvenes Confirmación - Sábados" required disabled={isSubmitting} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="attendanceDay">Día y Horario</Label>
                  <Select name="attendanceDay" defaultValue="SABADO" disabled={isSubmitting}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Día" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SABADO">Sábados (15:30 - 18:30)</SelectItem>
                      <SelectItem value="DOMINGO">Domingos (08:00 - 11:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="catechesisYear">Año</Label>
                  <Select name="catechesisYear" defaultValue="PRIMER_AÑO" disabled={isSubmitting}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Año" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRIMER_AÑO">Primer Año</SelectItem>
                      <SelectItem value="SEGUNDO_AÑO">Segundo Año</SelectItem>
                      <SelectItem value="ADULTOS">Adultos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-3">
                <Label className="text-slate-900 font-bold">Catequistas Seleccionados ({selectedCatequistaIds.length})</Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-xl bg-slate-50 min-h-[50px] transition-all">
                  {selectedCatequistaIds.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">Haz clic en los miembros de la lista inferior</span>
                  ) : (
                    selectedCatequistaIds.map(id => {
                      const u = getCatequistaInfo(id)
                      return (
                        <Badge key={id} variant="secondary" className="pl-1 pr-2 py-1 gap-1 flex items-center bg-white border-primary/20 text-primary shadow-sm animate-in zoom-in-95">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={u?.photoUrl || undefined} />
                            <AvatarFallback className="text-[8px] bg-primary/10"><User className="h-2 w-2"/></AvatarFallback>
                          </Avatar>
                          <span className="text-[10px] font-bold">{u?.firstName} {u?.lastName[0]}.</span>
                          <X className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors" onClick={() => handleToggleCatequista(id)} />
                        </Badge>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-900 font-bold">Buscar y Agregar Miembros</Label>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Escribir nombre o correo..." 
                    className="pl-9 h-9 text-sm bg-white"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                  />
                </div>
                <ScrollArea className="h-[200px] border rounded-xl p-2 bg-white">
                  <div className="space-y-1">
                    {filteredUsers.map((u: any) => {
                      const isSelected = selectedCatequistaIds.includes(u.id)
                      return (
                        <div 
                          key={u.id} 
                          className={`flex items-center justify-between p-2.5 rounded-lg transition-all cursor-pointer group ${
                            isSelected ? 'bg-primary text-white shadow-md' : 'hover:bg-slate-50 border border-transparent'
                          }`}
                          onClick={() => handleToggleCatequista(u.id)}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className={`h-8 w-8 ${isSelected ? 'border border-white/30' : ''}`}>
                              <AvatarImage src={u.photoUrl || undefined} />
                              <AvatarFallback className={`text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                                <User className="h-3.5 w-3.5" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold">{u.firstName} {u.lastName}</span>
                              <span className={`text-[10px] ${isSelected ? 'text-white/70' : 'text-muted-foreground'}`}>{u.email}</span>
                            </div>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-white" />}
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
            <DialogFooter className="pt-4 mt-auto">
              <Button type="submit" disabled={isSubmitting} className="w-full h-11 bg-primary hover:bg-primary/90 text-white shadow-lg">
                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Crear Grupo de Trabajo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] flex flex-col max-h-[90vh]">
          <form onSubmit={handleEditGroup} className="flex flex-col h-full overflow-hidden">
            <DialogHeader>
              <DialogTitle>Editar Grupo</DialogTitle>
              <DialogDescription>
                Actualiza el nombre, el horario o los integrantes.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre del Grupo</Label>
                <Input id="edit-name" name="name" defaultValue={selectedGroup?.name} required disabled={isSubmitting} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-attendanceDay">Día y Horario</Label>
                  <Select name="attendanceDay" defaultValue={selectedGroup?.attendanceDay || "SABADO"} disabled={isSubmitting}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Día" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SABADO">Sábados (15:30 - 18:30)</SelectItem>
                      <SelectItem value="DOMINGO">Domingos (08:00 - 11:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-catechesisYear">Año</Label>
                  <Select name="catechesisYear" defaultValue={selectedGroup?.catechesisYear || "PRIMER_AÑO"} disabled={isSubmitting}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Año" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRIMER_AÑO">Primer Año</SelectItem>
                      <SelectItem value="SEGUNDO_AÑO">Segundo Año</SelectItem>
                      <SelectItem value="ADULTOS">Adultos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-3">
                <Label className="text-slate-900 font-bold">Catequistas Seleccionados ({selectedCatequistaIds.length})</Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-xl bg-slate-50 min-h-[50px]">
                  {selectedCatequistaIds.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No hay miembros seleccionados</span>
                  ) : (
                    selectedCatequistaIds.map(id => {
                      const u = getCatequistaInfo(id)
                      return (
                        <Badge key={id} variant="secondary" className="pl-1 pr-2 py-1 gap-1 flex items-center bg-white border-primary/20 text-primary shadow-sm">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={u?.photoUrl || undefined} />
                            <AvatarFallback className="text-[8px] bg-primary/10"><User className="h-2 w-2"/></AvatarFallback>
                          </Avatar>
                          <span className="text-[10px] font-bold">{u?.firstName} {u?.lastName[0]}.</span>
                          <X className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors" onClick={() => handleToggleCatequista(id)} />
                        </Badge>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-900 font-bold">Buscar y Modificar Miembros</Label>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Escribir nombre o correo..." 
                    className="pl-9 h-9 text-sm bg-white"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                  />
                </div>
                <ScrollArea className="h-[200px] border rounded-xl p-2 bg-white">
                  <div className="space-y-1">
                    {filteredUsers.map((u: any) => {
                      const isSelected = selectedCatequistaIds.includes(u.id)
                      return (
                        <div 
                          key={u.id} 
                          className={`flex items-center justify-between p-2.5 rounded-lg transition-all cursor-pointer group ${
                            isSelected ? 'bg-primary text-white shadow-md' : 'hover:bg-slate-50 border border-transparent'
                          }`}
                          onClick={() => handleToggleCatequista(u.id)}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className={`h-8 w-8 ${isSelected ? 'border border-white/30' : ''}`}>
                              <AvatarImage src={u.photoUrl || undefined} />
                              <AvatarFallback className={`text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                                <User className="h-3.5 w-3.5" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold">{u.firstName} {u.lastName}</span>
                              <span className={`text-[10px] ${isSelected ? 'text-white/70' : 'text-muted-foreground'}`}>{u.email}</span>
                            </div>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-white" />}
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
            <DialogFooter className="pt-4 mt-auto">
              <Button type="submit" disabled={isSubmitting} className="w-full h-11 shadow-lg">
                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el grupo <strong>{selectedGroup?.name}</strong>. Los catequistas asignados no serán borrados del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90" 
              onClick={(e) => {
                e.preventDefault()
                handleDeleteGroup()
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Eliminar Definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
