"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Loader2, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  CircleDollarSign,
  PieChart as PieChartIcon,
  Filter,
  Download
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  Cell,
  PieChart,
  Pie
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Button } from "@/components/ui/button"

export default function FinancialStatsPage() {
  const [mounted, setMounted] = useState(false)
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const regsQuery = useMemoFirebase(() => db ? collection(db, "confirmations") : null, [db])
  const usersQuery = useMemoFirebase(() => db ? collection(db, "users") : null, [db])
  const expensesQuery = useMemoFirebase(() => db ? collection(db, "expenses") : null, [db])

  const { data: registrations, loading: loadingRegs } = useCollection(regsQuery)
  const { data: users, loading: loadingUsers } = useCollection(usersQuery)
  const { data: expenses, loading: loadingExpenses } = useCollection(expensesQuery)

  const totals = useMemo(() => {
    const incomeRegs = registrations?.reduce((sum, r) => sum + (r.amountPaid || 0), 0) || 0
    
    let incomeEvents = 0
    users?.forEach(u => {
      if (u.eventPayments) {
        Object.values(u.eventPayments).forEach((p: any) => {
          incomeEvents += (p.paid || 0)
        })
      }
    })

    const totalIncome = incomeRegs + incomeEvents
    const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0
    
    return {
      incomeRegs,
      incomeEvents,
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses
    }
  }, [registrations, users, expenses])

  const chartData = [
    { name: "Ingresos", total: totals.totalIncome, fill: "hsl(var(--primary))" },
    { name: "Egresos", total: totals.totalExpenses, fill: "hsl(var(--destructive))" },
  ]

  const distributionData = [
    { name: "Inscripciones", value: totals.incomeRegs, color: "#4f46e5" },
    { name: "Cobros Catequistas", value: totals.incomeEvents, color: "#10b981" }
  ]

  if (!mounted) return null

  const loading = loadingRegs || loadingUsers || loadingExpenses

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Estadísticas Financieras</h1>
          <p className="text-muted-foreground">Visión general de ingresos, egresos y flujo de caja de la parroquia.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl gap-2 h-11"><Filter className="h-4 w-4" /> Filtros</Button>
          <Button variant="outline" className="rounded-xl gap-2 h-11"><Download className="h-4 w-4" /> Exportar</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-40"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-none shadow-sm border-l-4 border-l-green-500 bg-white">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Ingresos</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-slate-900">{totals.totalIncome.toLocaleString('es-PY')} Gs.</div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-green-600 font-bold">
                  <ArrowUpRight className="h-3 w-3" /> 100% Recaudado
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm border-l-4 border-l-red-500 bg-white">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Egresos</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-slate-900">{totals.totalExpenses.toLocaleString('es-PY')} Gs.</div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-red-600 font-bold">
                  <ArrowDownRight className="h-3 w-3" /> Comprobantes registrados
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm border-l-4 border-l-primary bg-slate-900 text-white">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Balance Neto</CardTitle>
                <Wallet className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black">{totals.balance.toLocaleString('es-PY')} Gs.</div>
                <p className="text-[10px] text-slate-400 mt-1">Disponible en caja</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <Card className="border-none shadow-xl bg-white overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b">
                <CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Comparativa Global</CardTitle>
                <CardDescription>Relación entre entradas y salidas de dinero.</CardDescription>
              </CardHeader>
              <CardContent className="pt-10">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 'bold' }} />
                      <YAxis hide />
                      <RechartsTooltip 
                        cursor={{ fill: 'transparent' }} 
                        formatter={(value: number) => [value.toLocaleString('es-PY') + " Gs.", "Monto"]}
                      />
                      <Bar dataKey="total" radius={[8, 8, 0, 0]} barSize={60}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-white overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b">
                <CardTitle className="text-lg flex items-center gap-2"><PieChartIcon className="h-5 w-5 text-primary" /> Distribución de Ingresos</CardTitle>
                <CardDescription>Origen de los fondos recaudados.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[300px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {distributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value: number) => value.toLocaleString('es-PY') + " Gs."} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-xs font-bold text-slate-400 uppercase">Total</p>
                    <p className="text-xl font-black text-slate-900">100%</p>
                  </div>
                </div>
                <div className="flex justify-center gap-6 mt-4">
                  {distributionData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-[10px] font-bold text-slate-600 uppercase">{d.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-lg">Desglose Detallado</CardTitle>
              <CardDescription>Resumen de fuentes de ingreso y tipos de gasto.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/30">
                  <TableRow>
                    <TableHead className="font-bold">Categoría</TableHead>
                    <TableHead className="font-bold text-center">Tipo</TableHead>
                    <TableHead className="font-bold text-right pr-8">Total Acumulado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-bold">Inscripciones Confirmandos</TableCell>
                    <TableCell className="text-center"><Badge className="bg-green-100 text-green-700 hover:bg-green-100">Ingreso</Badge></TableCell>
                    <TableCell className="text-right font-black pr-8 text-green-600">+{totals.incomeRegs.toLocaleString('es-PY')} Gs.</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-bold">Cobros a Catequistas (Eventos)</TableCell>
                    <TableCell className="text-center"><Badge className="bg-green-100 text-green-700 hover:bg-green-100">Ingreso</Badge></TableCell>
                    <TableCell className="text-right font-black pr-8 text-green-600">+{totals.incomeEvents.toLocaleString('es-PY')} Gs.</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-bold">Gastos Operativos e Insumos</TableCell>
                    <TableCell className="text-center"><Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100">Egreso</Badge></TableCell>
                    <TableCell className="text-right font-black pr-8 text-red-600">-{totals.totalExpenses.toLocaleString('es-PY')} Gs.</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
