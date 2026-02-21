
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserPlus, Search, MoreHorizontal, Loader2, ShieldCheck, Edit, Trash2 } from "lucide-react"
import { useFirestore, useCollection } from "@/firebase"
import { collection, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

export default function UsersAdminPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  
  const { toast } = useToast()
  const db = useFirestore()

  const usersQuery = useMemo(() => {
    if (!db) return null
    return collection(db, "users")
  }, [db])

  const { data: users, loading } = useCollection(usersQuery)

  const filteredUsers = useMemo(() => {
    if (!users) return []
    return users.filter(u => 
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [users, searchTerm])

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    
    const userData = {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      email: formData.get("email") as string,
      role: formData.get("role") as string,
      createdAt: serverTimestamp(),
    }

    const newUserId = `user_${Date.now()}`
    const userRef = doc(db, "users", newUserId)

    setDoc(userRef, userData)
      .then(() => {
        toast({
          title: "Usuario creado",
          description: `Se ha creado el perfil para ${userData.firstName} correctamente.`,
        })
        setIsCreateDialogOpen(false)
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: userRef.path,
          operation: 'create',
          requestResourceData: userData,
        })
        errorEmitter.emit('permission-error', permissionError)
      })
      .finally(() => setIsSubmitting(false))
  }

  const handleEditUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedUser) return
    setIsSubmitting(true)
    
    const formData = new FormData(e.currentTarget)
    const userData = {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      role: formData.get("role") as string,
    }

    const userRef = doc(db, "users", selectedUser.id)

    updateDoc(userRef, userData)
      .then(() => {
        toast({
          title: "Usuario actualizado",
          description: "Los cambios se han guardado correctamente.",
        })
        setIsEditDialogOpen(false)
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: userRef.path,
          operation: 'update',
          requestResourceData: userData,
        })
        errorEmitter.emit('permission-error', permissionError)
      })
      .finally(() => setIsSubmitting(false))
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return
    setIsSubmitting(true)

    const userRef = doc(db, "users", selectedUser.id)

    deleteDoc(userRef)
      .then(() => {
        toast({
          title: "Usuario eliminado",
          description: "El registro ha sido borrado del sistema.",
        })
        setIsDeleteDialogOpen(false)
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: userRef.path,
          operation: 'delete',
        })
        errorEmitter.emit('permission-error', permissionError)
      })
      .finally(() => setIsSubmitting(false))
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">Administra los accesos y roles de los catequistas.</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <UserPlus className="mr-2 h-4 w-4" /> Crear Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleCreateUser}>
              <DialogHeader>
                <DialogTitle>Añadir Nuevo Usuario</DialogTitle>
                <DialogDescription>
                  Ingresa los detalles del nuevo miembro de la parroquia.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nombre</Label>
                    <Input id="firstName" name="firstName" placeholder="Ej. Juan" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Apellido</Label>
                    <Input id="lastName" name="lastName" placeholder="Ej. Pérez" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input id="email" name="email" type="email" placeholder="usuario@parroquia.org" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol del Sistema</Label>
                  <Select name="role" defaultValue="Catequista">
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Catequista">Catequista</SelectItem>
                      <SelectItem value="Coordinador">Coordinador</SelectItem>
                      <SelectItem value="Administrador">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Guardar Usuario"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nombre o correo..." 
                className="pl-9" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Registro</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold">{u.firstName} {u.lastName}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-3 w-3 text-primary" />
                        <span className="text-sm">{u.role}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        ACTIVO
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : 'Pendiente'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => { setSelectedUser(u); setIsEditDialogOpen(true); }}>
                            <Edit className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive" 
                            onClick={() => { setSelectedUser(u); setIsDeleteDialogOpen(true); }}
                          >
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

      {/* Diálogo Editar Usuario */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleEditUser}>
            <DialogHeader>
              <DialogTitle>Editar Usuario</DialogTitle>
              <DialogDescription>
                Modifica los detalles del perfil del usuario.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-firstName">Nombre</Label>
                  <Input id="edit-firstName" name="firstName" defaultValue={selectedUser?.firstName} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-lastName">Apellido</Label>
                  <Input id="edit-lastName" name="lastName" defaultValue={selectedUser?.lastName} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Correo (No editable)</Label>
                <Input value={selectedUser?.email} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Rol del Sistema</Label>
                <Select name="role" defaultValue={selectedUser?.role}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Catequista">Catequista</SelectItem>
                    <SelectItem value="Coordinador">Coordinador</SelectItem>
                    <SelectItem value="Administrador">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alerta Confirmar Borrado */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente al usuario <strong>{selectedUser?.firstName} {selectedUser?.lastName}</strong> del sistema. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteUser}>
              Eliminar Definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
