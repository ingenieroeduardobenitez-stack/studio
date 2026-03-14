
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Dices, 
  Loader2, 
  Users, 
  CheckCircle2, 
  AlertCircle,
  UsersRound,
  Zap,
  Info,
  ArrowRight,
  CalendarDays
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, writeBatch, serverTimestamp, addDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

type AssignmentPreview = {
  groupId: string;
  groupName: string;
  addedMen: string[];
  addedWomen: string[];
}

export default function SortingAdminPage() {
  const [mounted, setMounted] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [preview, setPreview] = useState<AssignmentPreview[] | null>(null)
  const [selectedDay, setSelectedDay] = useState<"SABADO" | "DOMINGO">("SABADO")
  
  const { toast } = useToast()
  const db = useFirestore()
  const { user } = useUser()

  const userProfileRef = useMemoFirebase(() => db && user?.uid ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc(userProfileRef)

  useEffect(() => {
    setMounted(true)
  }, [])

  const regsQuery = useMemoFirebase(() => db ? collection(db, "confirmations") : null, [db])
  const groupsQuery = useMemoFirebase(() => db ? collection(db, "groups") : null, [db])

  const { data: allRegistrations, loading: loadingRegs } = useCollection(regsQuery)
  const { data: allGroups, loading: loadingGroups } = useCollection(groupsQuery)

  // FILTRO: Solo alumnos de primer año, sin grupo, QUE COINCIDAN CON EL DÍA SELECCIONADO
  const unassignedStudents = useMemo(() => {
    if (!allRegistrations) return []
    return allRegistrations.filter(r => 
      !r.isArchived && 
      r.catechesisYear === "PRIMER_AÑO" && 
      (!r.groupId || r.groupId === "none") &&
      r.attendanceDay === selectedDay
    )
  }, [allRegistrations, selectedDay])

  // FILTRO: Solo grupos de primer año DEL DÍA SELECCIONADO
  const targetGroups = useMemo(() => {
    if (!allGroups) return []
    return allGroups.filter(g => 
      g.catechesisYear === "PRIMER_AÑO" && 
      g.attendanceDay === selectedDay
    )
  }, [allGroups, selectedDay])

  const generateSortingPreview = () => {
    if (unassignedStudents.length === 0 || targetGroups.length === 0) {
      toast({
        variant: "destructive",
        title: "No se puede sortear",
        description: `No hay alumnos o grupos disponibles para el día ${selectedDay.toLowerCase()}.`
      })
      return
    }

    const men = [...unassignedStudents.filter(s => s.sexo === "M")].sort(() => Math.random() - 0.5)
    const women = [...unassignedStudents.filter(s => s.sexo === "F")].sort(() => Math.random() - 0.5)
    const unknown = [...unassignedStudents.filter(s => !s.sexo)].sort(() => Math.random() - 0.5)

    const assignmentPreview: AssignmentPreview[] = targetGroups.map(g => ({
      groupId: g.id,
      groupName: g.name,
      addedMen: [],
      addedWomen: []
    }))

    // Distribución equitativa: hombres y desconocidos
    let groupIndex = 0
    men.concat(unknown).forEach(student => {
      assignmentPreview[groupIndex].addedMen.push(student.id)
      groupIndex = (groupIndex + 1) % assignmentPreview.length
    })

    // Distribución equitativa: mujeres
    groupIndex = 0
    women.forEach(student => {
      assignmentPreview[groupIndex].addedWomen.push(student.id)
      groupIndex = (groupIndex + 1) % assignmentPreview.length
    })

    setPreview(assignmentPreview)
  }

  const applyAssignment = async () => {
    if (!db || !preview || isProcessing) return
    setIsProcessing(true)

    try {
      const batch = writeBatch(db)
      let totalAssigned = 0

      preview.forEach(groupPreview => {
        const studentIds = [...groupPreview.addedMen, ...groupPreview.addedWomen]
        studentIds.forEach(id => {
          const studentRef = doc(db, "confirmations", id)
          batch.update(studentRef, { 
            groupId: groupPreview.groupId,
            updatedAt: serverTimestamp()
          })
          totalAssigned++
        })
      })

      await batch.commit()

      await addDoc(collection(db, "audit_logs"), {
        userId: user?.uid || "unknown",
        userName: profile ? `${profile.firstName} ${profile.lastName}` : "Administrador",
        action: "Sorteo Equitativo",
        module: "inscripcion",
        details: `Se distribuyeron ${totalAssigned} alumnos de 1er Año (${selectedDay}) en ${preview.length} grupos.`,
        timestamp: serverTimestamp()
      })

      toast({ title: "Sorteo completado", description: `Se asignaron ${totalAssigned} alumnos con éxito.` })
      setPreview(null)
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error", description: "No se pudieron aplicar los cambios." })
    } finally {
      setIsProcessing(false)
    }
  }

  if (!mounted) return null

  const loading = loadingRegs || loadingGroups

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Sorteo de Grupos</h1>
          <p className="text-muted-foreground">Distribución equitativa por día de asistencia y sexo.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-4 py-1.5 h-auto rounded-xl">
            <Zap className="h-3 w-3 mr-2 fill-primary" /> Exclusivo 1er Año
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 border-none shadow-xl bg-white overflow-hidden border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Configuración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Día a Procesar</Label>
              <Select value={selectedDay} onValueChange={(val: any) => { setSelectedDay(val); setPreview(null); }}>
                <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200">
                  <CalendarDays className="h-4 w-4 mr-2 text-primary" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SABADO">Sábados</SelectItem>
                  <SelectItem value="DOMINGO">Domingos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-6 bg-slate-50 rounded-[2rem] border border-dashed text-center space-y-2">
              <p className="text-4xl font-black text-primary">{unassignedStudents.length}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Alumnos sin grupo ({selectedDay.toLowerCase()}s)</p>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs px-2">
                <span className="font-bold text-slate-500 uppercase tracking-tighter">Mujeres</span>
                <span className="font-black text-pink-600">{unassignedStudents.filter(s => s.sexo === "F").length}</span>
              </div>
              <div className="flex items-center justify-between text-xs px-2">
                <span className="font-bold text-slate-500 uppercase tracking-tighter">Hombres</span>
                <span className="font-black text-blue-600">{unassignedStudents.filter(s => s.sexo === "M" || !s.sexo).length}</span>
              </div>
              <Separator className="bg-slate-100" />
              <div className="flex items-center justify-between text-xs px-2">
                <span className="font-bold text-slate-500 uppercase tracking-tighter">Grupos Disponibles</span>
                <span className="font-black text-primary">{targetGroups.length}</span>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-start gap-3">
              <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[9px] text-blue-700 leading-relaxed font-medium">
                El sorteo repartirá a los confirmandos que eligieron asistir los <strong>{selectedDay.toLowerCase()}s</strong> entre los grupos disponibles de ese mismo día.
              </p>
            </div>
          </CardContent>
          <CardFooter className="bg-slate-50 p-6 border-t">
            <Button 
              className="w-full h-14 rounded-2xl font-black shadow-lg gap-2 active:scale-95 transition-transform" 
              onClick={generateSortingPreview}
              disabled={unassignedStudents.length === 0 || targetGroups.length === 0 || loading || isProcessing}
            >
              {loading ? <Loader2 className="animate-spin" /> : <><Dices className="h-5 w-5" /> Iniciar Sorteo</>}
            </Button>
          </CardFooter>
        </Card>

        <div className="md:col-span-2 space-y-6">
          {!preview ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
              <div className="bg-white p-6 rounded-full shadow-sm mb-6">
                <UsersRound className="h-12 w-12 text-slate-200" />
              </div>
              <h3 className="text-lg font-bold text-slate-400">Esperando ejecución de sorteo</h3>
              <p className="text-xs text-slate-400 mt-2 max-w-xs">
                Selecciona el día y presiona "Iniciar Sorteo" para ver la distribución equitativa.
              </p>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right duration-500">
              <div className="flex items-center justify-between bg-white p-6 rounded-3xl border shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Vista Previa Generada</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Distribución para {selectedDay.toLowerCase()}s</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-xl h-11 font-bold" onClick={() => setPreview(null)}>Cancelar</Button>
                  <Button className="rounded-xl h-11 bg-green-600 hover:bg-green-700 font-bold px-8 shadow-lg gap-2" onClick={applyAssignment} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : <><Zap className="h-4 w-4" /> Aplicar Cambios</>}
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {preview.map((group) => (
                  <Card key={group.groupId} className="border-none shadow-md bg-white overflow-hidden rounded-[2rem]">
                    <CardHeader className="bg-primary/5 p-5 border-b border-primary/10">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-black text-primary uppercase truncate">{group.groupName}</CardTitle>
                        <Badge className="bg-primary text-white h-6 px-3">{group.addedMen.length + group.addedWomen.length} nuevos</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-blue-600 uppercase">Hombres</span>
                          </div>
                          <span className="text-lg font-black text-blue-700">{group.addedMen.length}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-pink-50 rounded-xl border border-pink-100">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-pink-600 uppercase">Mujeres</span>
                          </div>
                          <span className="text-lg font-black text-pink-700">{group.addedWomen.length}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
