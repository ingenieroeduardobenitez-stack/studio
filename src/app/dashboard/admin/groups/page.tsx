
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
import { Shapes, Plus, Search, MoreHorizontal, Loader2, Edit, Trash2, Users, Calendar, User, X, Check } from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

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

  const filteredUsersForDialog = useMemo(() => {
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
          <p className="text-muted-foreground">Organiza a tus catequistas en equipos de trabajo.</p>
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
                  <TableHead className="font-bold text-slate-700">Nombre del Grupo</TableHead>
                  <TableHead className="font-bold text-slate-700">Día y Año</TableHead>
                  <TableHead className="font-bold text-slate-700">Miembros</TableHead>
                  <TableHead className="text-right font-bold text-slate-700">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.map((group: any) => (
                  <TableRow key={group.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-bold text-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <Users className="h-4 w-4" />
                        </div>
                        {group.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                          <Calendar className="h-3.5 w-3.5 text-accent" />
                          {group.attendanceDay === "SABADO" ? "Sábados" : "Domingos"}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] font-bold h-5 bg-accent/10 text-accent border-none">
                            {getYearLabel(group.catechesisYear)}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-medium">{group.schedule}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex -space-x-2">
                        {group.catequistaIds?.slice(0, 5).map((id: string) => {
                          const info = getCatequistaInfo(id)
                          return (
                            <Avatar key={id} className="h-8 w-8 border-2 border-white shadow-sm ring-1 ring-slate-100">
                              <AvatarImage src={info?.photoUrl || undefined} />
                              <AvatarFallback className="bg-slate-100 text-[10px] text-slate-400">
                                <User className="h-3 w-3" />
                              </AvatarFallback>
                            </Avatar>
                          )
                        })}
                        {group.catequistaIds?.length > 5 && (
                          <div className="h-8 w-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-sm ring-1 ring-slate-100">
                            +{group.catequistaIds.length - 5}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 p-2 rounded-xl shadow-xl">
                          <DropdownMenuItem onClick={() => handleOpenEditDialog(group)} className="rounded-lg gap-3">
                            <Edit className="h-4 w-4 text-slate-400" /> <span>Editar Grupo</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive rounded-lg gap-3" onClick={() => { 
                            setSelectedGroup(group)
                            setIsDeleteDialogOpen(true) 
                          }}>
                            <Trash2 className="h-4 w-4" /> <span>Eliminar</span>
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
        <DialogContent className="sm:max-w-[500px] flex flex-col max-h-[90vh] p-0 border-none shadow-2xl rounded-3xl overflow-hidden">
          <form onSubmit={handleCreateGroup} className="flex flex-col h-full">
            <DialogHeader className="p-8 bg-primary text-white">
              <DialogTitle className="text-2xl font-headline font-bold">Nuevo Grupo de Catequesis</DialogTitle>
              <DialogDescription className="text-white/80">
                Define los detalles y selecciona a los miembros.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-700 font-bold">Nombre del Grupo</Label>
                <Input id="name" name="name" placeholder="Ej. Confirmación Jóvenes - Turno Tarde" required disabled={isSubmitting} className="h-11 rounded-xl bg-slate-50 border-slate-200" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="attendanceDay" className="text-slate-700 font-bold">Día y Horario</Label>
                  <Select name="attendanceDay" defaultValue="SABADO" disabled={isSubmitting}>
                    <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Día" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="SABADO">Sábados (15:30 - 18:30)</SelectItem>
                      <SelectItem value="DOMINGO">Domingos (08:00 - 11:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="catechesisYear" className="text-slate-700 font-bold">Año</Label>
                  <Select name="catechesisYear" defaultValue="PRIMER_AÑO" disabled={isSubmitting}>
                    <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Año" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="PRIMER_AÑO">Primer Año</SelectItem>
                      <SelectItem value="SEGUNDO_AÑO">Segundo Año</SelectItem>
                      <SelectItem value="ADULTOS">Adultos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-3">
                <Label className="text-slate-900 font-bold flex items-center justify-between">
                  <span>Equipo Seleccionado</span>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-none">{selectedCatequistaIds.length}</Badge>
                </Label>
                <div className="flex flex-wrap gap-2 p-4 border rounded-2xl bg-slate-50 min-h-[60px] border-dashed border-slate-200">
                  {selectedCatequistaIds.length === 0 ? (
                    <span className="text-xs text-slate-400 italic flex items-center gap-2">
                      <Users className="h-3 w-3" /> Selecciona a los miembros en la lista inferior.
                    </span>
                  ) : (
                    selectedCatequistaIds.map(id => {
                      const u = getCatequistaInfo(id)
                      return (
                        <Badge key={id} variant="secondary" className="pl-1 pr-2 py-1 gap-1.5 flex items-center bg-white border-primary/20 text-slate-700 shadow-sm animate-in zoom-in-95 rounded-lg">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={u?.photoUrl || undefined} />
                            <AvatarFallback className="text-[8px] bg-primary/10 text-primary"><User className="h-2 w-2"/></AvatarFallback>
                          </Avatar>
                          <span className="text-[10px] font-bold">{u?.firstName} {u?.lastName[0]}.</span>
                          <X className="h-3 w-3 cursor-pointer text-slate-400 hover:text-destructive transition-colors" onClick={() => handleToggleCatequista(id)} />
                        </Badge>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar catequistas..." 
                    className="pl-9 h-10 rounded-xl bg-white border-slate-200"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                  />
                </div>
                <ScrollArea className="h-[220px] border rounded-2xl p-2 bg-white">
                  <div className="space-y-1">
                    {filteredUsersForDialog.map((u: any) => {
                      const isSelected = selectedCatequistaIds.includes(u.id)
                      return (
                        <div 
                          key={u.id} 
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer group",
                            isSelected 
                              ? "bg-primary text-white shadow-lg" 
                              : "hover:bg-slate-50 border border-transparent"
                          )}
                          onClick={() => handleToggleCatequista(u.id)}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className={cn("h-9 w-9", isSelected ? "border border-white/30" : "border border-slate-100")}>
                              <AvatarImage src={u.photoUrl || undefined} />
                              <AvatarFallback className={cn("text-[10px]", isSelected ? "bg-white/20 text-white" : "bg-primary/10 text-primary")}>
                                <User className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold leading-tight">{u.firstName} {u.lastName}</span>
                              <span className={cn("text-[10px]", isSelected ? "text-white/70" : "text-muted-foreground")}>{u.email}</span>
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
            <div className="p-8 bg-slate-50 border-t flex flex-col gap-3">
              <Button type="submit" disabled={isSubmitting} className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold shadow-lg shadow-primary/20">
                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "Crear Grupo de Trabajo"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setIsCreateDialogOpen(false)} disabled={isSubmitting} className="h-11 rounded-xl text-slate-500 font-semibold hover:bg-slate-100">
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] flex flex-col max-h-[90vh] p-0 border-none shadow-2xl rounded-3xl overflow-hidden">
          <form onSubmit={handleEditGroup} className="flex flex-col h-full">
            <DialogHeader className="p-8 bg-primary text-white">
              <DialogTitle className="text-2xl font-headline font-bold">Editar Grupo</DialogTitle>
              <DialogDescription className="text-white/80">
                Actualiza los detalles o los miembros del equipo.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-slate-700 font-bold">Nombre del Grupo</Label>
                <Input id="edit-name" name="name" defaultValue={selectedGroup?.name} required disabled={isSubmitting} className="h-11 rounded-xl bg-slate-50 border-slate-200" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-attendanceDay" className="text-slate-700 font-bold">Día y Horario</Label>
                  <Select name="attendanceDay" defaultValue={selectedGroup?.attendanceDay || "SABADO"} disabled={isSubmitting}>
                    <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Día" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="SABADO">Sábados (15:30 - 18:30)</SelectItem>
                      <SelectItem value="DOMINGO">Domingos (08:00 - 11:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-catechesisYear" className="text-slate-700 font-bold">Año</Label>
                  <Select name="catechesisYear" defaultValue={selectedGroup?.catechesisYear || "PRIMER_AÑO"} disabled={isSubmitting}>
                    <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Año" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="PRIMER_AÑO">Primer Año</SelectItem>
                      <SelectItem value="SEGUNDO_AÑO">Segundo Año</SelectItem>
                      <SelectItem value="ADULTOS">Adultos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-3">
                <Label className="text-slate-900 font-bold flex items-center justify-between">
                  <span>Equipo Actual</span>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-none">{selectedCatequistaIds.length}</Badge>
                </Label>
                <div className="flex flex-wrap gap-2 p-4 border rounded-2xl bg-slate-50 min-h-[60px] border-dashed border-slate-200">
                  {selectedCatequistaIds.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">No hay miembros seleccionados</span>
                  ) : (
                    selectedCatequistaIds.map(id => {
                      const u = getCatequistaInfo(id)
                      return (
                        <Badge key={id} variant="secondary" className="pl-1 pr-2 py-1 gap-1.5 flex items-center bg-white border-primary/20 text-slate-700 shadow-sm rounded-lg">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={u?.photoUrl || undefined} />
                            <AvatarFallback className="text-[8px] bg-primary/10 text-primary"><User className="h-2 w-2"/></AvatarFallback>
                          </Avatar>
                          <span className="text-[10px] font-bold">{u?.firstName} {u?.lastName[0]}.</span>
                          <X className="h-3 w-3 cursor-pointer text-slate-400 hover:text-destructive transition-colors" onClick={() => handleToggleCatequista(id)} />
                        </Badge>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar catequistas..." 
                    className="pl-9 h-10 rounded-xl bg-white border-slate-200"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                  />
                </div>
                <ScrollArea className="h-[220px] border rounded-2xl p-2 bg-white">
                  <div className="space-y-1">
                    {filteredUsersForDialog.map((u: any) => {
                      const isSelected = selectedCatequistaIds.includes(u.id)
                      return (
                        <div 
                          key={u.id} 
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer group",
                            isSelected 
                              ? "bg-primary text-white shadow-lg" 
                              : "hover:bg-slate-50 border border-transparent"
                          )}
                          onClick={() => handleToggleCatequista(u.id)}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className={cn("h-9 w-9", isSelected ? "border border-white/30" : "border border-slate-100")}>
                              <AvatarImage src={u.photoUrl || undefined} />
                              <AvatarFallback className={cn("text-[10px]", isSelected ? "bg-white/20 text-white" : "bg-primary/10 text-primary")}>
                                <User className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold leading-tight">{u.firstName} {u.lastName}</span>
                              <span className={cn("text-[10px]", isSelected ? "text-white/70" : "text-muted-foreground")}>{u.email}</span>
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
            <div className="p-8 bg-slate-50 border-t flex flex-col gap-3">
              <Button type="submit" disabled={isSubmitting} className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold shadow-lg shadow-primary/20">
                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "Guardar Cambios"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting} className="h-11 rounded-xl text-slate-500 font-semibold hover:bg-slate-100">
                Cerrar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl p-8 border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-headline font-bold text-slate-900">¿Eliminar este grupo?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 text-base">
              Esta acción eliminará el grupo <strong className="text-primary font-bold">{selectedGroup?.name}</strong>. Los catequistas asignados no serán borrados del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3">
            <AlertDialogCancel disabled={isSubmitting} className="h-12 rounded-xl border-slate-200 font-semibold text-slate-500">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-12 rounded-xl font-bold shadow-lg shadow-destructive/20" 
              onClick={(e) => {
                e.preventDefault()
                handleDeleteGroup()
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "Eliminar Definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
