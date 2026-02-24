
"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { 
  CalendarCheck, 
  Search, 
  Loader2, 
  User, 
  AlertTriangle, 
  Phone, 
  MessageCircle, 
  FileText, 
  ImageIcon, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ChevronRight,
  Filter,
  Eye,
  X
} from "lucide-react"
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc, setDoc, serverTimestamp, updateDoc, increment } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"

export default function AttendanceControlPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all")
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [isJustifyDialogOpen, setIsJustifyDialogOpen] = useState(false)
  const [justificationProof, setJustificationProof] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isProofViewOpen, setIsProofViewOpen] = useState(false)
  const [viewProofUrl, setViewProofUrl] = useState<string | null>(null)

  const proofInputRef = useRef<HTMLInputElement>(null)
  const { user: currentUser } = useUser()
  const { toast } = useToast()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const groupsQuery = useMemoFirebase(() => db ? collection(db, "groups") : null, [db])
  const { data: groups } = useCollection(groupsQuery)

  const regsQuery = useMemoFirebase(() => {
    if (!db || !currentUser) return null
    return collection(db, "confirmations")
  }, [db, currentUser])
  const { data: allRegistrations, loading: loadingRegs } = useCollection(regsQuery)

  const filteredStudents = useMemo(() => {
    if (!allRegistrations) return []
    return allRegistrations.filter(r => {
      const matchesSearch = r.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || r.ciNumber?.includes(searchTerm)
      const matchesGroup = selectedGroupId === "all" || r.groupId === selectedGroupId
      return matchesSearch && matchesGroup && !r.isArchived
    })
  }, [allRegistrations, searchTerm, selectedGroupId])

  const handleMarkAttendance = async (student: any, status: "PRESENTE" | "AUSENTE") => {
    if (!db || isSubmitting) return
    setIsSubmitting(true)

    const attendanceId = `${student.id}_${attendanceDate}`
    const attendanceRef = doc(db, "confirmations", student.id, "attendance", attendanceId)
    const studentRef = doc(db, "confirmations", student.id)

    try {
      await setDoc(attendanceRef, {
        date: attendanceDate,
        status,
        registeredBy: currentUser?.uid || "admin",
        timestamp: serverTimestamp()
      }, { merge: true })

      if (status === "AUSENTE") {
        await updateDoc(studentRef, {
          absenceCount: increment(1),
          lastAttendanceUpdate: serverTimestamp()
        })
      }

      toast({ title: "Asistencia registrada", description: `${student.fullName} marcado como ${status.toLowerCase()}.` })
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error al registrar" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleJustifyAttendance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !selectedStudent || isSubmitting) return
    setIsSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const notes = formData.get("notes") as string
    const attendanceId = `${selectedStudent.id}_${attendanceDate}`
    const attendanceRef = doc(db, "confirmations", selectedStudent.id, "attendance", attendanceId)

    try {
      await setDoc(attendanceRef, {
        date: attendanceDate,
        status: "JUSTIFICADO",
        justificationUrl: justificationProof,
        justificationNotes: notes,
        registeredBy: currentUser?.uid || "admin",
        timestamp: serverTimestamp()
      }, { merge: true })

      toast({ title: "Ausencia justificada", description: "El registro ha sido actualizado correctamente." })
      setIsJustifyDialogOpen(false)
      setJustificationProof(null)
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error al justificar" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setJustificationProof(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const openWhatsApp = (phone: string, name: string) => {
    const msg = encodeURIComponent(`Hola, le escribimos del Santuario Nacional Nuestra Señora del Perpetuo Socorro sobre la asistencia de ${name} a la catequesis de Confirmación...`)
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank')
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Control de Asistencia</h1>
          <p className="text-muted-foreground">Registro de presentismo y alertas de inasistencias del Santuario.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border shadow-sm">
            <Clock className="h-4 w-4 text-slate-400" />
            <Input 
              type="date" 
              className="border-none bg-transparent p-0 h-auto font-bold text-sm w-[130px]" 
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="md:col-span-1 space-y-6">
          <Card className="border-none shadow-xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4 text-primary" /> Filtrar Lista</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Grupo</Label>
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger className="h-11 rounded-xl bg-slate-50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los grupos</SelectItem>
                    {groups?.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Buscador</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Nombre o C.I..." 
                    className="pl-9 h-11 rounded-xl bg-slate-50" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-primary text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10"><CalendarCheck className="h-20 w-20" /></div>
            <CardHeader><CardTitle className="text-white text-lg">Resumen Diario</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{filteredStudents.length}</div>
              <p className="text-[10px] text-white/70 uppercase font-bold tracking-widest">Confirmandos en lista</p>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-3">
          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <CardContent className="p-0">
              {loadingRegs ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-24 text-center">
                  <User className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">No se encontraron confirmandos para este filtro.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="font-bold pl-8">Confirmando</TableHead>
                      <TableHead className="font-bold text-center">Inasistencias</TableHead>
                      <TableHead className="font-bold text-center">Estado Hoy</TableHead>
                      <TableHead className="text-right font-bold pr-8">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => {
                      const hasAlert = (student.absenceCount || 0) >= 3
                      return (
                        <TableRow key={student.id} className={cn("hover:bg-slate-50/30 h-20 transition-colors", hasAlert && "bg-red-50/50")}>
                          <TableCell className="pl-8">
                            <div className="flex items-center gap-4">
                              <Avatar className="h-10 w-10 border shadow-sm">
                                <AvatarImage src={student.photoUrl} className="object-cover" />
                                <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="font-bold text-sm text-slate-900">{student.fullName}</span>
                                <span className="text-[10px] text-slate-500">{student.phone}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Badge variant={hasAlert ? "destructive" : "secondary"} className={cn("h-6 px-3 text-[10px] font-black", hasAlert && "animate-pulse")}>
                                {student.absenceCount || 0} AUSENCIAS
                              </Badge>
                              {hasAlert && (
                                <span className="text-[9px] font-bold text-red-600 uppercase flex items-center gap-1">
                                  <AlertTriangle className="h-2.5 w-2.5" /> Comunicar a padres
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-9 w-9 p-0 rounded-full border-green-200 hover:bg-green-500 hover:text-white text-green-600"
                                onClick={() => handleMarkAttendance(student, "PRESENTE")}
                                disabled={isSubmitting}
                              >
                                <CheckCircle2 className="h-5 w-5" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-9 w-9 p-0 rounded-full border-red-200 hover:bg-red-500 hover:text-white text-red-600"
                                onClick={() => handleMarkAttendance(student, "AUSENTE")}
                                disabled={isSubmitting}
                              >
                                <XCircle className="h-5 w-5" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-8">
                            <div className="flex justify-end gap-2">
                              {hasAlert && (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-9 w-9 p-0 rounded-full bg-green-50 text-green-600 hover:bg-green-100"
                                  onClick={() => openWhatsApp(student.phone || student.motherPhone || student.fatherPhone || "", student.fullName)}
                                  title="WhatsApp padres"
                                >
                                  <MessageCircle className="h-5 w-5" />
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-9 px-4 rounded-xl font-bold text-[10px] gap-2"
                                onClick={() => { setSelectedStudent(student); setIsJustifyDialogOpen(true); }}
                              >
                                <FileText className="h-3.5 w-3.5" /> JUSTIFICAR
                              </Button>
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
        </div>
      </div>

      <Dialog open={isJustifyDialogOpen} onOpenChange={setIsJustifyDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <DialogTitle>Justificar Inasistencia</DialogTitle>
            <DialogDescription className="text-white/80">Confirmando: {selectedStudent?.fullName}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleJustifyAttendance} className="flex flex-col">
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <Label className="font-bold text-slate-700">Observaciones / Motivo</Label>
                <Textarea 
                  name="notes" 
                  placeholder="Ej. Justificado por enfermedad según chat de WhatsApp." 
                  className="rounded-xl min-h-[100px] bg-slate-50 border-slate-200"
                  required
                />
              </div>
              <div className="space-y-3">
                <Label className="font-bold text-slate-700">Comprobante (Print de pantalla o Certificado)</Label>
                <div 
                  className={cn(
                    "border-2 border-dashed rounded-2xl h-48 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all",
                    justificationProof ? "border-green-500 bg-green-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
                  )}
                  onClick={() => proofInputRef.current?.click()}
                >
                  {justificationProof ? (
                    <img src={justificationProof} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <ImageIcon className="h-10 w-10 text-slate-300 mb-2" />
                      <span className="text-xs font-bold text-slate-400 uppercase">Cargar Foto de Justificación</span>
                    </>
                  )}
                </div>
                <input type="file" ref={proofInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3">
              <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsJustifyDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 font-bold shadow-lg" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Guardar Justificación"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isProofViewOpen} onOpenChange={setIsProofViewOpen}>
        <DialogContent className="max-w-3xl p-0 bg-transparent border-none shadow-none flex items-center justify-center">
          <DialogHeader className="sr-only"><DialogTitle>Vista de Justificante</DialogTitle></DialogHeader>
          <div className="relative">
            <Button 
              variant="secondary" 
              size="icon" 
              className="absolute -top-12 -right-12 rounded-full h-10 w-10 bg-white/20 text-white" 
              onClick={() => setIsProofViewOpen(false)}
            ><X className="h-6 w-6" /></Button>
            <img src={viewProofUrl || ""} className="max-h-[90vh] rounded-xl shadow-2xl" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
