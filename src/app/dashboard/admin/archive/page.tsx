
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Archive, 
  Loader2, 
  User, 
  Printer, 
  ArrowUpCircle, 
  CheckCircle2, 
  FileText,
  Church,
  X
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, writeBatch, addDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export default function ArchiveAdminPage() {
  const [mounted, setMounted] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [isCertificateOpen, setIsCertificateOpen] = useState(false)
  
  const { toast } = useToast()
  const db = useFirestore()
  const { user } = useUser()

  const userProfileRef = useMemoFirebase(() => db && user?.uid ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc(userProfileRef)

  useEffect(() => {
    setMounted(true)
  }, [])

  const regsQuery = useMemoFirebase(() => db ? collection(db, "confirmations") : null, [db])
  const { data: allRegistrations, loading } = useCollection(regsQuery)

  const activeStudents = useMemo(() => {
    if (!allRegistrations) return []
    return allRegistrations.filter(r => !r.isArchived)
  }, [allRegistrations])

  const stats = useMemo(() => {
    return {
      firstYear: activeStudents.filter(r => r.catechesisYear === "PRIMER_AÑO").length,
      secondYear: activeStudents.filter(r => r.catechesisYear === "SEGUNDO_AÑO").length,
      adults: activeStudents.filter(r => r.catechesisYear === "ADULTOS").length
    }
  }, [activeStudents])

  const handlePromoteFirstToSecond = async () => {
    if (!db) return
    const studentsToPromote = activeStudents.filter(r => r.catechesisYear === "PRIMER_AÑO")
    if (studentsToPromote.length === 0) return
    setIsProcessing(true)
    const batch = writeBatch(db)
    studentsToPromote.forEach(student => {
      const ref = doc(db, "confirmations", student.id)
      batch.update(ref, { catechesisYear: "SEGUNDO_AÑO" })
    })
    try {
      await batch.commit()
      await addDoc(collection(db, "audit_logs"), {
        userId: user?.uid || "unknown",
        userName: profile ? `${profile.firstName} ${profile.lastName}` : "Administrador",
        action: "Promoción Masiva",
        module: "archivar",
        details: `Se promovieron ${studentsToPromote.length} alumnos de 1er Año a 2do Año`,
        timestamp: serverTimestamp()
      })
      toast({ title: "Proceso completado" })
    } catch (error) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleArchiveGraduates = async () => {
    if (!db) return
    const graduates = activeStudents.filter(r => r.catechesisYear === "SEGUNDO_AÑO" || r.catechesisYear === "ADULTOS")
    if (graduates.length === 0) return
    setIsProcessing(true)
    const batch = writeBatch(db)
    const currentYear = new Date().getFullYear()
    graduates.forEach(student => {
      const ref = doc(db, "confirmations", student.id)
      batch.update(ref, { isArchived: true, status: "ARCHIVADO", catechesisYear: "COMPLETADO", archiveYear: currentYear })
    })
    try {
      await batch.commit()
      await addDoc(collection(db, "audit_logs"), {
        userId: user?.uid || "unknown",
        userName: profile ? `${profile.firstName} ${profile.lastName}` : "Administrador",
        action: "Cierre de Año / Archivo",
        module: "archivar",
        details: `Se archivaron y graduaron ${graduates.length} alumnos satisfactoriamente`,
        timestamp: serverTimestamp()
      })
      toast({ title: "Cierre de año exitoso" })
    } catch (error) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setIsProcessing(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Cierre de Año y Archivo</h1>
          <p className="text-muted-foreground">Gestiona el paso de año y la culminación de catequesis.</p>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-none shadow-xl border-l-4 border-l-blue-500 bg-white">
          <CardHeader><div className="flex items-center gap-3"><div className="p-2 bg-blue-50 rounded-xl"><ArrowUpCircle className="h-6 w-6 text-blue-500" /></div><div><CardTitle>Promoción de 1° a 2° Año</CardTitle></div></div></CardHeader>
          <CardContent><div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border mb-4"><span className="text-sm font-bold text-slate-600 uppercase">Candidatos</span><span className="text-2xl font-bold text-blue-600">{stats.firstYear}</span></div></CardContent>
          <CardFooter><Button className="w-full h-12 rounded-xl bg-blue-600 font-bold gap-2" onClick={handlePromoteFirstToSecond} disabled={isProcessing || stats.firstYear === 0}>{isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <><CheckCircle2 className="h-5 w-5" /> Ejecutar Promoción</>}</Button></CardFooter>
        </Card>
        <Card className="border-none shadow-xl border-l-4 border-l-accent bg-white">
          <CardHeader><div className="flex items-center gap-3"><div className="p-2 bg-accent/10 rounded-xl"><Archive className="h-6 w-6 text-accent" /></div><div><CardTitle>Archivo y Culminación</CardTitle></div></div></CardHeader>
          <CardContent><div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border mb-4"><span className="text-sm font-bold text-slate-600 uppercase">Por Graduarse</span><span className="text-2xl font-bold text-accent">{stats.secondYear + stats.adults}</span></div></CardContent>
          <CardFooter><Button className="w-full h-12 rounded-xl bg-accent font-bold gap-2" onClick={handleArchiveGraduates} disabled={isProcessing || (stats.secondYear + stats.adults) === 0}>{isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <><Archive className="h-5 w-5" /> Archivar y Graduar</>}</Button></CardFooter>
        </Card>
      </div>
    </div>
  )
}
