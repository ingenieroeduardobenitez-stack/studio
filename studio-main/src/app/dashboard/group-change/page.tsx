"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  ArrowLeftRight, 
  Search, 
  Loader2, 
  User, 
  Info,
  History,
  Check
} from "lucide-react"
import { useFirestore, useCollection, useUser, useMemoFirebase } from "@/firebase"
import { collection, doc, updateDoc, arrayUnion } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

export default function GroupChangePage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedReg, setSelectedReg] = useState<any>(null)
  const [newGroupId, setNewGroupId] = useState<string>("")
  const [changeReason, setChangeReason] = useState("")
  const [isChangeDialogOpen, setIsChangeDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { user } = useUser()
  const { toast } = useToast()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const regsQuery = useMemoFirebase(() => db ? collection(db, "confirmations") : null, [db])
  const { data: allRegistrations, loading: loadingRegs } = useCollection(regsQuery)

  const groupsQuery = useMemoFirebase(() => db ? collection(db, "groups") : null, [db])
  const { data: allGroups, loading: loadingGroups } = useCollection(groupsQuery)

  const filteredConfirmands = useMemo(() => {
    if (!allRegistrations) return []
    return allRegistrations.filter(r => 
      r.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.ciNumber?.includes(searchTerm)
    )
  }, [allRegistrations, searchTerm])

  const currentGroup = useMemo(() => {
    if (!selectedReg || !allGroups) return null
    return allGroups.find(g => g.id === selectedReg.groupId) || {
      name: "Sin grupo asignado",
      attendanceDay: selectedReg.attendanceDay,
      catechesisYear: selectedReg.catechesisYear
    }
  }, [selectedReg, allGroups])

  const availableGroups = useMemo(() => {
    if (!selectedReg || !allGroups) return []
    return allGroups.filter(g => 
      g.catechesisYear === selectedReg.catechesisYear && 
      g.id !== selectedReg.groupId
    )
  }, [selectedReg, allGroups])

  const handleOpenChangeDialog = (reg: any) => {
    setSelectedReg(reg)
    setNewGroupId("")
    setChangeReason("")
    setIsChangeDialogOpen(true)
  }

  const handleProcessChange = () => {
    if (!db || !selectedReg || !newGroupId || !changeReason) return
    setIsSubmitting(true)

    const newGroup = allGroups?.find(g => g.id === newGroupId)
    if (!newGroup) return

    const regRef = doc(db, "confirmations", selectedReg.id)
    
    const changeEntry = {
      oldGroupId: selectedReg.groupId || "none",
      newGroupId: newGroupId,
      reason: changeReason,
      date: new Date().toISOString(),
      authorizedBy: user?.uid || "admin"
    }

    const updateData = {
      groupId: newGroupId,
      attendanceDay: newGroup.attendanceDay,
      changeHistory: arrayUnion(changeEntry)
    }

    updateDoc(regRef, updateData)
      .then(() => {
        toast({
          title: "Traslado Exitoso",
          description: `${selectedReg.fullName} ha sido movido al grupo "${newGroup.name}".`
        })
        setIsChangeDialogOpen(false)
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: regRef.path,
          operation: 'update',
          requestResourceData: updateData,
        })
        errorEmitter.emit('permission-error', permissionError)
      })
      .finally(() => {
        setIsSubmitting(false)
      })
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Traslados de Grupo</h1>
          <p className="text-muted-foreground">Gestiona los cambios de horario y día de tus confirmandos.</p>
        </div>
      </div>

      <Card className="border-none shadow-xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar confirmando por nombre o C.I." 
                className="pl-9 bg-white border-slate-200" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <Info className="h-4 w-4" />
              <span>Solo se permiten cambios entre grupos del mismo año.</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingRegs || loadingGroups ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredConfirmands.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground italic">Ingresa un término de búsqueda para encontrar confirmandos.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-bold">Confirmando</TableHead>
                  <TableHead className="font-bold">Año</TableHead>
                  <TableHead className="font-bold">Grupo Actual</TableHead>
                  <TableHead className="font-bold">Día</TableHead>
                  <TableHead className="text-right font-bold pr-8">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConfirmands.map((reg) => {
                  const regGroup = allGroups?.find(g => g.id === reg.groupId)
                  return (
                    <TableRow key={reg.id} className="hover:bg-slate-50/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border">
                            <AvatarImage src={reg.photoUrl} />
                            <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-slate-900">{reg.fullName}</span>
                            <span className="text-[10px] text-slate-500 uppercase font-bold">{reg.ciNumber}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {reg.catechesisYear?.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {regGroup?.name || "Sin grupo"}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs italic text-slate-600">
                          {reg.attendanceDay === "SABADO" ? "Sábados" : "Domingos"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 gap-2 border-primary text-primary hover:bg-primary/5"
                          onClick={() => handleOpenChangeDialog(reg)}
                        >
                          <ArrowLeftRight className="h-3 w-3" /> Cambiar Grupo
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isChangeDialogOpen} onOpenChange={setIsChangeDialogOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" /> Solicitar Cambio de Grupo
            </DialogTitle>
            <DialogDescription className="text-white/80">
              Traslado oficial para {selectedReg?.fullName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grupo Actual</p>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">{currentGroup?.name}</span>
                  <span className="text-[10px] text-slate-500 uppercase">{currentGroup?.attendanceDay}s</span>
                </div>
              </div>
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 space-y-2">
                <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Año de Catequesis</p>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-primary">{selectedReg?.catechesisYear?.replace("_", " ")}</span>
                  <span className="text-[10px] text-primary/60 uppercase">Inalterable</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="font-bold text-slate-700">Seleccionar Nuevo Grupo</Label>
              <Select value={newGroupId} onValueChange={setNewGroupId}>
                <SelectTrigger className="h-12 rounded-xl bg-slate-50">
                  <SelectValue placeholder="¿A qué grupo se traslada?" />
                </SelectTrigger>
                <SelectContent>
                  {availableGroups.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">No hay otros grupos disponibles para este año.</div>
                  ) : (
                    availableGroups.map((g: any) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} ({g.attendanceDay}s - {g.schedule})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="font-bold text-slate-700">Motivo del Cambio</Label>
              <Textarea 
                placeholder="Explica brevemente por qué se realiza el traslado"
                className="min-h-[100px] rounded-xl bg-slate-50 border-slate-200 resize-none"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
              />
            </div>

            {selectedReg?.changeHistory?.length > 0 && (
              <div className="space-y-3">
                <Label className="font-bold text-slate-700 flex items-center gap-2">
                  <History className="h-4 w-4" /> Historial de Cambios
                </Label>
                <div className="max-h-[120px] overflow-y-auto border rounded-xl p-3 bg-slate-50/50 space-y-2">
                  {selectedReg.changeHistory.map((h: any, i: number) => (
                    <div key={i} className="text-[10px] border-b pb-2 last:border-0">
                      <p className="font-bold text-slate-700">{new Date(h.date).toLocaleDateString()} - {h.reason}</p>
                      <p className="text-slate-500">Autorizado por: {h.authorizedBy}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setIsChangeDialogOpen(false)}>Cancelar</Button>
            <Button 
              className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 font-bold shadow-lg" 
              onClick={handleProcessChange} 
              disabled={!newGroupId || !changeReason || isSubmitting}
            >
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <><Check className="h-4 w-4 mr-2" /> Procesar Cambio</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
