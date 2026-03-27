
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  User, 
  Calendar, 
  RefreshCcw,
  AlertCircle
} from "lucide-react"
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc, updateDoc, serverTimestamp, writeBatch } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

function AttendanceCalendar({ studentId }: { studentId: string }) {
  const db = useFirestore()
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() // 0-11
  
  const calendarData = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const rows: (Date | null)[][] = []
    let currentRow: (Date | null)[] = [null, null] // [Sat, Sun]
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i)
      if (d.getDay() === 6) { currentRow[0] = d } 
      else if (d.getDay() === 0) {
        currentRow[1] = d
        rows.push(currentRow)
        currentRow = [null, null]
      }
    }
    if (currentRow[0] !== null) rows.push(currentRow)
    
    const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
    return { rows, startStr, endStr }
  }, [year, month])

  const attendanceQuery = useMemoFirebase(() => {
    if (!db || !studentId) return null
    return query(
      collection(db, "confirmations", studentId, "attendance"),
      where("date", ">=", calendarData.startStr),
      where("date", "<=", calendarData.endStr)
    )
  }, [db, studentId, calendarData])

  const { data: attendanceDocs } = useCollection(attendanceQuery)
  
  const historyMap = useMemo(() => {
    const map = new Map<string, string>()
    attendanceDocs?.forEach((doc: any) => { map.set(doc.date, doc.status) })
    return map
  }, [attendanceDocs])

  const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

  return (
    <div className="flex flex-col items-center gap-2 py-1">
       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mes de {monthNames[month]} de {year}</span>
       <div className="flex flex-col gap-1">
          <div className="flex gap-2 w-full justify-between px-2 mb-1">
             <div className="text-[10px] font-black text-slate-300 w-5 text-center">S</div>
             <div className="text-[10px] font-black text-slate-300 w-5 text-center">D</div>
          </div>
          {calendarData.rows.map((row, rIdx) => (
             <div key={rIdx} className="flex gap-2 justify-center">
               {row.map((date: any, cIdx) => {
                 if (!date) return <div key={cIdx} className="w-6 h-6" />
                 
                 const dateAsLocalStr = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
                 const isToday = dateAsLocalStr === new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
                 
                 const localStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                 const status = historyMap.get(localStr)
                 
                 return (
                   <div key={cIdx} className={cn(
                     "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all shadow-sm",
                     status === "PRESENTE" ? "bg-green-100 text-green-700 border-green-300" :
                     status === "AUSENTE" ? "bg-red-100 text-red-700 border-red-300" :
                     status === "JUSTIFICADO" ? "bg-amber-100 text-amber-700 border-amber-300" :
                     isToday ? "bg-slate-800 text-white border-none ring-2 ring-primary ring-offset-1" :
                     "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
                   )}>
                     {date.getDate()}
                   </div>
                 )
               })}
             </div>
          ))}
       </div>
    </div>
  )
}

