
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
  FileWarning, 
  MessageCircle, 
  User, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Filter,
  Church,
  BookOpen,
  Info
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export default function DocumentationControlPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const regsQuery = useMemoFirebase(() => db ? collection(db, "confirmations") : null, [db])
  const groupsQuery = useMemoFirebase(() => db ? collection(db, "groups") : null, [db])

  const { data: allRegistrations, loading: loadingRegs } = useCollection(regsQuery)
  const { data: allGroups } = useCollection(groupsQuery)

  const activeConfirmands = useMemo(() => {
    if (!allRegistrations) return []
    return allRegistrations.filter(r => !r.isArchived)
  }, [allRegistrations])

  const filteredData = useMemo(() => {
    return activeConfirmands.filter(r => 
      r.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.ciNumber?.includes(searchTerm)
    )
  }, [activeConfirmands, searchTerm])

  const stats = useMemo(() => {
    const missingCert = activeConfirmands.filter(r => r.hasBaptism && !r.baptismCertificatePhotoUrl).length
    const noBaptism = activeConfirmands.filter(r => !r.hasBaptism).length
    const noCommunion = activeConfirmands.filter(r => !r.hasFirstCommunion).length
    return { missingCert, noBaptism, noCommunion }
  }, [activeConfirmands])

  const openWhatsApp = (student: any, reason: string) => {
    if (!student.phone) return;
    
    let cleanPhone = student.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
    if (!cleanPhone.startsWith('595')) cleanPhone = '595' + cleanPhone;

    let msg = ""
    if (reason === "CERTIFICADO") {
      msg = `Hola ${student.fullName}, te contactamos del Santuario Nacional Nuestra Señora del Perpetuo Socorro. Notamos que en tu ficha de Confirmación falta la foto de tu Certificado de Bautismo. ¿Podrías enviárnosla por este medio?`
    } else if (reason === "BAUTISMO") {
      msg = `Hola ${student.fullName}, te contactamos del Santuario Nacional. Vimos que no tienes el sacramento del Bautismo. Te informaremos pronto sobre el curso especial de preparación.`
    } else {
      msg = `Hola ${student.fullName}, te contactamos del Santuario. Vimos que aún no tienes la Primera Comunión. Te informaremos sobre el curso de nivelación obligatorio.`
    }
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Control de Documentación</h1>
          <p className="text-muted-foreground">Seguimiento de certificados y sacramentos pendientes en el Santuario.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-orange-500">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Faltan Certificados</CardTitle>
            <FileWarning className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.missingCert}</div>
            <p className="text-[10px] text-muted-foreground">Pendientes de carga</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-red-500">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sin Bautismo</CardTitle>
            <Church className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.noBaptism}</div>
            <p className="text-[10px] text-muted-foreground">Requieren curso</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-blue-500">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sin Comunión</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.noCommunion}</div>
            <p className="text-[10px] text-muted-foreground">Nivelación necesaria</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nombre o C.I..." 
                className="pl-9 bg-white border-slate-200 h-11" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Lista de confirmandos activos</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="all" className="w-full">
            <div className="px-6 border-b bg-white">
              <TabsList className="h-12 bg-transparent gap-6">
                <TabsTrigger value="all" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-12 bg-transparent shadow-none">Todos</TabsTrigger>
                <TabsTrigger value="missing" className="data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none px-0 h-12 bg-transparent shadow-none">Falta Certificado</TabsTrigger>
                <TabsTrigger value="sacraments" className="data-[state=active]:border-b-2 data-[state=active]:border-red-500 rounded-none px-0 h-12 bg-transparent shadow-none">Sin Sacramentos</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all" className="m-0">
              <DocumentationTable 
                students={filteredData} 
                groups={allGroups} 
                onNotify={openWhatsApp} 
                loading={loadingRegs} 
              />
            </TabsContent>
            <TabsContent value="missing" className="m-0">
              <DocumentationTable 
                students={filteredData.filter(r => r.hasBaptism && !r.baptismCertificatePhotoUrl)} 
                groups={allGroups} 
                onNotify={openWhatsApp} 
                loading={loadingRegs} 
              />
            </TabsContent>
            <TabsContent value="sacraments" className="m-0">
              <DocumentationTable 
                students={filteredData.filter(r => !r.hasBaptism || !r.hasFirstCommunion)} 
                groups={allGroups} 
                onNotify={openWhatsApp} 
                loading={loadingRegs} 
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function DocumentationTable({ students, groups, onNotify, loading }: any) {
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  
  if (students.length === 0) return <div className="py-20 text-center text-slate-400 italic">No hay registros que coincidan con este filtro.</div>

  return (
    <Table>
      <TableHeader className="bg-slate-50/30">
        <TableRow>
          <TableHead className="pl-8">Confirmando</TableHead>
          <TableHead>Grupo / Nivel</TableHead>
          <TableHead className="text-center">Cert. Bautismo</TableHead>
          <TableHead className="text-center">Comunión</TableHead>
          <TableHead className="text-right pr-8">Acción</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((student: any) => {
          const group = groups?.find((g: any) => g.id === student.groupId)
          const needsCert = student.hasBaptism && !student.baptismCertificatePhotoUrl
          const noBaptism = !student.hasBaptism
          const noCommunion = !student.hasFirstCommunion

          return (
            <TableRow key={student.id} className="hover:bg-slate-50/30 h-16">
              <TableCell className="pl-8">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 border shadow-sm">
                    <AvatarImage src={student.photoUrl} className="object-cover" />
                    <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-slate-900">{student.fullName}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{student.ciNumber}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700">{group?.name || "Sin Grupo"}</span>
                  <span className="text-[10px] text-slate-400">{student.catechesisYear?.replace("_", " ")}</span>
                </div>
              </TableCell>
              <TableCell className="text-center">
                {noBaptism ? (
                  <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-100 hover:bg-red-50 text-[9px] uppercase">Sin Bautismo</Badge>
                ) : needsCert ? (
                  <Badge variant="outline" className="text-orange-500 border-orange-200 bg-orange-50 text-[9px] uppercase">Falta Foto</Badge>
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                )}
              </TableCell>
              <TableCell className="text-center">
                {noCommunion ? (
                  <Badge variant="outline" className="text-blue-500 border-blue-200 bg-blue-50 text-[9px] uppercase">Sin Comunión</Badge>
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                )}
              </TableCell>
              <TableCell className="text-right pr-8">
                {(needsCert || noBaptism || noCommunion) && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-9 w-9 rounded-full bg-green-50 text-green-600 hover:bg-green-100 p-0"
                    onClick={() => onNotify(student, noBaptism ? "BAUTISMO" : noCommunion ? "COMUNION" : "CERTIFICADO")}
                    title="Notificar por WhatsApp"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
