
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
  Info,
  Download,
  Image as ImageIcon
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"

// ... (after imports)
function romanToInt(str: string | null | undefined): string {
  if (!str) return "";
  const s = str.trim().toUpperCase();
  if (/^[IVXLCDM]+$/.test(s)) {
    const romanValues: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let result = 0;
    for (let i = 0; i < s.length; i++) {
      const current = romanValues[s[i]];
      const next = romanValues[s[i + 1]];
      if (next && current < next) {
        result += next - current;
        i++;
      } else {
        result += current;
      }
    }
    return result.toString();
  }
  return str;
}

export default function DocumentationControlPage() {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isExporting, setIsExporting] = useState(false)
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const regsQuery = useMemoFirebase(() => db ? collection(db, "confirmations") : null, [db])
  const groupsQuery = useMemoFirebase(() => db ? collection(db, "groups") : null, [db])

  const { data: allRegistrations, loading: loadingRegs } = useCollection(regsQuery, { once: true })
  const { data: allGroups } = useCollection(groupsQuery, { once: true })

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

  const exportPDF = async () => {
    const input = document.getElementById('pdf-report-container');
    if (!input) return;
    
    try {
      setIsExporting(true);
      const clone = input.cloneNode(true) as HTMLElement;
      clone.style.display = 'block';
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      document.body.appendChild(clone);

      const canvas = await html2canvas(clone, { scale: 1.5 });
      document.body.removeChild(clone);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      const imgHeightInMm = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = imgHeightInMm;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeightInMm);
      heightLeft -= pdfPageHeight;
      
      while (heightLeft > 0) {
        position = position - pdfPageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeightInMm);
        heightLeft -= pdfPageHeight;
      }
      
      pdf.save('Reporte_Documentacion.pdf');
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Control de Documentación</h1>
          <p className="text-muted-foreground">Seguimiento de certificados y sacramentos pendientes en el Santuario.</p>
        </div>
        <Button onClick={exportPDF} disabled={isExporting || loadingRegs} className="gap-2 bg-primary rounded-full hover:bg-primary/90 h-11 px-6 shadow-md">
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {isExporting ? 'Generando...' : 'Exportar PDF'}
        </Button>
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

            <TabsContent value="all" className="m-0 p-6">
              <DocumentationTable 
                students={filteredData} 
                groups={allGroups} 
                onNotify={openWhatsApp} 
                loading={loadingRegs} 
              />
            </TabsContent>
            <TabsContent value="missing" className="m-0 p-6">
              <DocumentationTable 
                students={filteredData.filter(r => r.hasBaptism && !r.baptismCertificatePhotoUrl)} 
                groups={allGroups} 
                onNotify={openWhatsApp} 
                loading={loadingRegs} 
              />
            </TabsContent>
            <TabsContent value="sacraments" className="m-0 p-6">
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

      {/* Hidden Container for PDF Export */}
      <div id="pdf-report-container" style={{ display: 'none' }} className="p-8 bg-white text-black w-[800px]">
        <div className="mb-6 border-b pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold">Reporte de Control de Documentación</h1>
            <p className="text-sm text-gray-500">Santuario Nacional Nuestra Señora del Perpetuo Socorro</p>
          </div>
          <p className="text-sm text-gray-500">Generado: {new Date().toLocaleDateString()}</p>
        </div>
        
        {allGroups?.map(group => {
           const groupStudents = filteredData.filter(r => r.groupId === group.id);
           if (groupStudents.length === 0) return null;
           
           return (
             <div key={group.id} className="mb-6 break-inside-avoid">
               <h2 className="text-lg font-bold mb-2 bg-gray-100 p-2 rounded">{group.name}</h2>
               <table className="w-full text-left text-sm border-collapse">
                 <thead>
                   <tr className="border-b border-gray-200">
                     <th className="py-2 px-2 font-semibold">Nombre</th>
                     <th className="py-2 px-2 font-semibold text-center w-32">Bautismo</th>
                     <th className="py-2 px-2 font-semibold text-center w-32">Comunión</th>
                   </tr>
                 </thead>
                 <tbody>
                   {groupStudents.map(student => {
                      const noBaptism = !student.hasBaptism;
                      const needsCert = student.hasBaptism && !student.baptismCertificatePhotoUrl;
                      const noCommunion = !student.hasFirstCommunion;

                      return (
                        <tr key={student.id} className="border-b border-gray-100">
                          <td className="py-2 px-2">{student.fullName}</td>
                          <td className="py-2 px-2 text-center text-xs">
                            {noBaptism ? <span className="text-red-600 font-bold">Sin Bautismo</span> : needsCert ? <span className="text-orange-500 font-bold">Falta Foto</span> : <span className="text-green-600 font-bold">OK</span>}
                            {student.hasBaptism && student.baptismParish && (
                              <div className="text-[10px] text-gray-600 mt-1.5 p-1 bg-gray-50 rounded">
                                <span className="font-semibold block">{student.baptismParish}</span>
                                {student.baptismBook || student.baptismFolio ? <span className="text-[9px]">Libro {romanToInt(student.baptismBook) || "-"} • Folio {romanToInt(student.baptismFolio) || "-"}</span> : ''}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center text-xs">
                            {noCommunion ? <span className="text-blue-600 font-bold">Sin Comunión</span> : <span className="text-green-600 font-bold">OK</span>}
                          </td>
                        </tr>
                      )
                   })}
                 </tbody>
               </table>
             </div>
           )
        })}
        {(() => {
          const sinGrupoStudents = filteredData.filter(r => !r.groupId);
          if (sinGrupoStudents.length === 0) return null;
          return (
             <div className="mb-6 break-inside-avoid">
               <h2 className="text-lg font-bold mb-2 bg-gray-100 p-2 rounded">Sin Grupo</h2>
               <table className="w-full text-left text-sm border-collapse">
                 <thead>
                   <tr className="border-b border-gray-200">
                     <th className="py-2 px-2 font-semibold">Nombre</th>
                     <th className="py-2 px-2 font-semibold text-center w-32">Bautismo</th>
                     <th className="py-2 px-2 font-semibold text-center w-32">Comunión</th>
                   </tr>
                 </thead>
                 <tbody>
                   {sinGrupoStudents.map(student => {
                      const noBaptism = !student.hasBaptism;
                      const needsCert = student.hasBaptism && !student.baptismCertificatePhotoUrl;
                      const noCommunion = !student.hasFirstCommunion;

                      return (
                        <tr key={student.id} className="border-b border-gray-100">
                          <td className="py-2 px-2">{student.fullName}</td>
                          <td className="py-2 px-2 text-center text-xs">
                            {noBaptism ? <span className="text-red-600 font-bold">Sin Bautismo</span> : needsCert ? <span className="text-orange-500 font-bold">Falta Foto</span> : <span className="text-green-600 font-bold">OK</span>}
                            {student.hasBaptism && student.baptismParish && (
                              <div className="text-[10px] text-gray-600 mt-1.5 p-1 bg-gray-50 rounded">
                                <span className="font-semibold block">{student.baptismParish}</span>
                                {student.baptismBook || student.baptismFolio ? <span className="text-[9px]">Libro {romanToInt(student.baptismBook) || "-"} • Folio {romanToInt(student.baptismFolio) || "-"}</span> : ''}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center text-xs">
                            {noCommunion ? <span className="text-blue-600 font-bold">Sin Comunión</span> : <span className="text-green-600 font-bold">OK</span>}
                          </td>
                        </tr>
                      )
                   })}
                 </tbody>
               </table>
             </div>
          )
        })()}
      </div>
    </div>
  )
}

function DocumentationTable({ students, groups, onNotify, loading }: any) {
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  
  if (students.length === 0) return <div className="py-20 text-center text-slate-400 italic">No hay registros que coincidan con este filtro.</div>

  const groupedStudents = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    students.forEach((student: any) => {
      const gId = student.groupId || "sin-grupo";
      if (!grouped[gId]) grouped[gId] = [];
      grouped[gId].push(student);
    });
    return grouped;
  }, [students]);

  const groupIds = Object.keys(groupedStudents);
  
  groupIds.sort((a, b) => {
    if (a === "sin-grupo") return 1;
    if (b === "sin-grupo") return -1;
    return a.localeCompare(b);
  });

  return (
    <Accordion type="multiple" className="w-full space-y-4" defaultValue={groupIds}>
      {groupIds.map(gId => {
        const group = groups?.find((g: any) => g.id === gId);
        const groupName = group?.name || "Sin Grupo";
        const groupStudents = groupedStudents[gId];
        
        return (
          <AccordionItem value={gId} key={gId} className="border rounded-xl bg-white shadow-sm overflow-hidden">
            <AccordionTrigger className="px-6 py-4 hover:bg-slate-50/80 hover:no-underline transition-colors data-[state=open]:border-b">
              <div className="flex items-center gap-3 text-left">
                <span className="font-bold text-slate-800 text-lg">{groupName}</span>
                <Badge variant="secondary" className="font-normal bg-slate-100 text-slate-600">
                  {groupStudents.length} {groupStudents.length === 1 ? 'alumno' : 'alumnos'}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-0 bg-slate-50/20">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="pl-6">Confirmando</TableHead>
                    <TableHead className="text-center">Cert. Bautismo</TableHead>
                    <TableHead className="text-center">Comunión</TableHead>
                    <TableHead className="text-right pr-6">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupStudents.map((student: any) => {
                    const needsCert = student.hasBaptism && !student.baptismCertificatePhotoUrl
                    const noBaptism = !student.hasBaptism
                    const noCommunion = !student.hasFirstCommunion
                    
                    const parishInfo = student.hasBaptism && student.baptismParish ? (
                      <div className="flex flex-col items-center mt-2 px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg w-full max-w-[160px] mx-auto shadow-sm">
                        <p className="text-[9px] font-bold text-slate-700 text-center uppercase leading-tight w-full truncate" title={student.baptismParish}>
                          {student.baptismParish}
                        </p>
                        {(student.baptismBook || student.baptismFolio) && (
                          <p className="text-[9px] font-medium text-slate-500 mt-0.5 whitespace-nowrap">
                            Libro {romanToInt(student.baptismBook) || "-"} • Folio {romanToInt(student.baptismFolio) || "-"}
                          </p>
                        )}
                      </div>
                    ) : null;

                    return (
                      <TableRow key={student.id} className="hover:bg-slate-50/60 h-16 transition-colors">
                        <TableCell className="pl-6">
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
                        <TableCell className="text-center">
                          {noBaptism ? (
                            <div className="flex flex-col items-center gap-1">
                              <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-100 hover:bg-red-50 text-[9px] uppercase font-bold tracking-wider">Sin Bautismo</Badge>
                            </div>
                          ) : needsCert ? (
                            <div className="flex flex-col items-center gap-1">
                              <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 text-[9px] uppercase font-bold tracking-wider">Falta Foto</Badge>
                              {parishInfo}
                            </div>
                          ) : student.baptismCertificatePhotoUrl ? (
                            <div className="flex flex-col items-center gap-1">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-green-600 hover:bg-green-50 hover:text-green-700 bg-green-50/50 border border-transparent hover:border-green-100">
                                    <ImageIcon className="h-3.5 w-3.5" />
                                    <span className="text-[10px] font-bold uppercase tracking-wide">Ver Foto</span>
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl bg-white border-0 shadow-2xl p-0 overflow-hidden sm:rounded-2xl">
                                  <DialogHeader className="p-6 pb-4 bg-slate-50 border-b">
                                    <DialogTitle className="font-headline text-xl text-primary flex items-center gap-2">
                                      <ImageIcon className="h-5 w-5 text-primary/70" />
                                      Certificado de Bautismo
                                    </DialogTitle>
                                    <DialogDescription>
                                      Documento de {student.fullName}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="flex flex-col items-center p-6 bg-slate-50/30">
                                    <div className="relative w-full rounded-xl overflow-hidden bg-slate-100/50 flex items-center justify-center border p-2 mb-6">
                                      <img 
                                        src={student.baptismCertificatePhotoUrl} 
                                        alt={`Certificado de ${student.fullName}`} 
                                        className="max-w-full max-h-[50vh] object-contain rounded-lg shadow-sm"
                                      />
                                    </div>
                                    <Button 
                                      className="w-full sm:w-auto min-w-[200px] gap-2 rounded-full h-11 bg-primary hover:bg-primary/90 shadow-md"
                                      onClick={() => {
                                        window.open(student.baptismCertificatePhotoUrl, '_blank');
                                      }}
                                    >
                                      <Download className="h-4 w-4" />
                                      Descargar Imagen
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                              {parishInfo}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                              {parishInfo}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {noCommunion ? (
                            <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 text-[9px] uppercase font-bold tracking-wider">Sin Comunión</Badge>
                          ) : (
                            <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          {(needsCert || noBaptism || noCommunion) && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-9 w-9 rounded-full bg-green-50 text-green-600 hover:bg-green-100 p-0 hover:shadow-sm transition-all"
                              onClick={() => onNotify(student, noBaptism ? "BAUTISMO" : noCommunion ? "COMUNION" : "CERTIFICADO")}
                              title="Notificar por WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}

