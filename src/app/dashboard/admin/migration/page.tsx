"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Loader2, Database, Upload, CheckCircle2, AlertTriangle, Cloud } from "lucide-react"
import { useFirestore, useStorage } from "@/firebase"
import { collection, getDocs, doc, updateDoc, writeBatch } from "firebase/firestore"
import { ref, uploadString, getDownloadURL } from "firebase/storage"
import { useToast } from "@/hooks/use-toast"

export default function ImageMigrationPage() {
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [processed, setProcessed] = useState(0)
  const [migrated, setMigrated] = useState(0)
  const [errors, setErrors] = useState(0)
  const [isFinished, setIsFinished] = useState(false)
  
  const db = useFirestore()
  const storage = useStorage()
  const { toast } = useToast()

  const migrateImages = async () => {
    if (!db || !storage || loading) return
    
    setLoading(true)
    setIsFinished(false)
    setProcessed(0)
    setMigrated(0)
    setErrors(0)

    // Definición de las colecciones y sus campos de imagen
    const migrationTasks = [
      {
        collection: "confirmations",
        fields: ['photoUrl', 'paymentProofUrl', 'baptismCertificatePhotoUrl', 'studentPhoto', 'paymentProof', 'baptismCert']
      },
      {
        collection: "users",
        fields: ['photoUrl']
      }
    ]

    try {
      let totalDocs = 0
      const allDocs: { col: string, doc: any }[] = []

      // Primero contamos y recolectamos todos los documentos
      for (const task of migrationTasks) {
        const snap = await getDocs(collection(db, task.collection))
        totalDocs += snap.docs.length
        snap.docs.forEach(d => allDocs.push({ col: task.collection, doc: d }))
      }

      setTotal(totalDocs)
      
      for (const entry of allDocs) {
        const data = entry.doc.data()
        const id = entry.doc.id
        const col = entry.col
        let needsUpdate = false
        const updateData: any = {}

        const task = migrationTasks.find(t => t.collection === col)
        if (!task) continue

        for (const field of task.fields) {
          const value = data[field]
          if (value && typeof value === 'string' && value.startsWith('data:')) {
            try {
              // Nombre de archivo descriptivo basado en el campo
              let fileName = "file.jpg"
              if (value.includes('application/pdf')) fileName = "document.pdf"
              else if (field.includes('Photo') || field === 'photoUrl') fileName = "profile.jpg"
              else if (field.includes('Proof') || field === 'paymentProof') fileName = "payment_proof.jpg"
              else if (field.includes('Cert')) fileName = "baptism_cert.jpg"

              const storageRef = ref(storage, `${col}/${id}/${fileName}`)
              await uploadString(storageRef, value, 'data_url')
              updateData[field] = await getDownloadURL(storageRef)
              needsUpdate = true
            } catch (e) {
              console.error(`Error migrating ${field} for ${id} in ${col}:`, e)
              setErrors(prev => prev + 1)
            }
          }
        }

        if (needsUpdate) {
          await updateDoc(doc(db, col, id), updateData)
          setMigrated(prev => prev + 1)
        }
        
        setProcessed(prev => prev + 1)
      }
      
      setIsFinished(true)
      toast({ title: "Migración completada", description: `Se optimizaron registros de Inscripciones y Usuarios.` })
    } catch (e: any) {
      console.error("Migration error:", e)
      toast({ variant: "destructive", title: "Error fatal", description: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <div className="bg-primary/10 p-3 rounded-2xl text-primary"><Database className="h-8 w-8" /></div>
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Migrador de Imágenes</h1>
          <p className="text-muted-foreground font-medium">Limpia Firestore eliminando fotos en Base64 y moviéndolas a Storage.</p>
        </div>
      </div>

      <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden">
        <CardHeader className="p-8">
          <CardTitle>Optimización de Almacenamiento</CardTitle>
          <CardDescription>Esta herramienta buscará todos los registros que contengan imágenes integradas en la base de datos y las subirá automáticamente a Firebase Storage.</CardDescription>
        </CardHeader>
        <CardContent className="p-10 space-y-8">
          {!loading && !isFinished && (
            <div className="bg-amber-50 border-2 border-amber-100 p-6 rounded-3xl flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-amber-600 mt-1 shrink-0" />
              <div>
                <p className="font-bold text-amber-900">Advertencia</p>
                <p className="text-sm text-amber-800 leading-relaxed">
                  Este proceso puede tardar varios minutos dependiendo de la cantidad de registros y la calidad de tu conexión. No cierres esta pestaña mientras el proceso esté en marcha.
                </p>
              </div>
            </div>
          )}

          {(loading || isFinished) && (
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Progreso de la Migración</p>
                  <p className="text-3xl font-black text-slate-900">{processed} <span className="text-slate-300">/ {total}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-green-600 tracking-widest">Migrados</p>
                  <p className="text-3xl font-black text-green-600">{migrated}</p>
                </div>
              </div>
              
              <Progress value={(processed / total) * 100} className="h-6 rounded-full bg-slate-100" />
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                <div className="p-4 bg-slate-50 rounded-2xl border text-center">
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Procesados</p>
                  <p className="text-xl font-black text-slate-700">{processed}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-2xl border border-green-100 text-center">
                  <p className="text-[9px] font-bold text-green-600 uppercase">Exitosos</p>
                  <p className="text-xl font-black text-green-600">{migrated}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-center">
                  <p className="text-[9px] font-bold text-red-600 uppercase">Errores</p>
                  <p className="text-xl font-black text-red-600">{errors}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                  <p className="text-[9px] font-bold text-blue-600 uppercase">Restantes</p>
                  <p className="text-xl font-black text-blue-600">{total - processed}</p>
                </div>
              </div>
            </div>
          )}

          {isFinished && (
            <div className="bg-green-600 p-8 rounded-[2rem] text-white flex items-center justify-between shadow-xl shadow-green-100">
              <div className="flex items-center gap-6">
                <CheckCircle2 className="h-12 w-12" />
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Migración Finalizada</h3>
                  <p className="text-white/80 font-medium italic">Todos los registros detectados han sido optimizados.</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-slate-50 p-8 border-t flex justify-end gap-4">
          <Button variant="outline" className="h-14 px-8 rounded-2xl font-bold" disabled={loading} onClick={() => window.history.back()}>Regresar</Button>
          {!isFinished ? (
            <Button className="h-14 px-12 rounded-2xl bg-primary text-white font-black shadow-xl gap-3 active:scale-95 transition-all text-lg" disabled={loading} onClick={migrateImages}>
              {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Cloud className="h-6 w-6" />}
              INICIAR MIGRACIÓN A STORAGE
            </Button>
          ) : (
            <Button className="h-14 px-12 rounded-2xl bg-green-600 text-white font-black hover:bg-green-700" onClick={() => setIsFinished(false)}>REPETIR ESCANEO</Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
