
"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
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
import { Shapes, Plus, Search, MoreHorizontal, Loader2, Edit, Trash2, Users, User, X, Check } from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export default function GroupsAdminPage() {
  const [mounted, setMounted] = useState(false)
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

  useEffect(() => {
    setMounted(true)
  }, [])

  const usersQuery = useMemoFirebase(() => db ? collection(db, "users") : null, [db])
  const groupsQuery = useMemoFirebase(() => db ? collection(db, "groups") : null, [db])

  const { data: users, loading: loadingUsers } = useCollection(usersQuery)
  const { data: groups, loading: loadingGroups } = useCollection(groupsQuery)

  const filteredGroups = useMemo(() => {
    if (!groups) return []
    return groups.filter(g => g.name?.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [groups, searchTerm])

  const filteredUsersForDialog = useMemo(() => {
    if (!users) return []
    return users.filter(u => 
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(memberSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(memberSearch.toLowerCase())
    )
  }, [users, memberSearch])

  const handleToggleCatequista = useCallback((userId: string) => {
    setSelectedCatequistaIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }, [])

  const handleCreateGroup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || isSubmitting) return
    if (selectedCatequistaIds.length === 0) {
      toast({ variant: "destructive", title: "Atención", description: "Selecciona al menos un catequista." })
      return
    }

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const attendanceDay = formData.get("attendanceDay") as string
    const catechesisYear = formData.get("catechesisYear") as string
    const schedule = attendanceDay === "SABADO" ? "15:30 a 18:30 hs" : "08:00 a 11:00 hs"

    const groupId = `group_${Date.now()}`
    try {
      await setDoc(doc(db, "groups", groupId), {
        name: name || "",
        catequistaIds: selectedCatequistaIds,
        attendanceDay: attendanceDay || "SABADO",
        schedule: schedule || "",
        catechesisYear: catechesisYear || "PRIMER_AÑO",
        createdAt: serverTimestamp(),
      })
      toast({ title: "Grupo creado" })
      setIsCreateDialogOpen(false)
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditGroup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !selectedGroup || isSubmitting) return
    setIsSubmitting(true)
    
    const formData = new FormData(e.currentTarget)
    const attendanceDay = formData.get("attendanceDay") as string
    const schedule = attendanceDay === "SABADO" ? "15:30 a 18:30 hs" : "08:00 a 11:00 hs"

    try {
      await updateDoc(doc(db, "groups", selectedGroup.id), {
        name: formData.get("name") as string || "",
        catequistaIds: selectedCatequistaIds,
        attendanceDay: attendanceDay || "SABADO",
        schedule: schedule || "",
        catechesisYear: formData.get("catechesisYear") as string || "PRIMER_AÑO"
      })
      toast({ title: "Grupo actualizado" })
      setIsEditDialogOpen(false)
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (!db || !selectedGroup || isSubmitting) return
    setIsSubmitting(true)
    try {
      await deleteDoc(doc(db, "groups", selectedGroup.id))
      toast({ title: "Grupo eliminado" })
      setIsDeleteDialogOpen(false)
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Grupos de Catequesis</h1>
          <p className="text-muted-foreground">Organiza a tus catequistas en equipos de trabajo.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Crear Nuevo Grupo
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-9 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {(loadingGroups || loadingUsers) ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50"><TableHead className="font-bold">Nombre</TableHead><TableHead className="font-bold">Día / Año</TableHead><TableHead className="font-bold">Miembros</TableHead><TableHead className="text-right pr-8 font-bold">Acciones</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.map((group: any) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-bold">{group.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="mr-2">{group.attendanceDay}</Badge>
                      <Badge variant="outline">{group.catechesisYear?.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex -space-x-2">
                        {group.catequistaIds?.slice(0, 3).map((id: string) => {
                          const u = users?.find(u => u.id === id)
                          return (<Avatar key={id} className="h-7 w-7 border-2 border-white"><AvatarImage src={u?.photoUrl || undefined} /><AvatarFallback><User className="h-3 w-3"/></AvatarFallback></Avatar>)
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedGroup(group); setSelectedCatequistaIds(group.catequistaIds || []); setIsEditDialogOpen(true); }}><Edit className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => { setSelectedGroup(group); setIsDeleteDialogOpen(true); }}><Trash2 className="mr-2 h-4 w-4" /> Eliminar</DropdownMenuItem>
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
        <DialogContent className="sm:max-w-[500px] flex flex-col max-h-[90vh] p-0 overflow-hidden">
          <form onSubmit={handleCreateGroup} className="flex flex-col h-full overflow-hidden">
            <DialogHeader className="p-6 bg-primary text-white shrink-0"><DialogTitle>Nuevo Grupo</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-2"><Label>Nombre</Label><Input name="name" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Día</Label><Select name="attendanceDay" defaultValue="SABADO"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SABADO">Sábados</SelectItem><SelectItem value="DOMINGO">Domingos</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Año</Label><Select name="catechesisYear" defaultValue="PRIMER_AÑO"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PRIMER_AÑO">1° Año</SelectItem><SelectItem value="SEGUNDO_AÑO">2° Año</SelectItem><SelectItem value="ADULTOS">Adultos</SelectItem></SelectContent></Select></div>
              </div>
              <div className="space-y-3">
                <Label>Miembros ({selectedCatequistaIds.length})</Label>
                <div className="border rounded-xl p-3 bg-slate-50 flex flex-wrap gap-2">
                  {selectedCatequistaIds.map(id => {
                    const u = users?.find(u => u.id === id)
                    return (<Badge key={id} variant="secondary" className="gap-1">{u?.firstName} <X className="h-3 w-3 cursor-pointer" onClick={() => handleToggleCatequista(id)} /></Badge>)
                  })}
                </div>
                <ScrollArea className="h-[150px] border rounded-xl p-2 bg-white">
                  {filteredUsersForDialog.map(u => (
                    <div key={u.id} className={cn("flex items-center justify-between p-2 rounded-lg cursor-pointer mb-1", selectedCatequistaIds.includes(u.id) ? "bg-primary text-white" : "hover:bg-slate-100")} onClick={() => handleToggleCatequista(u.id)}>
                      <span className="text-sm">{u.firstName} {u.lastName}</span>
                      {selectedCatequistaIds.includes(u.id) && <Check className="h-4 w-4" />}
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t shrink-0"><Button type="submit" disabled={isSubmitting} className="w-full h-11">{isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Crear Grupo"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] flex flex-col max-h-[90vh] p-0 overflow-hidden">
          <form onSubmit={handleEditGroup} className="flex flex-col h-full overflow-hidden">
            <DialogHeader className="p-6 bg-primary text-white shrink-0"><DialogTitle>Editar Grupo</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-2"><Label>Nombre</Label><Input name="name" defaultValue={selectedGroup?.name} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Día</Label><Select name="attendanceDay" defaultValue={selectedGroup?.attendanceDay}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SABADO">Sábados</SelectItem><SelectItem value="DOMINGO">Domingos</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Año</Label><Select name="catechesisYear" defaultValue={selectedGroup?.catechesisYear}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PRIMER_AÑO">1° Año</SelectItem><SelectItem value="SEGUNDO_AÑO">2° Año</SelectItem><SelectItem value="ADULTOS">Adultos</SelectItem></SelectContent></Select></div>
              </div>
              <div className="space-y-3">
                <Label>Miembros ({selectedCatequistaIds.length})</Label>
                <ScrollArea className="h-[200px] border rounded-xl p-2 bg-white">
                  {users?.map(u => (
                    <div key={u.id} className={cn("flex items-center justify-between p-2 rounded-lg cursor-pointer mb-1", selectedCatequistaIds.includes(u.id) ? "bg-primary text-white" : "hover:bg-slate-100")} onClick={() => handleToggleCatequista(u.id)}>
                      <span className="text-sm">{u.firstName} {u.lastName}</span>
                      {selectedCatequistaIds.includes(u.id) && <Check className="h-4 w-4" />}
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t shrink-0"><Button type="submit" disabled={isSubmitting} className="w-full h-11">{isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Guardar Cambios"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar este grupo?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white" onClick={handleDeleteGroup}>
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
