
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Archive, 
  Loader2, 
  ArrowUpCircle, 
  CheckCircle2
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, writeBatch, addDoc, serverTimestamp, setDoc, query, where, getDocs } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

export default function ArchiveAdminPage() {
  const [mounted, setMounted] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const { toast } = useToast()
  const db = useFirestore()
  const { user } = useUser()

  const userProfileRef = useMemoFirebase(() => db && user?.uid ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc(userProfileRef)

  useEffect(() => { setMounted(true) }, [])

  // Consulta liviana: solo candidatos a promoción
  const candidatesQuery = useMemoFirebase(() => db ? query(collection(db, "confirmations"), where("isArchived", "==", false)) : null, [db])
  const { data: activeStudents, loading } = useCollection(candidatesQuery)

  const stats = useMemo(() => ({
    firstYear: activeStudents?.filter(r => r.catechesisYear === "PRIMER_AÑO").length || 0,
    graduates: activeStudents?.filter(r => r.catechesisYear === "SEGUNDO_AÑO" || r.catechesisYear === "ADULTOS").length || 0
  }), [activeStudents])

  const handleRecalculateStats = async (database: any) => {
    const q = query(collection(database, "confirmations"), where("isArchived", "==", false))
    const snap = await getDocs(q)
    const newStats = { total: 0, firstYear: 0, secondYear: 0, adults: 0, firstYearSabado: 0, firstYearDomingo: 0, secondYearSabado: 0, secondYearDomingo: 0, adultsSabado: 0, adultsDomingo: 0 }
    snap.forEach(doc => {
      const d = doc.data(); newStats.total++;
      if (d.catechesisYear === "PRIMER_AÑO") { newStats.firstYear++; if (d.attendanceDay === "SABADO") newStats.firstYearSabado++; else newStats.firstYearDomingo++; }
      else if (d.catechesisYear === "SEGUNDO_AÑO") { newStats.secondYear++; if (d.attendanceDay === "SABADO") newStats.secondYearSabado++; else newStats.secondYearDomingo++; }
      else if (d.catechesisYear === "ADULTOS") { newStats.adults++; if (d.attendanceDay === "SABADO") newStats.adultsSabado++; else newStats.adultsDomingo++; }
    });
    await setDoc(doc(database, "settings", "stats"), newStats, { merge: true });
  }

  const handlePromoteFirstToSecond = async () => {
    if (!db || !activeStudents) return
    const students = activeStudents.filter(r => r.catechesisYear === "PRIMER_AÑO")
    if (students.length === 0) return
    setIsProcessing(true)
    const batch = writeBatch(db)
    students.forEach(s => { batch.update(doc(db, "confirmations", s.id), { catechesisYear: "SEGUNDO_AÑO" }) })
    try {
      await batch.commit()
      await handleRecalculateStats(db)
      toast({ title: "Promoción completada y estadísticas actualizadas" })
    } finally { setIsProcessing(false) }
  }

  const handleArchiveGraduates = async () => {
    if (!db || !activeStudents) return
    const graduates = activeStudents.filter(r => r.catechesisYear === "SEGUNDO_AÑO" || r.catechesisYear === "ADULTOS")
    if (graduates.length === 0) return
    setIsProcessing(true)
    const batch = writeBatch(db)
    graduates.forEach(s => { batch.update(doc(db, "confirmations", s.id), { isArchived: true, status: "ARCHIVADO", archiveYear: new Date().getFullYear() }) })
    try {
      await batch.commit()
      await handleRecalculateStats(db)
      toast({ title: "Cierre de año exitoso" })
    } finally { setIsProcessing(false) }
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-headline font-bold text-primary">Cierre de Año y Archivo</h1><p className="text-muted-foreground">Gestiona el paso de año y la culminación de catequesis.</p></div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-none shadow-xl border-l-4 border-l-blue-500 bg-white">
          <CardHeader><CardTitle className="flex items-center gap-2"><ArrowUpCircle className="h-5 w-5" /> Promoción de 1° a 2° Año</CardTitle></CardHeader>
          <CardContent><div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border"><span className="text-sm font-bold uppercase">Candidatos</span><span className="text-2xl font-bold text-blue-600">{stats.firstYear}</span></div></CardContent>
          <CardFooter><Button className="w-full h-12 rounded-xl bg-blue-600 font-bold" onClick={handlePromoteFirstToSecond} disabled={isProcessing || stats.firstYear === 0}>{isProcessing ? <Loader2 className="animate-spin" /> : "Ejecutar Promoción"}</Button></CardFooter>
        </Card>
        <Card className="border-none shadow-xl border-l-4 border-l-accent bg-white">
          <CardHeader><CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5" /> Archivo y Culminación</CardTitle></CardHeader>
          <CardContent><div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border"><span className="text-sm font-bold uppercase">Por Graduarse</span><span className="text-2xl font-bold text-accent">{stats.graduates}</span></div></CardContent>
          <CardFooter><Button className="w-full h-12 rounded-xl bg-accent font-bold" onClick={handleArchiveGraduates} disabled={isProcessing || stats.graduates === 0}>{isProcessing ? <Loader2 className="animate-spin" /> : "Archivar y Graduar"}</Button></CardFooter>
        </Card>
      </div>
    </div>
  )
}
