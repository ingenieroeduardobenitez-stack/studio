"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Search, 
  Loader2, 
  FileText, 
  Download, 
  Filter, 
  MapPin, 
  Camera, 
  ClipboardCheck, 
  ArrowRightLeft,
  Info,
  CheckCircle2,
  XCircle,
  ImageIcon,
  Plus,
  Upload,
  User
} from "lucide-react"
import { useFirestore, useCollection, useUser, useStorage } from "@/firebase"
import { collection, query, where, orderBy, getDocs, addDoc, serverTimestamp } from "firebase/firestore"
import { ref, uploadString, getDownloadURL } from "firebase/storage"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useRef } from "react"
import { ReportTemplate } from "@/components/report-components"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

// Datos geográficos simplificados de Paraguay
const DEPARTAMENTOS = [
  "ASUNCIÓN", "CONCEPCIÓN", "SAN PEDRO", "CORDILLERA", "GUAIRÁ", "CAAGUAZÚ", "CAAZAPÁ", "ITAPÚA", 
  "MISIONES", "PARAGUARÍ", "ALTO PARANÁ", "CENTRAL", "ÑEEMBUCÚ", "AMAMBAY", "CANINDEYÚ", 
  "PRESIDENTE HAYES", "BOQUERÓN", "ALTO PARAGUAY"
]

const DISTRITOS: Record<string, string[]> = {
  "ASUNCIÓN": ["ASUNCIÓN"],
  "CENTRAL": ["AREGUÁ", "CAPIATÁ", "FERNANDO DE LA MORA", "ITÁ", "ITAUGUÁ", "LAMBARÉ", "LIMPIO", "LUQUE", "MARIANO ROQUE ALONSO", "ÑEMBY", "SAN ANTONIO", "SAN LORENZO", "VILLA ELISA", "VILLETA", "YPACARAÍ", "YPANE"],
  "ALTO PARANÁ": ["CIUDAD DEL ESTE", "HERNANDARIAS", "PRESIDENTE FRANCO", "MINGA GUAZÚ"],
  "ITAPÚA": ["ENCARNACIÓN", "HOHENAU", "OBLIGADO", "BELLA VISTA"],
  // Se pueden agregar más según sea necesario
}

