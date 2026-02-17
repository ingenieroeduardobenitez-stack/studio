
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Users, Shield, FileCheck, Filter } from "lucide-react"

const registrations = [
  { id: "1", name: "Alice Thompson", date: "2024-03-15", status: "CONFIRMED", role: "Analista de Inteligencia" },
  { id: "2", name: "Bob Smith", date: "2024-03-14", status: "PENDING", role: "Especialista en Ciberseguridad" },
  { id: "3", name: "Charlie Brown", date: "2024-03-14", status: "DENIED", role: "Operativo de Campo" },
  { id: "4", name: "Diana Prince", date: "2024-03-13", status: "CONFIRMED", role: "Oficial de Logística" },
  { id: "5", name: "Edward Norton", date: "2024-03-12", status: "PENDING", role: "Infraestructura TI" },
]

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Panel de Administración</h1>
          <p className="text-muted-foreground">Supervisa y gestiona toda la actividad de registro NSPS.</p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-primary text-white hover:bg-primary/90">
            <Users className="mr-2 h-4 w-4" /> Gestionar Equipos
          </Button>
          <Button variant="outline">Exportar Datos</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Registros</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,284</div>
            <p className="text-xs text-muted-foreground">+12% desde el mes pasado</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Auto-Confirmados</CardTitle>
            <Shield className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">892</div>
            <p className="text-xs text-muted-foreground">70% de tasa de éxito</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendientes de Revisión</CardTitle>
            <FileCheck className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-muted-foreground">Requiere supervisión humana</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-headline">Registros Recientes</CardTitle>
              <CardDescription>Lista de los últimos solicitantes en el sistema.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Solicitante</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((reg) => (
                <TableRow key={reg.id}>
                  <TableCell className="font-medium">{reg.name}</TableCell>
                  <TableCell>{reg.role}</TableCell>
                  <TableCell>{reg.date}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={reg.status === "CONFIRMED" ? "default" : reg.status === "DENIED" ? "destructive" : "secondary"}
                      className={reg.status === "CONFIRMED" ? "bg-green-500 hover:bg-green-600" : ""}
                    >
                      {reg.status === "CONFIRMED" ? "CONFIRMADO" : reg.status === "DENIED" ? "DENEGADO" : "PENDIENTE"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
