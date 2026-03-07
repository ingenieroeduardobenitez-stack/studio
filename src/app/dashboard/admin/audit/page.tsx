
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { 
  Search, 
  Loader2, 
  History, 
  Filter, 
  User, 
  Calendar,
  Activity,
  ArrowRightLeft,
  Wallet,
  UserPlus,
  Trash2,
  Edit,
  Clock,
  Archive,
  CheckCircle2,
  Eye
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit } from "firebase/firestore"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export default function AuditPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedLog, setSelectedLog] = useState<any>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const auditQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(200))
  }, [db])

  const { data: logs, loading } = useCollection(auditQuery)

  const filteredLogs = useMemo(() => {
    if (!logs) return []
    return logs.filter(log => 
      log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.module?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [logs, searchTerm])

  const getActionIcon = (action: string) => {
    const act = action.toLowerCase()
    if (act.includes("crear") || act.includes("registro")) return <UserPlus className="h-4 w-4 text-green-500" />
    if (act.includes("pago") || act.includes("cobro") || act.includes("validación")) return <Wallet className="h-4 w-4 text-orange-500" />
    if (act.includes("cambio") || act.includes("traslado")) return <ArrowRightLeft className="h-4 w-4 text-blue-500" />
    if (act.includes("editar") || act.includes("actualizar") || act.includes("perfil")) return <Edit className="h-4 w-4 text-indigo-500" />
    if (act.includes("eliminar") || act.includes("borrar") || act.includes("baja")) return <Trash2 className="h-4 w-4 text-red-500" />
    if (act.includes("promoción") || act.includes("archivo") || act.includes("cierre")) return <Archive className="h-4 w-4 text-purple-500" />
    if (act.includes("asistencia")) return <CheckCircle2 className="h-4 w-4 text-teal-500" />
    return <Activity className="h-4 w-4 text-slate-400" />
  }

  const getModuleBadge = (module: string) => {
    switch (module?.toLowerCase()) {
      case "inscripcion": return <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">Inscripciones</Badge>
      case "pagos": 
      case "tesoreria": return <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">Tesorería</Badge>
      case "grupos": return <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Grupos</Badge>
      case "usuarios": return <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">Usuarios</Badge>
      case "asistencia": return <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700">Asistencia</Badge>
      case "archivar": return <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">Cierre de Año</Badge>
      default: return <Badge variant="secondary" className="capitalize">{module}</Badge>
    }
  }

  const openLogDetails = (log: any) => {
    setSelectedLog(log)
    setIsDetailsOpen(true)
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Auditoría del Sistema</h1>
          <p className="text-muted-foreground">Registro cronológico de todas las acciones realizadas por el personal.</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-3 rounded-2xl border shadow-sm">
          <History className="h-5 w-5 text-primary ml-2" />
          <span className="text-sm font-bold text-slate-700 pr-4">{logs?.length || 0} Movimientos</span>
        </div>
      </div>

      <Card className="border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por usuario, acción o detalles..." 
                className="pl-9 bg-white border-slate-200 h-11 rounded-xl" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-slate-400">Cargando bitácora...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-24 text-center">
              <Activity className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium italic">No se encontraron movimientos que coincidan.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/30 hover:bg-transparent">
                  <TableHead className="py-4 font-bold text-slate-500 w-[180px]">Fecha y Hora</TableHead>
                  <TableHead className="py-4 font-bold text-slate-500">Usuario</TableHead>
                  <TableHead className="py-4 font-bold text-slate-500">Acción</TableHead>
                  <TableHead className="py-4 font-bold text-slate-500">Módulo</TableHead>
                  <TableHead className="py-4 font-bold text-slate-500">Vista Previa</TableHead>
                  <TableHead className="py-4 text-right pr-8 font-bold text-slate-500">Ficha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log: any) => (
                  <TableRow key={log.id} className="hover:bg-slate-50/50 border-slate-100 h-16 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900">
                          {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Reciente'}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {log.timestamp ? formatDistanceToNow(log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp), { addSuffix: true, locale: es }) : ''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-xs font-bold text-slate-700">{log.userName || 'Sistema'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <span className="text-xs font-bold text-slate-600 truncate max-w-[150px]">{log.action}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getModuleBadge(log.module)}
                    </TableCell>
                    <TableCell>
                      <p className="text-[10px] text-slate-500 max-w-[200px] truncate italic">
                        {log.details || 'Sin información adicional'}
                      </p>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => openLogDetails(log)}>
                        <Eye className="h-4 w-4 text-slate-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[500px] border-none shadow-2xl rounded-3xl overflow-hidden p-0">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              {selectedLog && getActionIcon(selectedLog.action)}
              <DialogTitle className="text-lg font-headline uppercase tracking-tight">Detalle de Auditoría</DialogTitle>
            </div>
            <DialogDescription className="text-slate-400">ID de Transacción: {selectedLog?.id}</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsable</Label>
                <p className="text-sm font-bold text-slate-900">{selectedLog?.userName}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha y Hora</Label>
                <p className="text-sm font-bold text-slate-900">{selectedLog?.timestamp?.toDate ? selectedLog.timestamp.toDate().toLocaleString('es-PY') : 'Reciente'}</p>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Módulo del Sistema</Label>
              <div className="pt-1">{selectedLog && getModuleBadge(selectedLog.module)}</div>
            </div>
            <div className="space-y-2 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Label className="text-[10px] font-black text-primary uppercase tracking-widest">Descripción Completa</Label>
              <p className="text-xs leading-relaxed text-slate-600 font-medium italic">"{selectedLog?.details}"</p>
            </div>
          </div>
          <div className="p-6 bg-slate-50 border-t flex justify-end">
            <Button className="rounded-xl px-8 font-bold" onClick={() => setIsDetailsOpen(false)}>Cerrar Ficha</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
