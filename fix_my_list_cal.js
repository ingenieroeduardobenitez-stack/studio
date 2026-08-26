const fs = require('fs');
const file = 'c:/studio-main/studio-main/src/app/dashboard/my-list/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace imports
code = code.replace(/import \{ collection, query, where, doc, updateDoc, serverTimestamp \} from \"firebase\\/firestore\"/, 'import { collection, query, where, doc, updateDoc, serverTimestamp, writeBatch } from "firebase/firestore"');

// Inject the AttendanceCalendar function BEFORE MyListPage
const calComponent = 
function AttendanceCalendar({ studentId }: { studentId: string }) {
  const db = useFirestore()
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() // 0-11
  
  const calendarData = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const rows = []
    let currentRow = [null, null] // [Sat, Sun]
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i)
      if (d.getDay() === 6) { currentRow[0] = d } 
      else if (d.getDay() === 0) {
        currentRow[1] = d
        rows.push(currentRow)
        currentRow = [null, null]
      }
    }
    if (currentRow[0] !== null) rows.push(currentRow)
    
    const startStr = \\-\-01\
    const endStr = \\-\-\\
    return { rows, startStr, endStr }
  }, [year, month])

  const attendanceQuery = useMemoFirebase(() => {
    if (!db || !studentId) return null
    return query(
      collection(db, "confirmations", studentId, "attendance"),
      where("date", ">=", calendarData.startStr),
      where("date", "<=", calendarData.endStr)
    )
  }, [db, studentId, calendarData])

  const { data: attendanceDocs } = useCollection(attendanceQuery)
  
  const historyMap = useMemo(() => {
    const map = new Map<string, string>()
    attendanceDocs?.forEach((doc: any) => { map.set(doc.date, doc.status) })
    return map
  }, [attendanceDocs])

  const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

  return (
    <div className="flex flex-col items-center gap-2 py-1">
       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mes de {monthNames[month]} de {year}</span>
       <div className="flex flex-col gap-1">
          <div className="flex gap-2 w-full justify-between px-2 mb-1">
             <div className="text-[10px] font-black text-slate-300 w-5 text-center">S</div>
             <div className="text-[10px] font-black text-slate-300 w-5 text-center">D</div>
          </div>
          {calendarData.rows.map((row, rIdx) => (
             <div key={rIdx} className="flex gap-2 justify-center">
               {row.map((date, cIdx) => {
                 if (!date) return <div key={cIdx} className="w-6 h-6" />
                 
                 const dateAsLocalStr = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
                 const isToday = dateAsLocalStr === new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
                 
                 // Firebase query dates are pure string compares YYYY-MM-DD
                 // Convert JS Date to the exact local YYYY-MM-DD
                 const localStr = \\-\-\\
                 const status = historyMap.get(localStr)
                 
                 return (
                   <div key={cIdx} className={cn(
                     "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all shadow-sm",
                     status === "PRESENTE" ? "bg-green-100 text-green-700 border-green-300" :
                     status === "AUSENTE" ? "bg-red-100 text-red-700 border-red-300" :
                     status === "JUSTIFICADO" ? "bg-amber-100 text-amber-700 border-amber-300" :
                     isToday ? "bg-slate-800 text-white border-none ring-2 ring-primary ring-offset-1" :
                     "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
                   )}>
                     {date.getDate()}
                   </div>
                 )
               })}
             </div>
          ))}
       </div>
    </div>
  )
}

export default function MyListPage();

code = code.replace(/export default function MyListPage\(\) \{/, calComponent);

// Modify handleAttendance
const handleOrig = updateDoc(regRef, updateData)
      .then(() => {
        toast({
          title: status === "PRESENTE" ? "Asistencia marcada" : "Ausencia registrada",
          description: status === "AUSENTE" ? "Habilitado para recuperación el día opuesto." : "Confirmando presente.",
        });

const handleNew = const todayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0]
    const attendanceRef = doc(db, "confirmations", id, "attendance", \\_\\)
    
    const batch = writeBatch(db)
    batch.update(regRef, updateData)
    batch.set(attendanceRef, {
      date: todayStr,
      status: status,
      registeredBy: user?.uid || "admin",
      timestamp: serverTimestamp()
    }, { merge: true })

    batch.commit()
      .then(() => {
        toast({
          title: status === "PRESENTE" ? "Asistencia marcada" : "Ausencia registrada",
          description: status === "AUSENTE" ? "Habilitado para recuperación el día opuesto." : "Confirmando presente.",
        });

code = code.replace(handleOrig, handleNew);

// Replace "Última Asistencia" Table column content with <AttendanceCalendar />
// In Alumnos Regulares
code = code.replace(/\{conf\\.lastAttendanceUpdate \\? \\([\\s\\S]*?\\) : \\([\\s\\S]*?\\)\\}/, '<AttendanceCalendar studentId={conf.id} />');
// In Recuperatorios
code = code.replace(/\{conf\\.lastAttendanceUpdate \\? \\([\\s\\S]*?\\) : \\([\\s\\S]*?\\)\\}/, '<AttendanceCalendar studentId={conf.id} />');

fs.writeFileSync(file, code, 'utf8');
