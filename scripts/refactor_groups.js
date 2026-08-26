const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'studio-main', 'studio-main', 'src', 'app', 'dashboard', 'registrations', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
const importsTarget = `import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"`;
const importsReplacement = `import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"\nimport { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"`;
content = content.replace(importsTarget, importsReplacement);

// 2. Add state
const stateTarget = `  const [mounted, setMounted] = useState(false)\n  const [searchTerm, setSearchTerm] = useState("")`;
const stateReplacement = `  const [mounted, setMounted] = useState(false)\n  const [viewMode, setViewMode] = useState<"flat" | "grouped">("flat")\n  const [searchTerm, setSearchTerm] = useState("")`;
content = content.replace(stateTarget, stateReplacement);

// 3. Extract Table Block
const tableStartIndex = content.indexOf('<Table>');
const tableEndIndex = content.indexOf('</Table>') + '</Table>'.length;
const tableBlock = content.substring(tableStartIndex, tableEndIndex);

// Update map variable inside tableBlock to use regsToRender instead of filteredRegistrations
const updatedTableBlock = tableBlock.replace(
  `{filteredRegistrations.map((reg) => {`,
  `{regsToRender.map((reg: any) => {`
);

// 4. Inject groupedRegistrations and renderTable
const injectionTarget = `  if (!mounted) return null`;
const injectionCode = `  const groupedRegistrations = useMemo(() => {
    if (!filteredRegistrations) return {}
    const groups: Record<string, any[]> = {}
    groups["none"] = []
    allGroups?.forEach((g: any) => { groups[g.id] = [] })
    filteredRegistrations.forEach((r: any) => {
      const gid = r.groupId && r.groupId !== "none" ? r.groupId : "none"
      if (!groups[gid]) groups[gid] = [] 
      groups[gid].push(r)
    })
    return groups
  }, [filteredRegistrations, allGroups])

  const renderTable = (regsToRender: any[]) => {
    if (regsToRender.length === 0) {
      return <div className="py-24 text-center text-slate-400 italic">No hay estudiantes asignados a este grupo.</div>
    }
    return (
      ${updatedTableBlock}
    )
  }

  if (!mounted) return null`;

content = content.replace(injectionTarget, injectionCode);

// 5. Replace CardContent rendering
const cardContentStartIndex = content.indexOf('<CardContent className="p-0">');
const cardContentEndIndex = content.indexOf('</CardContent>', cardContentStartIndex) + '</CardContent>'.length;

const newCardContent = `<CardContent className="p-0">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full">
            <div className="flex justify-end p-4 pb-0 bg-slate-50/10 border-b">
              <TabsList className="bg-slate-100/80 rounded-xl h-12 p-1 border shadow-xs">
                <TabsTrigger value="flat" className="rounded-lg px-6 font-bold text-xs h-full data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all uppercase tracking-widest">Vista Plana</TabsTrigger>
                <TabsTrigger value="grouped" className="rounded-lg px-6 font-bold text-xs h-full data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all uppercase tracking-widest">Vista por Grupos</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="flat" className="m-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cargando...</p></div>
              ) : filteredRegistrations.length === 0 ? (
                <div className="py-32 text-center text-slate-400 italic">No se encontraron registros.</div>
              ) : renderTable(filteredRegistrations)}
            </TabsContent>

            <TabsContent value="grouped" className="m-0 p-8 pt-6 space-y-6 bg-slate-50/30">
              <Accordion type="multiple" className="w-full space-y-4">
                {allGroups?.map((g: any) => {
                  const regs = groupedRegistrations[g.id] || []
                  if (regs.length === 0) return null
                  return (
                     <AccordionItem key={g.id} value={g.id} className="bg-white border rounded-3xl overflow-hidden shadow-sm px-2">
                       <AccordionTrigger className="hover:no-underline p-6 py-5">
                         <div className="flex items-center gap-4 text-left w-full pr-4">
                           <div className="bg-primary/10 p-3 rounded-2xl shrink-0"><Church className="h-5 w-5 text-primary" /></div>
                           <div className="flex-1">
                             <h3 className="font-black text-lg text-slate-800 uppercase tracking-tight leading-none">{g.name}</h3>
                             <p className="text-xs font-bold text-slate-400 mt-1">{g.catechesisYear?.replace('_', ' ')} • {g.attendanceDay}S</p>
                           </div>
                           <Badge className="bg-primary text-white font-black px-4 h-8 rounded-full border-none shadow-sm">{regs.length} ALUMNOS</Badge>
                         </div>
                       </AccordionTrigger>
                       <AccordionContent className="p-0 border-t bg-slate-50/50">
                         {renderTable(regs)}
                       </AccordionContent>
                     </AccordionItem>
                  )
                })}
                
                {groupedRegistrations["none"]?.length > 0 && (
                  <AccordionItem value="none" className="bg-white border rounded-3xl overflow-hidden shadow-sm px-2">
                    <AccordionTrigger className="hover:no-underline p-6 py-5">
                      <div className="flex items-center gap-4 text-left w-full pr-4">
                        <div className="bg-amber-100 p-3 rounded-2xl shrink-0"><UserMinus className="h-5 w-5 text-amber-600" /></div>
                        <div className="flex-1">
                          <h3 className="font-black text-lg text-slate-800 uppercase tracking-tight leading-none">Sin Grupo Asignado</h3>
                          <p className="text-xs font-bold text-slate-400 mt-1">Alumnos a la espera de integración</p>
                        </div>
                        <Badge className="bg-amber-500 text-white font-black px-4 h-8 rounded-full border-none shadow-sm">{groupedRegistrations["none"].length} ALUMNOS</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0 border-t bg-slate-50/50">
                       {renderTable(groupedRegistrations["none"])}
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </TabsContent>
          </Tabs>
        </CardContent>`;

content = content.substring(0, cardContentStartIndex) + newCardContent + content.substring(cardContentEndIndex);

fs.writeFileSync(filePath, content);
console.log("Refactoring complete");