export default function DivulgationRequestsPage() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filterDept, setFilterDept] = useState<string>("all")
  const [filterDist, setFilterDist] = useState<string>("all")
  const [includeAnexoV, setIncludeAnexoV] = useState(true)
  const [requests, setRequests] = useState<any[]>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Form state para nueva solicitud
  const [newReq, setNewReq] = useState({
    divulgadorName: "",
    departamento: "",
    distrito: "",
    machineId: "",
    divulgadosCount: 0,
    hasAnexoV: true
  })
  const [divulgadorPhoto, setDivulgadorPhoto] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const db = useFirestore()
  const storage = useStorage()
  const { user } = useUser()
  const { toast } = useToast()

  useEffect(() => {
    setMounted(true)
  }, [])

  const filteredDistritos = useMemo(() => {
    if (filterDept === "all") return []
    return DISTRITOS[filterDept] || []
  }, [filterDept])

  const newReqDistritos = useMemo(() => {
    if (!newReq.departamento) return []
    return DISTRITOS[newReq.departamento] || []
  }, [newReq.departamento])

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setDivulgadorPhoto(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSaveRequest = async () => {
    if (!db || !storage || isProcessing) return
    if (!newReq.divulgadorName || !newReq.departamento || !newReq.distrito) {
      toast({ variant: "destructive", title: "Campos incompletos" })
      return
    }

    setIsProcessing(true)
    try {
      let photoUrl = null
      if (divulgadorPhoto) {
        const storageRef = ref(storage, `divulgaciones/photos/${Date.now()}.jpg`)
        await uploadString(storageRef, divulgadorPhoto, 'data_url')
        photoUrl = await getDownloadURL(storageRef)
      }

      await addDoc(collection(db, "divulgaciones"), {
        ...newReq,
        divulgadorPhoto: photoUrl,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || "admin",
        machineExitDate: serverTimestamp(), // Por simplicidad marcamos salida al crear
        activityPhotos: []
      })

      toast({ title: "Solicitud registrada con éxito" })
      setIsAddOpen(false)
      setNewReq({ divulgadorName: "", departamento: "", distrito: "", machineId: "", divulgadosCount: 0, hasAnexoV: true })
      setDivulgadorPhoto(null)
      loadRequests()
    } catch (error) {
      console.error("Error saving request:", error)
      toast({ variant: "destructive", title: "Error al guardar" })
    } finally {
      setIsProcessing(false)
    }
  }

  const loadRequests = async () => {
    if (!db) return
    setLoading(true)
    try {
      const coll = collection(db, "divulgaciones")
      let q = query(coll, orderBy("createdAt", "desc"))
      
      if (filterDept !== "all") {
        q = query(coll, where("departamento", "==", filterDept), orderBy("createdAt", "desc"))
      }
      
      const snap = await getDocs(q)
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      if (filterDist !== "all") {
        data = data.filter((d: any) => d.distrito === filterDist)
      }
      
      setRequests(data)
    } catch (error) {
      console.error("Error loading requests:", error)
      toast({ variant: "destructive", title: "Error de carga" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (mounted) loadRequests()
  }, [mounted, filterDept, filterDist])

  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  const generatePDF = async (request?: any) => {
    const target = request || requests[0]
    if (!target) {
      toast({ variant: "destructive", title: "No hay datos para exportar" })
      return
    }

    // Si pasamos un request específico, lo seleccionamos para que el template se renderice
    setSelectedRequest(target)
    
    toast({ title: "Generando PDF...", description: "Por favor espere un momento." })
    
    // Esperamos a que el componente se renderice en el DOM (aunque sea oculto)
    setTimeout(async () => {
      const element = document.getElementById("report-template")
      if (!element) {
        toast({ variant: "destructive", title: "Error al generar plantilla" })
        return
      }

      try {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          allowTaint: true
        })
        
        const imgData = canvas.toDataURL("image/png")
        const pdf = new jsPDF("p", "mm", "a4")
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width
        
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight)
        pdf.save(`Informe-Divulgacion-${target.divulgadorName?.replace(/\s+/g, '-')}.pdf`)
        
        toast({ title: "PDF Generado con éxito" })
      } catch (error) {
        console.error("PDF Error:", error)
        toast({ variant: "destructive", title: "Error al generar PDF" })
      } finally {
        setSelectedRequest(null)
      }
    }, 500)
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Informe de Solicitudes de Divulgaciones</h1>
          <p className="text-muted-foreground">Compendio general y generación de Anexo V para el TSJE.</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 text-white rounded-xl font-bold gap-2 shadow-lg">
                <Plus size={16} /> Nueva Solicitud
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
              <DialogHeader className="p-8 bg-slate-900 text-white">
                <DialogTitle className="text-2xl font-black">Registrar Nueva Solicitud</DialogTitle>
                <DialogDescription className="text-slate-400">Completa los datos de la actividad y el equipo asignado.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] p-8">
                <div className="space-y-8">
                  {/* Foto del Divulgador */}
                  <div className="flex flex-col items-center gap-4">
                    <Avatar className="h-28 w-28 border-4 border-slate-100 shadow-xl cursor-pointer hover:opacity-80 transition-opacity" onClick={() => fileInputRef.current?.click()}>
                      <AvatarImage src={divulgadorPhoto || ""} className="object-cover" />
                      <AvatarFallback className="bg-slate-100 text-slate-400"><User size={40} /></AvatarFallback>
                    </Avatar>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handlePhotoUpload} accept="image/*" />
                    <Button variant="outline" size="sm" className="rounded-xl font-bold gap-2" onClick={() => fileInputRef.current?.click()}>
                      <Camera size={14} /> Subir Foto del Divulgador
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nombre del Divulgador</Label>
                      <Input 
                        placeholder="Ej. Juan Pérez" 
                        value={newReq.divulgadorName} 
                        onChange={(e) => setNewReq({...newReq, divulgadorName: e.target.value.toUpperCase()})}
                        className="h-12 rounded-xl bg-slate-50 border-slate-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">ID de Máquina</Label>
                      <Input 
                        placeholder="Ej. MV-1023" 
                        value={newReq.machineId} 
                        onChange={(e) => setNewReq({...newReq, machineId: e.target.value.toUpperCase()})}
                        className="h-12 rounded-xl bg-slate-50 border-slate-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Departamento</Label>
                      <Select value={newReq.departamento} onValueChange={(val) => setNewReq({...newReq, departamento: val, distrito: ""})}>
                        <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-100">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPARTAMENTOS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Distrito</Label>
                      <Select value={newReq.distrito} onValueChange={(val) => setNewReq({...newReq, distrito: val})} disabled={!newReq.departamento}>
                        <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-100">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {newReqDistritos.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <Checkbox id="reqAnexo" checked={newReq.hasAnexoV} onCheckedChange={(val) => setNewReq({...newReq, hasAnexoV: !!val})} />
                      <Label htmlFor="reqAnexo" className="text-sm font-bold text-slate-700 cursor-pointer">Requiere Anexo V</Label>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Divulgados Iniciales</Label>
                       <Input 
                        type="number" 
                        className="w-24 h-10 rounded-xl bg-white border-slate-100 text-center font-black" 
                        value={newReq.divulgadosCount} 
                        onChange={(e) => setNewReq({...newReq, divulgadosCount: parseInt(e.target.value) || 0})}
                       />
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="p-8 bg-slate-50 border-t flex justify-end gap-4">
                <Button variant="outline" className="h-12 px-8 rounded-xl font-bold" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
                <Button className="h-12 px-10 rounded-xl bg-primary text-white font-black shadow-xl" onClick={handleSaveRequest} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                  GUARDAR SOLICITUD
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="rounded-xl font-bold gap-2 h-11" onClick={() => loadRequests()}>
            <Loader2 className={loading ? "animate-spin" : "hidden"} size={16} />
            Sincronizar
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold gap-2 h-11 shadow-lg" onClick={() => generatePDF()}>
            <Download size={16} /> Exportar Compendio
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Departamento</Label>
              <Select value={filterDept} onValueChange={(val) => { setFilterDept(val); setFilterDist("all"); }}>
                <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold">
                  <SelectValue placeholder="Seleccionar Departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Departamentos</SelectItem>
                  {DEPARTAMENTOS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Distrito</Label>
              <Select value={filterDist} onValueChange={setFilterDist} disabled={filterDept === "all"}>
                <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold">
                  <SelectValue placeholder="Seleccionar Distrito" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Distritos</SelectItem>
                  {filteredDistritos.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-3 h-12 px-4 bg-slate-50 rounded-xl border border-slate-100">
              <Checkbox id="includeAnexo" checked={includeAnexoV} onCheckedChange={(val) => setIncludeAnexoV(!!val)} />
              <Label htmlFor="includeAnexo" className="text-sm font-bold text-slate-600 cursor-pointer">Incluir Anexo V</Label>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Buscar por divulgador..." className="pl-10 h-12 rounded-xl bg-slate-50 border-slate-100" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Solicitudes */}
      <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden">
        <TableHeader className="bg-slate-50/50 border-b">
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-8 py-5 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Divulgador / Actividad</TableHead>
            <TableHead className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">Ubicación</TableHead>
            <TableHead className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">Máquina (Salida/Retorno)</TableHead>
            <TableHead className="text-center font-bold text-slate-500 uppercase text-[10px] tracking-widest">Divulgados</TableHead>
            <TableHead className="text-right pr-8 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-24 flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
              <p className="text-slate-400 font-medium italic">Cargando base de datos...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-32 text-center">
              <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-10 w-10 text-slate-200" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No hay solicitudes encontradas</h3>
              <p className="text-slate-400 max-w-xs mx-auto mt-2">Ajusta los filtros para encontrar reportes específicos de divulgación.</p>
            </div>
          ) : (
            <Table>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id} className="h-28 hover:bg-slate-50/30 transition-colors border-slate-100">
                    <TableCell className="pl-8">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-14 w-14 border-2 border-white shadow-sm ring-1 ring-slate-100">
                          <AvatarImage src={req.divulgadorPhoto} className="object-cover" />
                          <AvatarFallback className="bg-slate-50 text-slate-300 font-black uppercase text-xs">
                            {req.divulgadorName?.substring(0,2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-black text-sm text-slate-900 uppercase tracking-tight leading-none">{req.divulgadorName}</span>
                          <div className="flex items-center gap-2 mt-2">
                             <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-primary/20 text-primary bg-primary/5">DIVULGACIÓN</Badge>
                             <span className="text-[10px] text-slate-400 font-medium">{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString('es-PY') : 'Reciente'}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={12} className="text-red-500" />
                          <span className="text-xs font-black text-slate-700 uppercase">{req.departamento}</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">{req.distrito}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <ArrowRightLeft size={14} className="text-blue-500" />
                          <span className="text-xs font-bold text-slate-700 uppercase">ID: {req.machineId || '---'}</span>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="secondary" className="bg-green-50 text-green-700 text-[8px] font-black border-none h-5">S: {req.machineExitDate ? 'OK' : 'PEND'}</Badge>
                          <Badge variant="secondary" className="bg-amber-50 text-amber-700 text-[8px] font-black border-none h-5">R: {req.machineReturnDate ? 'OK' : 'PEND'}</Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex flex-col items-center bg-slate-50 px-4 py-2 rounded-2xl border">
                        <span className="text-xl font-black text-slate-900">{req.divulgadosCount || 0}</span>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Personas</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200" title="Ver Fotos">
                          <Camera size={18} />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100" title="Generar Informe" onClick={() => generatePDF(req)}>
                          <FileText size={18} />
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
      
      {/* Footer Informativo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-lg bg-primary text-white rounded-[1.5rem] overflow-hidden">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-white/10 p-3 rounded-2xl">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Total Divulgados</p>
              <h4 className="text-2xl font-black">{requests.reduce((acc, r) => acc + (r.divulgadosCount || 0), 0)}</h4>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-lg bg-slate-900 text-white rounded-[1.5rem] overflow-hidden">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-white/10 p-3 rounded-2xl">
              <ImageIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Evidencia Fotográfica</p>
              <h4 className="text-2xl font-black">{requests.reduce((acc, r) => acc + (r.activityPhotos?.length || 0), 0)} fotos</h4>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-white rounded-[1.5rem] overflow-hidden border border-slate-100">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-blue-50 p-3 rounded-2xl">
              <Info className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Estado del Sistema</p>
              <h4 className="text-sm font-bold text-slate-700">Generación de Anexo V Activa</h4>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Template oculto para generación de PDF */}
      <div className="fixed left-[-9999px] top-0">
        {selectedRequest && (
          <ReportTemplate 
            ref={reportRef} 
            request={selectedRequest} 
            includeAnexoV={includeAnexoV} 
          />
        )}
      </div>
    </div>
  )
}
