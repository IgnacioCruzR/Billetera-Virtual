import { useCategoryName } from '@/features/categories/category-context'
import { useState } from 'react'
import { FlaskConical, Plus, RotateCcw, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Field, Select } from '@/components/ui/field'
import { transactionDescription } from '@/features/movements/transaction-history'
import { formatCompactMoney, formatDate, formatMoney } from '@/lib/utils'
import { emptySavingsScenario, simulateSavings, type MicroExpenseAnalysis } from './micro-expense-analysis'
import type { SavingsScenario } from './micro-expense-model'
import { microMoney } from './micro-expense-overview'

function Reduction({ label, value, onValue }: { label: string; value: number; onValue: (value: number) => void }) {
  return <label className="block min-w-0 text-xs font-medium">
    <span className="flex justify-between gap-2"><span className="wrap-anywhere">{label}</span><strong className="text-emerald-200 tabular-nums">{value} %</strong></span>
    <input type="range" className="mt-1 h-7 w-full cursor-pointer accent-primary" aria-label={label} aria-valuetext={`${value} %`} min={0} max={100} value={value} onChange={event => onValue(Number(event.target.value))} />
  </label>
}

export function SavingsSimulator({ analysis, scenario, hidden, onScenario, onClose, onUseScenario }: {
  analysis: MicroExpenseAnalysis; scenario: SavingsScenario; hidden: boolean; onScenario: (scenario: SavingsScenario) => void; onClose: () => void; onUseScenario: (monthly: number) => void;
}) {
  const categoryName = useCategoryName()
  const [movementId, setMovementId] = useState('')
  const data = simulateSavings(analysis, scenario)
  const selectedOther = analysis.history.filter(item => scenario.movementIds.includes(item.movement.id))
  const available = analysis.history.filter(item => !scenario.movementIds.includes(item.movement.id))
  const chart = [
    { name: 'Ritmo base', base: data.baseMonthly, reduced: null },
    { name: 'Escenario', base: null, reduced: data.reducedMonthly },
  ]
  const savings = [
    ['Al mes', data.monthly], ['En tres meses', data.quarterly], ['En seis meses', data.halfYear], ['En un año', data.annual],
  ] as const
  return <section id="savings-simulator" aria-labelledby="savings-title" className="panel scroll-mt-22 border-primary/30 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex gap-2.5"><FlaskConical className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div><h2 id="savings-title" tabIndex={-1} className="scroll-mt-24 text-lg font-bold text-emerald-200">Simulador de ahorro</h2><p className="mt-0.5 text-xs text-muted-foreground">Escenario hipotético. Elige qué consumos te gustaría reducir.</p></div></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => { onScenario(emptySavingsScenario); setMovementId('') }}><RotateCcw aria-hidden="true" />Restablecer simulación</Button><Button variant="ghost" size="sm" onClick={onClose}><X aria-hidden="true" />Cerrar simulador</Button></div>
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="min-w-0 space-y-3 rounded-xl border border-border bg-secondary/45 p-3.5">
        <Reduction label="Reducción general" value={scenario.reduction} onValue={value => onScenario({ ...scenario, reduction: value })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={scenario.includeDiscretionary} disabled={!analysis.summary.discretionaryCount} onChange={event => onScenario({ ...scenario, includeDiscretionary: event.target.checked })} />Incluir gastos marcados como prescindibles</label>
        {!analysis.summary.discretionaryCount && <p className="text-xs text-muted-foreground">Aún no hay gastos marcados como prescindibles en este período.</p>}
        {analysis.patterns.length > 0 && <fieldset className="divide-y divide-border rounded-lg border border-border px-3">
          <legend className="px-1 text-xs font-semibold text-muted-foreground">Patrones a reducir</legend>
          {analysis.patterns.map(pattern => {
            const selected = scenario.patternIds.includes(pattern.id)
            const override = scenario.patternReductions[pattern.id]
            return <div key={pattern.id} className="space-y-2 py-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 shrink-0 accent-primary" checked={selected} onChange={event => onScenario({ ...scenario, patternIds: event.target.checked ? [...scenario.patternIds, pattern.id] : scenario.patternIds.filter(id => id !== pattern.id) })} /><span className="min-w-0 flex-1 wrap-anywhere">{pattern.name} <span className="text-xs text-muted-foreground">· {categoryName(pattern.categoryId)}</span></span></label>
              {selected && <div className="pl-6"><Reduction label={`Reducción de ${pattern.name}`} value={override ?? scenario.reduction} onValue={value => onScenario({ ...scenario, patternReductions: { ...scenario.patternReductions, [pattern.id]: value } })} />
                {override !== undefined && <Button variant="ghost" size="sm" className="px-0" onClick={() => {
                  const patternReductions = { ...scenario.patternReductions }; delete patternReductions[pattern.id]; onScenario({ ...scenario, patternReductions })
                }}>Usar reducción general</Button>}</div>}
            </div>
          })}
        </fieldset>}
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1"><Field label="Añadir gasto individual">{id => <Select id={id} value={movementId} onChange={event => setMovementId(event.target.value)}><option value="">Elige entre tus gastos</option>{available.map(({ movement }) => <option key={movement.id} value={movement.id}>{transactionDescription(movement)} · {formatDate(movement.date, { day: 'numeric', month: 'short' })}{!hidden && ` · ${formatMoney(movement.amount)}`}</option>)}</Select>}</Field></div>
          <Button variant="outline" aria-label="Añadir gasto al escenario" disabled={!movementId || !available.some(entry => entry.movement.id === movementId)} size="icon" onClick={() => { onScenario({ ...scenario, movementIds: [...scenario.movementIds, movementId] }); setMovementId('') }}><Plus aria-hidden="true" /></Button>
        </div>
        {selectedOther.length > 0 && <ul aria-label="Gastos añadidos">{selectedOther.map(({ movement }) => <li className="flex items-center justify-between gap-2 text-sm" key={movement.id}><span className="wrap-anywhere">{transactionDescription(movement)}</span><Button size="icon" variant="ghost" aria-label={`Quitar ${transactionDescription(movement)}`} onClick={() => onScenario({ ...scenario, movementIds: scenario.movementIds.filter(id => id !== movement.id) })}><X aria-hidden="true" /></Button></li>)}</ul>}
      </div>
      <div className="min-w-0 space-y-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">{data.selectedCount} {data.selectedCount === 1 ? 'gasto seleccionado' : 'gastos seleccionados'}</p>
        <dl className="grid grid-cols-2 gap-2.5" aria-label="Ahorro potencial" aria-live="polite">{savings.map(([label, value]) => <div className="min-w-0 rounded-lg border border-border bg-primary/5 px-3 py-2" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-bold text-emerald-200 wrap-anywhere tabular-nums">{microMoney(value, hidden)}</dd></div>)}</dl>
        <div className="rounded-xl border border-border px-3 py-2.5">
          <p className="text-sm font-semibold">Nuevo gasto mensual estimado</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{microMoney(data.reducedMonthly, hidden)}</p>
          {data.baseMonthly !== null && <div className="mt-2 h-[185px]" aria-label="Comparación de gasto mensual"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, left: 0, right: 6, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
              <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis width={54} tickFormatter={value => hidden ? '••••' : formatCompactMoney(value)} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)', borderRadius: 10 }} labelStyle={{ color: 'var(--foreground)' }} formatter={value => formatMoney(Number(value), hidden)} />
              <Bar dataKey="base" name="Consumo base" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} stackId="monthly" />
              <Bar dataKey="reduced" name="Consumo reducido" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} stackId="monthly" />
            </BarChart>
          </ResponsiveContainer></div>}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">El escenario aplica el porcentaje por patrón cuando lo configuras. Cada movimiento se cuenta una vez y el ahorro calculado queda como estimación.</p>
        <Button variant="outline" className="h-auto max-w-full whitespace-normal py-2" disabled={data.monthly === null || data.monthly <= 0} onClick={() => { if (data.monthly !== null && data.monthly > 0) onUseScenario(data.monthly) }}>Comparar este escenario en Metas de ahorro</Button>
        {scenario.includeDiscretionary && <a className="block w-fit text-sm font-semibold text-primary hover:underline" href={`#salud?reduccion=${scenario.reduction}`}>Usar el porcentaje general en Salud financiera</a>}
      </div>
    </div>
  </section>
}
