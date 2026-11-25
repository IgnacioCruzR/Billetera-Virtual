import { useState } from 'react'
import { FlaskConical, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, MoneyInput, Select } from '@/components/ui/field'
import { useCategories } from '@/features/categories/category-context'
import { formatMoney } from '@/lib/utils'
import type { FinancialHealthRepository } from './health-data'
import type { FinancialHealthAssessment, FinancialHealthScenario } from './health-model'
import { changeText, healthDate, metric, pillarContent } from './health-overview'

const amountLimit = 999_999_999_999
function readAmount(value: string, signed = false) {
  if (!(signed ? /^-?\d+$/.test(value) : /^\d+$/.test(value))) return null
  const number = Number(value)
  return Number.isSafeInteger(number) && Math.abs(number) <= amountLimit ? number : null
}

export function HealthSimulator({ base, repository, hidden, initialReduction = 0, onClose }: {
  base: FinancialHealthAssessment; repository: FinancialHealthRepository; hidden: boolean; initialReduction?: number; onClose: () => void;
}) {
  const expenseCategories = useCategories('gasto')
  const starting = { income: String(base.indicators.income), expense: String(base.indicators.expense), free: String(base.indicators.free ?? 0), category: '' }
  const [fields, setFields] = useState(starting)
  const [categoryId, setCategory] = useState('')
  const [reduction, setReduction] = useState(initialReduction)
  const [omittedPayments, setOmitted] = useState<string[]>([])
  const payables = repository.pendingPayments(base.range)
  const income = readAmount(fields.income)
  const expense = readAmount(fields.expense)
  const free = readAmount(fields.free, true)
  const categoryAmount = fields.category === '' ? null : readAmount(fields.category)
  const invalidCategory = Boolean(categoryId && fields.category && categoryAmount === null)
  let simulation = null
  let failed = false
  if (income !== null && expense !== null && free !== null && !invalidCategory) {
    const scenario: FinancialHealthScenario = { income, expense, free, reduction, categoryId, categoryAmount, omittedPayments }
    try { simulation = repository.simulate(base, scenario) }
    catch { failed = true }
  }
  const scores = simulation?.scenario.pillars ?? []
  const format = (value: number | null | undefined) => value == null ? 'No disponible' : formatMoney(value, hidden)
  const scenarioFlow = simulation?.scenario.indicators.cashFlow
  const numberField = (label: string, key: keyof typeof fields, invalid: boolean) => <Field label={label} error={invalid ? 'Ingresa un monto válido en pesos enteros.' : undefined}>{(id, attrs) =>
    <MoneyInput hidden={hidden} id={id} inputMode="numeric" value={fields[key]} onChange={event => setFields({ ...fields, [key]: event.target.value })} {...attrs} />}</Field>
  return <section aria-labelledby="health-simulator-title" className="panel border-primary/30 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex gap-2.5"><FlaskConical aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /><div><h2 id="health-simulator-title" tabIndex={-1} className="scroll-mt-24 text-lg font-bold">Simulador de salud financiera</h2><p className="mt-0.5 text-xs text-muted-foreground">Escenario hipotético · {base.version}</p></div></div>
      <div className="flex flex-wrap gap-1.5"><Button variant="outline" size="sm" onClick={() => { setFields(starting); setCategory(''); setReduction(0); setOmitted([]) }}><RotateCcw aria-hidden="true" />Restablecer escenario</Button><Button variant="ghost" size="sm" onClick={onClose}><X aria-hidden="true" />Cerrar simulador</Button></div>
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="min-w-0 space-y-3 rounded-xl border border-border bg-secondary/45 p-3.5">
        <div className="grid gap-2 sm:grid-cols-2">{numberField('Ingresos esperados (CLP)', 'income', income === null)}{numberField('Gasto proyectado (CLP)', 'expense', expense === null)}</div>
        <div className="grid gap-2 sm:grid-cols-2"><Field label="Categoría a ajustar">{id => <Select id={id} value={categoryId} onChange={event => setCategory(event.target.value)}><option value="">Distribución observada</option>{expenseCategories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>}</Field>{categoryId && numberField('Nuevo gasto de la categoría (CLP)', 'category', invalidCategory)}</div>
        <p className="text-xs text-muted-foreground">El gasto se distribuye según el período. El ajuste de categoría reemplaza su parte y puede cambiar el total.</p>
        <label className="block text-sm font-semibold">Reducción de gastos prescindibles · {reduction} %
          <input type="range" aria-label="Reducción de gastos prescindibles" aria-valuetext={`${reduction} %`} min={0} max={100} value={reduction} onChange={event => setReduction(Number(event.target.value))} className="mt-1 h-7 w-full accent-primary" />
        </label>
        <div className="border-t border-border pt-3">{numberField('Dinero libre inicial del escenario (CLP)', 'free', free === null)}</div>
        {payables.length > 0 && <fieldset className="space-y-2 rounded-lg border border-border p-2.5"><legend className="px-1 text-xs font-semibold">Pagos incluidos en el flujo</legend>
          {payables.map(item => <label key={item.id} className="flex items-start gap-2 text-xs wrap-anywhere"><input type="checkbox" checked={!omittedPayments.includes(item.id)} onChange={event => setOmitted(event.target.checked ? omittedPayments.filter(id => id !== item.id) : [...omittedPayments, item.id])} className="size-4 shrink-0 accent-primary" /><span>{item.name} · {healthDate(item.dueDate)} · {format(item.amount)}</span></label>)}
        </fieldset>}
        <p className="text-xs leading-relaxed text-muted-foreground">El flujo usa el dinero libre y las fechas de los compromisos. Los ingresos y gastos agregados del escenario se aplican a los pilares del período.</p>
      </div>
      <div className="min-w-0 space-y-3" aria-live="polite">
        {simulation ? <>
          <dl className="grid grid-cols-2 gap-2 rounded-xl border border-border p-3 text-sm">
            {[['Puntuación base', metric(base.score)], ['Puntuación hipotética', metric(simulation.scenario.score)], ['Diferencia global', simulation.difference === null ? 'Datos insuficientes' : changeText(simulation.difference)], ['Ahorro potencial del período', format(simulation.potentialSaving)], ['Mínimo libre base', format(base.indicators.cashFlow?.minimum)], ['Mínimo libre hipotético', format(scenarioFlow?.minimum)], ['Saldo libre final hipotético', format(scenarioFlow?.final)], ['Primer déficit hipotético', scenarioFlow?.firstDeficit ? healthDate(scenarioFlow.firstDeficit) : scenarioFlow ? 'Sin déficit previsto' : 'No disponible']].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-semibold wrap-anywhere tabular-nums">{value}</dd></div>)}
          </dl>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full table-fixed text-left text-xs"><caption className="sr-only">Comparación de pilares</caption><thead className="bg-secondary text-muted-foreground"><tr><th className="w-[46%] p-2" scope="col">Pilar</th><th className="p-2" scope="col">Base</th><th className="p-2" scope="col">Escenario</th></tr></thead>
              <tbody className="divide-y divide-border">{scores.map((item, index) => <tr key={item.id}><th scope="row" className="p-2 font-medium wrap-anywhere">{pillarContent[item.id].short}</th><td className="p-2 wrap-anywhere">{metric(base.pillars[index].score)}</td><td className="p-2 font-semibold wrap-anywhere">{metric(item.score)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">{simulation.affected.length ? `Pilares afectados · ${simulation.affected.map(item => pillarContent[item.id].short).join(', ')}.` : 'Sin variaciones en los pilares calculables.'}</p>
        </> : <p role={failed ? 'alert' : undefined} className="rounded-lg border border-border p-3 text-sm text-muted-foreground">{failed ? 'No se pudo procesar el escenario. Restablece los valores e inténtalo de nuevo.' : 'Corrige los importes del escenario para calcular la comparación.'}</p>}
      </div>
    </div>
  </section>
}