export default function MyListPage() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user?.uid) return null
    return doc(db, "users", user.uid)
  }, [db, user?.uid])
  const { data: profile } = useDoc(userProfileRef)

  const myGroupsQuery = useMemoFirebase(() => {
    if (!db || !user?.uid) return null
    return query(collection(db, "groups"), where("catequistaIds", "array-contains", user.uid))
  }, [db, user?.uid])

  const { data: myGroups, loading: loadingGroups } = useCollection(myGroupsQuery)

  const groupParams = useMemo(() => {
    if (!myGroups || myGroups.length === 0) return null
    return {
      day: myGroups[0].attendanceDay,
      year: myGroups[0].catechesisYear,
      otherDay: myGroups[0].attendanceDay === "SABADO" ? "DOMINGO" : "SABADO"
    }
  }, [myGroups])

  const myConfirmandsQuery = useMemoFirebase(() => {
    if (!db || !groupParams) return null
    return query(
      collection(db, "confirmations"), 
      where("attendanceDay", "==", groupParams.day),
      where("catechesisYear", "==", groupParams.year)
    )
  }, [db, groupParams])

  const recoveryConfirmandsQuery = useMemoFirebase(() => {
    if (!db || !groupParams) return null
    return query(
      collection(db, "confirmations"), 
      where("attendanceDay", "==", groupParams.otherDay),
      where("needsRecovery", "==", true)
    )
  }, [db, groupParams])

  const { data: myConfirmands, loading: loadingMyConf } = useCollection(myConfirmandsQuery)
  const { data: recoveryConfirmands, loading: loadingRecovery } = useCollection(recoveryConfirmandsQuery)

  const handleAttendance = (id: string, status: "PRESENTE" | "AUSENTE") => {
    if (!db) return
    setUpdatingId(id)
    
    const regRef = doc(db, "confirmations", id)
    const isRecovery = recoveryConfirmands?.some(r => r.id === id)
    
    const catechistName = profile ? `${profile.firstName} ${profile.lastName}` : (user?.email || "Catequista")
    const updateData = {
      attendanceStatus: status,
      needsRecovery: !isRecovery && status === "AUSENTE",
      ...(isRecovery && status === "PRESENTE" ? { needsRecovery: false } : {}),
      lastAttendanceUpdate: serverTimestamp(),
      lastAttendanceTakenBy: catechistName
    }

    const todayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0]
    const attendanceRef = doc(db, "confirmations", id, "attendance", `${id}_${todayStr}`)
    
    const batch = writeBatch(db)
    batch.update(regRef, updateData)
    batch.set(attendanceRef, {
      date: todayStr,
      status: status,
      registeredBy: user?.uid || "admin",
      timestamp: serverTimestamp()
    }, { merge: true })

    batch.commit()
      .then(() => {
        toast({
          title: status === "PRESENTE" ? "Asistencia marcada" : "Ausencia registrada",
          description: status === "AUSENTE" ? "Habilitado para recuperación el día opuesto." : "Confirmando presente.",
        })
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
        setUpdatingId(null)
      })
  }

  if (loadingGroups) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!myGroups || myGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-3xl border shadow-sm">
        <Users className="h-16 w-16 text-slate-200 mb-4" />
        <h2 className="text-xl font-headline font-bold text-slate-900">No tienes grupos asignados</h2>
        <p className="text-muted-foreground mt-2 max-w-md">Contacta con el administrador para que te asigne a un grupo de catequesis.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Mi Lista de Catequesis</h1>
          <p className="text-muted-foreground">
            Gestión de asistencia para {myGroups[0].name} ({groupParams?.day === "SABADO" ? "Sábados" : "Domingos"})
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border shadow-sm">
          <Calendar className="h-5 w-5 text-accent" />
          <div className="text-sm">
            <p className="font-bold text-slate-900">{groupParams?.year.replace("_", " ")}</p>
            <p className="text-[10px] text-slate-500 uppercase">{myGroups[0].schedule}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="border-none shadow-xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-headline">Alumnos Regulares</CardTitle>
                <CardDescription>Confirmandos inscritos para asistir los {groupParams?.day.toLowerCase()}s.</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs bg-white">{myConfirmands?.length || 0} alumnos</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingMyConf ? (
              <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
            ) : myConfirmands?.length === 0 ? (
              <div className="py-12 text-center text-slate-500">No hay alumnos inscritos en este día.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Foto</TableHead>
                    <TableHead>Nombre Completo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Última Asistencia</TableHead>
                    <TableHead className="text-right">Control</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myConfirmands?.map((conf: any) => (
                    <TableRow key={conf.id}>
                      <TableCell>
                        <Avatar className="h-10 w-10 border shadow-sm">
                          <AvatarImage src={conf.photoUrl || undefined} className="object-cover" />
                          <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{conf.fullName}</span>
                          <span className="text-[10px] text-slate-500 uppercase">{conf.ciNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={conf.attendanceStatus === "PRESENTE" ? "default" : conf.attendanceStatus === "AUSENTE" ? "destructive" : "secondary"}
                          className={cn(conf.attendanceStatus === "PRESENTE" ? "bg-green-500" : "")}
                        >
                          {conf.attendanceStatus || "PENDIENTE"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <AttendanceCalendar studentId={conf.id} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200"
                            onClick={() => handleAttendance(conf.id, "PRESENTE")}
                            disabled={updatingId === conf.id}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Presente
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border-red-200"
                            onClick={() => handleAttendance(conf.id, "AUSENTE")}
                            disabled={updatingId === conf.id}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Ausente
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl overflow-hidden border-t-4 border-t-accent">
          <CardHeader className="bg-accent/5 border-b border-accent/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-accent/10 p-2 rounded-xl">
                  <RefreshCcw className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-lg font-headline text-accent">Recuperatorios ({groupParams?.otherDay === "SABADO" ? "Sábados" : "Domingos"})</CardTitle>
                  <CardDescription>Alumnos del otro día que faltaron y deben recuperar hoy.</CardDescription>
                </div>
              </div>
              {recoveryConfirmands?.length === 0 ? null : (
                <Badge className="bg-accent">{recoveryConfirmands?.length} pendientes</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingRecovery ? (
              <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
            ) : !recoveryConfirmands || recoveryConfirmands?.length === 0 ? (
              <div className="py-12 text-center text-slate-400 italic text-sm">No hay alumnos registrados para recuperación.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-accent/5">
                    <TableHead className="w-[80px]">Foto</TableHead>
                    <TableHead>Nombre Completo</TableHead>
                    <TableHead>Día Original</TableHead>
                    <TableHead>Última Asistencia</TableHead>
                    <TableHead className="text-right">Control</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recoveryConfirmands?.map((conf: any) => (
                    <TableRow key={conf.id} className="hover:bg-accent/[0.02]">
                      <TableCell>
                        <Avatar className="h-10 w-10 border-2 border-accent/20">
                          <AvatarImage src={conf.photoUrl || undefined} className="object-cover" />
                          <AvatarFallback className="bg-accent/5 text-accent"><User className="h-5 w-5" /></AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{conf.fullName}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <AlertCircle className="h-3 w-3 text-accent" />
                            <span className="text-[10px] font-bold text-accent uppercase">Requiere Recuperación</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase">{conf.attendanceDay}</Badge>
                      </TableCell>
                      <TableCell>
                        {conf.lastAttendanceUpdate ? (
                           <div className="flex flex-col">
                             <span className="text-xs font-bold text-slate-700">
                               {conf.lastAttendanceUpdate?.toDate ? conf.lastAttendanceUpdate.toDate().toLocaleDateString('es-PY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : "Reciente"}
                             </span>
                             <span className="text-[10px] text-slate-400 capitalize">Por: {conf.lastAttendanceTakenBy?.toLowerCase() || "Desconocido"}</span>
                           </div>
                        ) : (
                           <span className="text-xs text-slate-400 italic">No registrada</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          className="h-8 bg-accent hover:bg-accent/90"
                          onClick={() => handleAttendance(conf.id, "PRESENTE")}
                          disabled={updatingId === conf.id}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar Asistió
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
