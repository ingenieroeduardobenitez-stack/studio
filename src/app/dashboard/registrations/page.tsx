
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, Loader2, Download, Filter, MoreHorizontal, User } from "lucide-react"
import { useFirestore, useCollection } from "@/firebase"
import { collection } from "firebase/firestore"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export default function RegistrationsListPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const db = useFirestore()

  const registrationsQuery = useMemo(() => {
    if (!db) return null
    return collection(db, "confirmations")
  }, [db])

  const { data: registrations, loading } = useCollection(registrationsQuery)

  const filteredRegistrations = useMemo(() => {
    if (!registrations) return []
    return registrations.filter(reg => 
      reg.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.ciNumber.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [registrations, searchTerm])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "INSCRITO":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Inscrito</Badge>
      case "PENDIENTE":
        return <Badge variant="secondary">Pendiente</Badge>
      case "OBSERVADO":
        return <Badge variant="destructive">Observado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatCatechesisYear = (year: string) => {
    switch (year) {
      case "PRIMER_AÑO": return "1° Año"
      case "SEGUNDO_AÑO": return "2° Año"
      case "ADULTOS": return "Adultos"
      default: return year
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Lista de Confirmandos</h1>
          <p className="text-muted-foreground">Consulta y gestiona todos los registros de la parroquia.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Total Inscritos</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{registrations.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Primer Año</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">
              {registrations.filter(r => r.catechesisYear === "PRIMER_AÑO").length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Segundo Año</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">
              {registrations.filter(r => r.catechesisYear === "SEGUNDO_AÑO").length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Adultos</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">
              {registrations.filter(r => r.catechesisYear === "ADULTOS").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="border-b bg-slate-50/50">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nombre o C.I..." 
                className="pl-9 bg-white" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="py-20 text-center">
              <User className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No se encontraron inscripciones.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-bold">Confirmando</TableHead>
                  <TableHead className="font-bold">C.I. N°</TableHead>
                  <TableHead className="font-bold">Año</TableHead>
                  <TableHead className="font-bold">Día</TableHead>
                  <TableHead className="font-bold">Costo</TableHead>
                  <TableHead className="font-bold">Estado</TableHead>
                  <TableHead className="text-right font-bold">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg: any) => (
                  <TableRow key={reg.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{reg.fullName}</span>
                        <span className="text-xs text-slate-500">{reg.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-slate-600">{reg.ciNumber}</TableCell>
                    <TableCell>
                      <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {formatCatechesisYear(reg.catechesisYear)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 italic">
                      {reg.attendanceDay === "SABADO" ? "Sábado" : "Domingo"}
                    </TableCell>
                    <TableCell className="font-bold text-primary">
                      {reg.registrationCost?.toLocaleString('es-PY')} Gs.
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(reg.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Gestión</DropdownMenuLabel>
                          <DropdownMenuItem>Ver Detalles</DropdownMenuItem>
                          <DropdownMenuItem>Editar Registro</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Marcar Observado</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
