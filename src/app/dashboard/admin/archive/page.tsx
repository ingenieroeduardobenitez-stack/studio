
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
  Church
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, writeBatch } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export default function ArchiveAdminPage() {
  const [mounted, setMounted] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [isCertificateOpen, setIsCertificateOpen] = useState(false)
  
  const { toast } = useToast()
  const db = useFirestore()

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

  const handlePromoteFirstToSecond = () => {
    if (!db) return
    const studentsToPromote = activeStudents.filter(r => r.catechesisYear === "PRIMER_AÑO")
    if (studentsToPromote.length === 0) return

    setIsProcessing(true)
    const batch = writeBatch(db)
    
    studentsToPromote.forEach(student => {
      const ref = doc(db, "confirmations", student.id)
      batch.update(ref, { catechesisYear: "SEGUNDO_AÑO" })
    })

    batch.commit()
      .then(() => {
        toast({ title: "Proceso completado", description: `${studentsToPromote.length} alumnos promovidos a 2do Año.` })
        setTimeout(() => window.location.reload(), 1500)
      })
      .catch((error) => {
        console.error(error)
        toast({ variant: "destructive", title: "Error", description: "No se pudo realizar la promoción." })
      })
      .finally(() => {
        setIsProcessing(false)
      })
  }

  const handleArchiveGraduates = () => {
    if (!db) return
    const graduates = activeStudents.filter(r => r.catechesisYear === "SEGUNDO_AÑO" || r.catechesisYear === "ADULTOS")
    if (graduates.length === 0) return

    setIsProcessing(true)
    const batch = writeBatch(db)
    const currentYear = new Date().getFullYear()

    graduates.forEach(student => {
      const ref = doc(db, "confirmations", student.id)
      batch.update(ref, { 
        isArchived: true, 
        status: "ARCHIVADO",
        catechesisYear: "COMPLETADO",
        archiveYear: currentYear
      })
    })

    batch.commit()
      .then(() => {
        toast({ title: "Cierre de año exitoso", description: `${graduates.length} alumnos han culminado su proceso.` })
        setTimeout(() => window.location.reload(), 1500)
      })
      .catch((error) => {
        console.error(error)
        toast({ variant: "destructive", title: "Error", description: "No se pudo realizar el archivo." })
      })
      .finally(() => {
        setIsProcessing(false)
      })
  }

  const openCertificate = (student: any) => {
    setSelectedStudent(student)
    setIsCertificateOpen(true)
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
        <Card className="border-none shadow-xl border-l-4 border-l-blue-500">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-xl"><ArrowUpCircle className="h-6 w-6 text-blue-500" /></div>
              <div>
                <CardTitle>Promoción de 1° a 2° Año</CardTitle>
                <CardDescription>Mueve a todos los alumnos de primer año al siguiente nivel.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border mb-4">
              <span className="text-sm font-bold text-slate-600 uppercase tracking-widest">Alumnos Candidatos</span>
              <span className="text-2xl font-bold text-blue-600">{stats.firstYear}</span>
            </div>
            <p className="text-xs text-slate-500 italic">
              * Esta acción cambiará el campo "Año de Catequesis" de todos los inscritos en 1° año a 2° año.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold gap-2"
              onClick={handlePromoteFirstToSecond}
              disabled={isProcessing || stats.firstYear === 0}
            >
              {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <><CheckCircle2 className="h-5 w-5" /> Ejecutar Promoción</>}
            </Button>
          </CardFooter>
        </Card>

        <Card className="border-none shadow-xl border-l-4 border-l-accent">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-xl"><Archive className="h-6 w-6 text-accent" /></div>
              <div>
                <CardTitle>Archivo y Culminación</CardTitle>
                <CardDescription>Cierra el ciclo para 2° Año y Adultos.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border mb-4">
              <span className="text-sm font-bold text-slate-600 uppercase tracking-widest">Alumnos por Graduarse</span>
              <span className="text-2xl font-bold text-accent">{stats.secondYear + stats.adults}</span>
            </div>
            <p className="text-xs text-slate-500 italic">
              * Los alumnos seleccionados serán marcados como "Graduados" y no aparecerán en las listas activas el próximo año.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full h-12 rounded-xl bg-accent hover:bg-accent/90 font-bold gap-2"
              onClick={handleArchiveGraduates}
              disabled={isProcessing || (stats.secondYear + stats.adults) === 0}
            >
              {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <><Archive className="h-5 w-5" /> Archivar y Graduar</>}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card className="border-none shadow-xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Generación de Certificados</CardTitle>
            <CardDescription>Imprime las constancias de fin de año de forma individual.</CardDescription>
          </div>
          <Badge variant="outline" className="bg-white">{activeStudents.length} alumnos activos</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="font-bold">Alumno</TableHead>
                <TableHead className="font-bold">Año Actual</TableHead>
                <TableHead className="font-bold">Estado</TableHead>
                <TableHead className="text-right font-bold pr-8">Documento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="animate-spin mx-auto h-6 w-6 text-primary" /></TableCell></TableRow>
              ) : activeStudents.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No hay alumnos activos para procesar.</TableCell></TableRow>
              ) : (
                activeStudents.map((student) => (
                  <TableRow key={student.id} className="hover:bg-slate-50/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border">
                          <AvatarImage src={student.photoUrl} />
                          <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-slate-900">{student.fullName}</span>
                          <span className="text-[10px] text-slate-500 uppercase">{student.ciNumber}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {student.catechesisYear?.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.paymentStatus === "PAGADO" ? "default" : "outline"} className={cn(student.paymentStatus === "PAGADO" ? "bg-green-500" : "text-red-400 border-red-100")}>
                        {student.paymentStatus === "PAGADO" ? "Al día" : "Deuda"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="gap-2 h-8 border-primary text-primary hover:bg-primary/5"
                        onClick={() => openCertificate(student)}
                      >
                        <FileText className="h-3.5 w-3.5" /> Generar Certificado
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCertificateOpen} onOpenChange={setIsCertificateOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-16 bg-white space-y-12 relative print:p-0" id="certificate-print">
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
              <Church className="h-96 w-96 text-primary" />
            </div>

            <div className="flex flex-col items-center text-center space-y-6">
              <Church className="h-20 w-20 text-primary" />
              <div className="space-y-1">
                <h2 className="text-2xl font-headline font-bold uppercase tracking-[0.2em] text-slate-900">Parroquia Perpetuo Socorro</h2>
                <p className="text-xs font-bold text-primary uppercase tracking-widest">Diócesis de San Lorenzo • Catequesis de Confirmación</p>
              </div>
            </div>

            <div className="text-center space-y-8 relative z-10">
              <h1 className="text-5xl font-headline font-bold text-slate-800">CERTIFICADO</h1>
              <p className="text-lg text-slate-600 leading-relaxed italic">
                Se otorga el presente documento a:
              </p>
              <div className="py-4 border-b-2 border-slate-200 mx-auto max-w-lg">
                <span className="text-3xl font-headline font-bold text-primary uppercase">{selectedStudent?.fullName}</span>
              </div>
              <p className="text-md text-slate-600 max-w-2xl mx-auto leading-relaxed">
                Por haber culminado satisfactoriamente el <span className="font-bold text-slate-800">{selectedStudent?.catechesisYear === "SEGUNDO_AÑO" ? "Segundo Año de Preparación" : "Primer Año de Formación"}</span> de la Catequesis de Confirmación, demostrando compromiso y fe en su camino espiritual.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-12 pt-20">
              <div className="flex flex-col items-center gap-2">
                <div className="h-px w-full bg-slate-300"></div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Firma del Catequista</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="h-px w-full bg-slate-300"></div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sello de la Parroquia</p>
              </div>
            </div>

            <div className="text-center pt-8">
              <p className="text-[10px] text-slate-400 font-medium">Emitido el {new Date().toLocaleDateString()} • Asunción, Paraguay</p>
            </div>
          </div>
          
          <DialogFooter className="p-6 bg-slate-50 border-t flex gap-3 print:hidden">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsCertificateOpen(false)}>Cerrar</Button>
            <Button className="flex-1 gap-2 rounded-xl shadow-lg" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir Certificado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
