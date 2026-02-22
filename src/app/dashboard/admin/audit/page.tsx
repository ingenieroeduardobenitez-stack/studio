
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Clock
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit } from "firebase/firestore"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

export default function AuditPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const auditQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(100))
  }, [db])

  const { data: logs, loading } = useCollection(auditQuery)

  const filteredLogs = useMemo(() => {
    if (!logs) return []
    return logs.filter(log => 
      log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.module?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [logs, searchTerm])

  const getActionIcon = (action: string) => {
    const act = action.toLowerCase()
    if (act.includes("crear") || act.includes("registro")) return <UserPlus className="h-4 w-4 text-green-500" />
    if (act.includes("pago") || act.includes("cobro")) return <Wallet className="h-4 w-4 text-orange-500" />
    if (act.includes("cambio") || act.includes("traslado")) return <ArrowRightLeft className="h-4 w-4 text-blue-500" />
    if (act.includes("editar") || act.includes("actualizar")) return <Edit className="h-4 w-4 text-indigo-500" />
    if (act.includes("eliminar") || act.includes("borrar")) return <Trash2 className="h-4 w-4 text-red-500" />
    return <Activity className="h-4 w-4 text-slate-400" />
  }

  const getModuleBadge = (module: string) => {
    switch (module?.toLowerCase()) {
      case "inscripcion": return <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">Inscripciones</Badge>
      case "pagos": return <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">Tesorería</Badge>
      case "grupos": return <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Grupos</Badge>
      case "usuarios": return <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">Usuarios</Badge>
      case "traslados": return <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">Movimientos</Badge>
      default: return <Badge variant="secondary">{module}</Badge>
    }
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Auditoría del Sistema</h1>
          <p className="text-muted-foreground">Registro cronológico de todas las acciones realizadas por el personal.</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border shadow-sm">
          <History className="h-5 w-5 text-primary ml-2" />
          <span className="text-sm font-bold text-slate-700 pr-4">{logs?.length || 0} Registros recientes</span>
        </div>
      </div>

      <Card className="border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por usuario, acción o módulo..." 
                className="pl-9 bg-white border-slate-200 h-11 rounded-xl" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-11 rounded-xl font-bold border-slate-200 gap-2">
                <Filter className="h-4 w-4" /> Filtros Avanzados
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-slate-400">Cargando registros de actividad...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-24 text-center">
              <Activity className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium italic">No se encontraron movimientos que coincidan con la búsqueda.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/30 hover:bg-transparent">
                  <TableHead className="py-4 font-bold text-slate-500 w-[180px]">Fecha y Hora</TableHead>
                  <TableHead className="py-4 font-bold text-slate-500">Usuario</TableHead>
                  <TableHead className="py-4 font-bold text-slate-500">Acción</TableHead>
                  <TableHead className="py-4 font-bold text-slate-500">Módulo</TableHead>
                  <TableHead className="py-4 font-bold text-slate-500">Detalles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log: any) => (
                  <TableRow key={log.id} className="hover:bg-slate-50/50 border-slate-100 h-16">
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
                        <span className="text-xs font-medium text-slate-600">{log.action}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getModuleBadge(log.module)}
                    </TableCell>
                    <TableCell>
                      <p className="text-[10px] text-slate-500 max-w-[300px] truncate italic" title={log.details}>
                        {log.details || 'Sin información adicional'}
                      </p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
