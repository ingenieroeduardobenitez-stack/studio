
"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserPlus, Search, MoreHorizontal, Loader2, ShieldCheck, Edit, Trash2, Camera, User, Check, X } from "lucide-react"
import { useFirestore, useCollection } from "@/firebase"
import { collection, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { initializeApp, deleteApp } from "firebase/app"
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth"
import { firebaseConfig } from "@/firebase/config"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"

const AVAILABLE_MODULES = [
  { id: "inicio", name: "Inicio", category: "Operaciones" },
  { id: "asistencia", name: "Mi Lista (Asistencia)", category: "Operaciones" },
  { id: "confirmandos", name: "Confirmandos", category: "Operaciones" },
  { id: "inscripcion", name: "Nueva Inscripción", category: "Operaciones" },
  { id: "cambio_grupo", name: "Cambio de Grupo", category: "Operaciones" },
  { id: "pagos_alumnos", name: "Gestión de Pagos", category: "Operaciones" },
  { id: "tesoreria", name: "Gestión Tesorería", category: "Tesorería" },
  { id: "perfil", name: "Mi Perfil", category: "Configuración" },
  { id: "usuarios", name: "Gestión de Usuarios", category: "Administración" },
  { id: "grupos", name: "Gestión de Grupos", category: "Administración" },
  { id: "archivar", name: "Cierre de Año / Archivo", category: "Administración" },
]

const PERMISSIONS = [
  { id: "ver", name: "Ver" },
  { id: "guardar", name: "Guardar" },
  { id: "editar", name: "Editar" },
  { id: "borrar", name: "Borrar" },
  { id: "pdf", name: "PDF" },
]

export default function UsersAdminPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [tempPhoto, setTempPhoto] = useState<string | null>(null)
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  
  const createPhotoRef = useRef<HTMLInputElement>(null)
  const editPhotoRef = useRef<HTMLInputElement>(null)
  
  const { toast } = useToast()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const usersQuery = useMemo(() => {
    if (!db) return null
    return collection(db, "users")
  }, [db])

  const { data: users, loading } = useCollection(usersQuery)

  const filteredUsers = useMemo(() => {
    if (!users) return []
    return users.filter(u => 
      `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [users, searchTerm])

  const handleTogglePermission = (moduleId: string, permId: string) => {
    const permissionKey = `${moduleId}:${permId}`
    setSelectedModules(prev => 
      prev.includes(permissionKey) 
        ? prev.filter(p => p !== permissionKey) 
        : [...prev, permissionKey]
    )
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setTempPhoto(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || isSubmitting) return
    setIsSubmitting(true)
    
    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const firstName = formData.get("firstName") as string
    const lastName = formData.get("lastName") as string
    const role = formData.get("role") as string

    const appName = `SecondaryApp-${Date.now()}`
    let secondaryApp;

    try {
      secondaryApp = initializeApp(firebaseConfig, appName)
      const secondaryAuth = getAuth(secondaryApp)
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password)
      const newUser = userCredential.user
      await signOut(secondaryAuth)

      const userData = {
        firstName: firstName || "",
        lastName: lastName || "",
        email: email || "",
        role: role || "Catequista",
        allowedModules: selectedModules,
        photoUrl: tempPhoto || null,
        createdAt: serverTimestamp(),
      }

      await setDoc(doc(db, "users", newUser.uid), userData)
      
      toast({ title: "Usuario creado", description: `Se ha registrado a ${firstName} correctamente.` })
      
      setIsCreateDialogOpen(false)
      setTempPhoto(null)
      setSelectedModules([])

    } catch (error: any) {
      console.error("Error creating user:", error)
      toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo completar el registro." })
    } finally {
      setIsSubmitting(false)
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp)
        } catch (e) {
          console.error("Error deleting secondary app:", e)
        }
      }
    }
  }

  const handleEditUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedUser || !db || isSubmitting) return
    setIsSubmitting(true)
    
    try {
      const formData = new FormData(e.currentTarget)
      const userData = {
        firstName: formData.get("firstName") as string || "",
        lastName: formData.get("lastName") as string || "",
        role: formData.get("role") as string || "Catequista",
        allowedModules: selectedModules,
        photoUrl: tempPhoto || selectedUser.photoUrl || null
      }

      await updateDoc(doc(db, "users", selectedUser.id), userData)

      toast({ title: "Usuario actualizado", description: "Cambios guardados." })
      setIsEditDialogOpen(false)
      setTempPhoto(null)
    } catch (error: any) {
      console.error("Error editing user:", error)
      toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar los cambios." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser || !db || isSubmitting) return
    setIsSubmitting(true)

    try {
      await deleteDoc(doc(db, "users", selectedUser.id))
      toast({ title: "Usuario eliminado", description: "El perfil ha sido borrado." })
      setIsDeleteDialogOpen(false)
    } catch (error: any) {
      console.error("Error deleting user:", error)
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el usuario." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getAssignedModuleNames = (allowedModules: string[] = []) => {
    const moduleIds = Array.from(new Set(allowedModules.map(m => m.split(':')[0])))
    return moduleIds
      .map(id => AVAILABLE_MODULES.find(m => m.id === id)?.name)
      .filter(Boolean)
  }

  const renderPermissionsGrid = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-primary">Módulos Asignados</h4>
      </div>
      <Accordion type="multiple" className="w-full space-y-2">
        {["Operaciones", "Tesorería", "Configuración", "Administración"].map(category => (
          <AccordionItem key={category} value={category} className="border rounded-xl overflow-hidden bg-white shadow-sm">
            <AccordionTrigger className="px-4 py-3 hover:bg-slate-50 hover:no-underline">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{category}</span>
            </AccordionTrigger>
            <AccordionContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="w-1/3 text-[10px] font-bold text-slate-500">MÓDULO</TableHead>
                    {PERMISSIONS.map(p => (
                      <TableHead key={p.id} className="text-center text-[10px] font-bold text-slate-500 px-1">{p.name.toUpperCase()}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {AVAILABLE_MODULES.filter(m => m.category === category).map(module => (
                    <TableRow key={module.id} className="border-t border-slate-100 hover:bg-slate-50/30">
                      <TableCell className="text-sm font-medium text-slate-700 py-3">{module.name}</TableCell>
                      {PERMISSIONS.map(p => {
                        const permKey = `${module.id}:${p.id}`
                        const isChecked = selectedModules.includes(permKey)
                        return (
                          <TableCell key={p.id} className="text-center py-3 px-1">
                            <Checkbox 
                              checked={isChecked}
                              onCheckedChange={() => handleTogglePermission(module.id, p.id)}
                              className="mx-auto rounded-full h-5 w-5 border-slate-300"
                            />
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Gestión de Catequistas</h1>
          <p className="text-muted-foreground">Administra los accesos y permisos detallados por módulo.</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open)
          if (!open) { setTempPhoto(null); setSelectedModules([]); }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <UserPlus className="mr-2 h-4 w-4" /> Nuevo Catequista
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
            <form onSubmit={handleCreateUser} className="flex flex-col h-full overflow-hidden">
              <DialogHeader className="p-6 bg-primary text-white shrink-0">
                <DialogTitle>Añadir Catequista</DialogTitle>
                <DialogDescription className="text-white/80">
                  Ingresa los datos y define los permisos específicos.
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="flex justify-center">
                  <div className="relative group cursor-pointer" onClick={() => createPhotoRef.current?.click()}>
                    <Avatar className="h-20 w-20 border-2 border-slate-100">
                      <AvatarImage src={tempPhoto || undefined} />
                      <AvatarFallback className="bg-slate-50 text-slate-300"><User className="h-10 w-10" /></AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-5 w-5 text-white" />
                    </div>
                    <input type="file" ref={createPhotoRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nombre</Label>
                    <Input id="firstName" name="firstName" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Apellido</Label>
                    <Input id="lastName" name="lastName" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo Electrónico</Label>
                    <Input id="email" name="email" type="email" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Rol Principal</Label>
                    <Select name="role" defaultValue="Catequista">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Catequista">Catequista</SelectItem>
                        <SelectItem value="Coordinador">Coordinador</SelectItem>
                        <SelectItem value="Tesorero">Tesorero</SelectItem>
                        <SelectItem value="Administrador">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña Inicial</Label>
                  <Input id="password" name="password" type="password" required />
                </div>
                {renderPermissionsGrid()}
              </div>
              
              <DialogFooter className="p-6 bg-slate-50 border-t mt-auto shrink-0">
                <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-xl text-base font-bold shadow-lg">
                  {isSubmitting ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "Registrar Catequista"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar..." 
              className="pl-9 bg-white border-slate-200 h-11" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="py-4 font-bold text-slate-500">Catequista</TableHead>
                  <TableHead className="py-4 font-bold text-slate-500">Rol</TableHead>
                  <TableHead className="py-4 font-bold text-slate-500">Módulos</TableHead>
                  <TableHead className="py-4 text-right font-bold text-slate-500 pr-8">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u: any) => {
                  const moduleNames = getAssignedModuleNames(u.allowedModules)
                  return (
                    <TableRow key={u.id} className="hover:bg-slate-50/50 border-slate-100 h-20">
                      <TableCell>
                        <div className="flex items-center gap-4">
                          <Avatar className="h-10 w-10"><AvatarImage src={u.photoUrl || undefined} /><AvatarFallback>{(u.firstName?.[0] || "")}</AvatarFallback></Avatar>
                          <div className="flex flex-col"><span className="font-bold text-slate-900">{u.firstName} {u.lastName}</span><span className="text-xs text-slate-400">{u.email}</span></div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />{u.role || "Catequista"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[250px]">
                          {moduleNames.map((name, idx) => (<Badge key={idx} variant="secondary" className="text-[9px]">{name}</Badge>))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><button className="p-2 hover:bg-slate-100 rounded-full"><MoreHorizontal className="h-5 w-5 text-slate-400" /></button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[200px] p-2 rounded-xl shadow-xl border-none">
                            <DropdownMenuItem onClick={() => { setSelectedUser(u); setSelectedModules(u.allowedModules || []); setIsEditDialogOpen(true); }} className="h-11 rounded-lg gap-3">
                              <Edit className="h-4 w-4 text-slate-400" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive h-11 rounded-lg gap-3" onClick={() => { setSelectedUser(u); setIsDeleteDialogOpen(true); }}>
                              <Trash2 className="h-4 w-4" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open)
        if (!open) { setSelectedUser(null); setTempPhoto(null); setSelectedModules([]); }
      }}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
          <form onSubmit={handleEditUser} className="flex flex-col h-full overflow-hidden">
            <DialogHeader className="p-6 bg-primary text-white shrink-0">
              <DialogTitle>Editar Catequista</DialogTitle>
              <DialogDescription className="text-white/80">Actualiza datos o permisos.</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex justify-center">
                <div className="relative group cursor-pointer" onClick={() => editPhotoRef.current?.click()}>
                  <Avatar className="h-20 w-20 border-2 border-slate-100">
                    <AvatarImage src={tempPhoto || selectedUser?.photoUrl || undefined} />
                    <AvatarFallback><User className="h-10 w-10" /></AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100"><Camera className="h-5 w-5 text-white" /></div>
                  <input type="file" ref={editPhotoRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Nombre</Label><Input name="firstName" defaultValue={selectedUser?.firstName} required /></div>
                <div className="space-y-2"><Label>Apellido</Label><Input name="lastName" defaultValue={selectedUser?.lastName} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Email</Label><Input value={selectedUser?.email || ""} readOnly className="bg-slate-50" /></div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select name="role" defaultValue={selectedUser?.role || "Catequista"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Catequista">Catequista</SelectItem>
                      <SelectItem value="Coordinador">Coordinador</SelectItem>
                      <SelectItem value="Tesorero">Tesorero</SelectItem>
                      <SelectItem value="Administrador">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {renderPermissionsGrid()}
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t shrink-0">
              <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-xl font-bold shadow-lg">
                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar catequista?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción borrará el perfil definitivamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white" onClick={handleDeleteUser}>
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
