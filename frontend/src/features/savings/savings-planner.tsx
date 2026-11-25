import { useState } from 'react'
import { ArrowUpRight, CalendarClock, Calculator, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { formatMoney } from '@/lib/utils'
import { isIsoDate } from '@/lib/calendar'
import { savingsDate } from './savings-cards'
import { SavingsComparisonChart } from './savings-charts'
import type { SavingsGoalHistory, SavingsScenario } from './savings-model'
import { habitualContribution, projectSavings } from './savings-planning'
import { maximumSavingsAmount } from './savings-records'

export function SavingsPlanner({ histories, scenarios, goalId, scenarioId, today, hidden, onGoal, onClose }: {
  histories: SavingsGoalHistory[]; scenarios: SavingsScenario[]; goalId: string; scenarioId?: string; today: string; hidden: boolean;
  onGoal: (id: string) => void; onClose: () => void;
}) {
  const history = histories.find(item => item.goal.id === goalId)
  return <section id="savings-planner" className="panel scroll-mt-24 border-budget-time/30 p-4 sm:p-5" aria-labelledby="planner-title">
    <div className="flex flex-wrap justify-between gap-2"><div className="flex gap-2.5"><Calculator className="mt-0.5 size-5 shrink-0 text-blue-200" aria-hidden="true" /><div><h2 tabIndex={-1} id="planner-title" className="scroll-mt-24 text-lg font-bold">Planificador de ahorro</h2><p className="mt-0.5 text-xs text-muted-foreground">Compara aportes mensuales hipotéticos para una meta a la vez.</p></div></div><Button variant="ghost" size="sm" onClick={onClose}><X aria-hidden="true" />Cerrar planificador</Button></div>
    {histories.length ? <>
      <div className="mt-4 max-w-sm"><Field label="Meta del escenario">{id => <Select id={id} value={goalId} onChange={event => onGoal(event.target.value)}>
        {histories.map(item => <option key={item.goal.id} value={item.goal.id}>{item.goal.name}</option>)}
      </Select>}</Field></div>
      {history && <Strategy key={history.goal.id} history={history} scenarios={scenarios} scenarioId={scenarioId} today={today} hidden={hidden} />}
    </> : <p className="mt-4 text-sm text-muted-foreground">Crea una meta en progreso para elaborar un plan de ahorro.</p>}
  </section>
}

function Strategy({ history, scenarios, scenarioId, today, hidden }: { history: SavingsGoalHistory; scenarios: SavingsScenario[]; scenarioId?: string; today: string; hidden: boolean }) {
  const { goal, reserved } = history
  const habitual = habitualContribution(history, today)
  const [monthlyText, setMonthly] = useState(String(habitual.amount))
  const [desired, setDesired] = useState(goal.targetDate)
  const unavailable = Boolean(scenarioId && !scenarios.some(item => item.id === scenarioId))
  const [source, setSource] = useState(unavailable ? '' : scenarioId ?? '')
  const [bespoke, setBespoke] = useState('')
  const savedScenario = scenarios.find(item => item.id === source)
  const extra = savedScenario?.monthlyPotential ?? (source === 'manual' ? Number(bespoke) : 0)
  const validAmount = (value: string) => /^\d*$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= maximumSavingsAmount
  const manualInvalid = source === 'manual' && !validAmount(bespoke)
  const monthlyInvalid = !validAmount(monthlyText)
  const dateInvalid = desired !== '' && !isIsoDate(desired)
  const monthly = monthlyInvalid ? 0 : Number(monthlyText)
  const typical = projectSavings(goal.target, reserved, monthly, today, dateInvalid ? undefined : desired)
  const accelerated = projectSavings(goal.target, reserved, monthly + (manualInvalid ? 0 : extra), today, dateInvalid ? undefined : desired)
  const valid = !monthlyInvalid && !manualInvalid && !dateInvalid
  const monthsSaved = typical.months !== null && accelerated.months !== null ? typical.months - accelerated.months : null
  const shown = (date: string | null, months: number | null) => typical.remaining === 0 ? 'Ya alcanzada' : date ? `${savingsDate(date)} · ${months} ${months === 1 ? 'mes' : 'meses'}` : 'Estimación no disponible'
  const comparison = [
    ['Aporte mensual habitual', formatMoney(monthly, hidden)], ['Ahorro mensual adicional potencial', formatMoney(extra, hidden)],
    ['Aporte mensual acelerado', formatMoney(monthly + extra, hidden)], ['Aporte mensual requerido', typical.requiredMonthly === null ? 'Sin plazo aplicable' : formatMoney(typical.requiredMonthly, hidden)],
    ['Fecha estimada habitual', shown(typical.estimatedDate, typical.months)], ['Fecha estimada acelerada', shown(accelerated.estimatedDate, accelerated.months)],
  ]
  return <div className="mt-4 grid gap-4 lg:grid-cols-2">
    <div className="min-w-0 space-y-3 rounded-xl border border-border bg-secondary/50 p-3.5">
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-xs text-muted-foreground">Monto objetivo</dt><dd className="font-semibold tabular-nums">{formatMoney(goal.target, hidden)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Dinero ya reservado</dt><dd className="font-semibold tabular-nums">{formatMoney(reserved, hidden)}</dd></div>
      </dl>
      <p className="text-xs text-muted-foreground">Restante para el objetivo · <strong>{formatMoney(typical.remaining, hidden)}</strong></p>
      {goal.status === 'pausada' && <p className="text-xs text-amber-200">Meta pausada. Reactívala para registrar nuevos aportes.</p>}
      <Field label="Aporte mensual habitual (CLP)" error={monthlyInvalid ? 'Ingresa un monto entero mayor o igual a cero.' : undefined}>{(id, attrs) => <Input id={id} type={hidden ? 'password' : 'text'} inputMode="numeric" value={monthlyText} onChange={event => setMonthly(event.target.value)} {...attrs} />}</Field>
      <p className="text-xs text-muted-foreground">{habitual.source === 'history' ? 'Sugerencia basada en los últimos tres meses cerrados.' : habitual.source === 'plan' ? 'Valor inicial tomado del plan de la meta.' : 'Puedes ingresar un aporte habitual para estimar la fecha.'}</p>
      <Field label="Fecha deseada" error={dateInvalid ? 'Elige una fecha válida.' : undefined}>{(id, attrs) => <Input id={id} type="date" value={desired} onChange={event => setDesired(event.target.value)} {...attrs} />}</Field>
      <Field label="Escenario de ahorro adicional">{id => <Select id={id} value={source} onChange={event => setSource(event.target.value)}>
        <option value="">Sin ahorro adicional</option><option value="manual">Monto hipotético manual</option>
        {scenarios.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </Select>}</Field>
      {unavailable && !source && <p className="text-xs text-muted-foreground">El escenario enlazado ya no está disponible en esta sesión.</p>}
      {savedScenario && <p className="text-xs text-muted-foreground">Consumos del {savingsDate(savedScenario.from)} al {savingsDate(savedScenario.to)}.</p>}
      {source === 'manual' && <Field label="Ahorro adicional mensual (CLP)" error={manualInvalid ? 'Ingresa un monto entero mayor o igual a cero.' : undefined}>{(id, attrs) => <Input id={id} type={hidden ? 'password' : 'text'} inputMode="numeric" value={bespoke} onChange={event => setBespoke(event.target.value)} {...attrs} />}</Field>}
      <a href="#hormiga" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-200 hover:underline">Crear escenario en Gastos hormiga<ArrowUpRight className="size-4" aria-hidden="true" /></a>
      <p className="text-xs leading-relaxed text-muted-foreground">El calendario supone un aporte mensual desde el próximo mes en el mismo día de hoy. Si ese día no existe, usa el último del mes.</p>
    </div>
    <div className="min-w-0 space-y-3" aria-live="polite">
      {valid ? <>
        <dl className="grid grid-cols-2 gap-2.5 rounded-xl border border-border p-3 text-sm">{comparison.map(([label, value]) => <div className="min-w-0" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 font-semibold wrap-anywhere tabular-nums">{value}</dd></div>)}</dl>
        <p className="flex items-start gap-2 rounded-lg bg-budget-time/8 p-2.5 text-sm"><CalendarClock className="mt-0.5 size-4 shrink-0 text-blue-200" aria-hidden="true" />{monthsSaved !== null && monthsSaved > 0 ? `Este escenario podría adelantar la meta ${monthsSaved} ${monthsSaved === 1 ? 'mes' : 'meses'}.` : typical.remaining === 0 ? 'Esta meta ya tiene reservado todo el monto objetivo.' : typical.availableDeposits === 0 ? 'La fecha deseada llega antes del próximo aporte del calendario.' : typical.months === null && accelerated.months === null ? 'Se necesita un aporte mensual positivo para estimar una fecha.' : monthsSaved === 0 ? 'Ambos escenarios llegan en el mismo mes.' : 'El escenario acelerado permite estimar una fecha de cumplimiento.'}</p>
        {typical.remaining > 0 && (typical.estimatedDate || accelerated.estimatedDate) && <SavingsComparisonChart today={today} target={goal.target} reserved={reserved} usual={monthly} accelerated={monthly + extra} months={Math.max(typical.estimatedDate ? typical.months ?? 0 : 0, accelerated.estimatedDate ? accelerated.months ?? 0 : 0)} hidden={hidden} />}
        <p className="text-xs text-muted-foreground">Los aportes y el ahorro adicional de este plan son estimaciones.</p>
      </> : <p className="text-sm text-muted-foreground">Corrige los datos del escenario para calcular la comparación.</p>}
    </div>
  </div>
}
