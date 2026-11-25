import { useState, type FormEvent } from 'react'
import { FlaskConical, RotateCcw, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, MoneyInput, Select } from '@/components/ui/field'
import { maximumMovementAmount } from '@/features/movements/movement-data'
import { isIsoDate } from '@/lib/calendar'
import { cn, formatMoney } from '@/lib/utils'
import { deficitPeriods } from './cash-flow'
import { CommitmentAmount, commitmentTypes, compactDate, longDate } from './commitment-list'
import type { CashFlowItem, CashFlowProjection, CashFlowScenario, CommitmentType } from './commitment-model'

export function newScenario(reserve: number | null): CashFlowScenario {
  return { changes: {}, hypothetical: [], reserve }
}

export function CashFlowSimulator({ pending, scenario, base, simulated, today, hidden, onChange, onClose }: {
  pending: CashFlowItem[]; scenario: CashFlowScenario; base: CashFlowProjection; simulated: CashFlowProjection; today: string; hidden: boolean;
  onChange: (value: CashFlowScenario) => void; onClose: () => void;
}) {
  const [target, setTarget] = useState('')
  const selected = [...pending, ...scenario.hypothetical].find(item => item.id === target)
  const reserve = scenario.reserve === null ? '' : String(scenario.reserve)
  const delta = simulated.finalBalance - base.finalBalance
  const deficits = deficitPeriods(simulated)
  const comparison = [
    { title: 'Saldo final', left: formatMoney(base.finalBalance, hidden), right: formatMoney(simulated.finalBalance, hidden) },
    { title: 'Saldo mínimo', left: `${formatMoney(base.minimumBalance, hidden)} · ${compactDate(base.minimumDate)}`, right: `${formatMoney(simulated.minimumBalance, hidden)} · ${compactDate(simulated.minimumDate)}` },
    { title: 'Primer déficit', left: base.firstDeficit ? longDate(base.firstDeficit) : 'Sin déficit previsto', right: simulated.firstDeficit ? longDate(simulated.firstDeficit) : 'Sin déficit previsto' },
  ]

  function submit(item: CashFlowItem, excluded: boolean) {
    if (!selected) {
      onChange({ ...scenario, hypothetical: [...scenario.hypothetical, item] })
      setTarget(item.id)
    } else if (selected.hypothetical) {
      onChange({ ...scenario, hypothetical: scenario.hypothetical.map(entry => entry.id === item.id ? item : entry) })
    } else {
      onChange({ ...scenario, changes: { ...scenario.changes, [item.id]: { dueDate: item.dueDate, amount: item.amount, excluded } } })
    }
  }

  return <section id="cash-flow-simulator" className="panel min-w-0 border-violet-400/30 p-3.5 sm:p-4" aria-labelledby="cash-flow-simulator-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex gap-2.5"><FlaskConical className="mt-0.5 size-5 shrink-0 text-violet-300" aria-hidden="true" /><div><h2 id="cash-flow-simulator-title" className="font-bold text-violet-200">Modo simulación</h2><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Prueba cambios temporales en el flujo de caja.</p></div></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => { onChange(newScenario(base.reserve)); setTarget('') }}><RotateCcw aria-hidden="true" />Restablecer escenario</Button>
        <Button variant="ghost" size="sm" onClick={onClose}><X aria-hidden="true" />Cerrar simulador</Button>
      </div>
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <Field label="Compromiso a simular">{id => <Select id={id} value={target} onChange={event => setTarget(event.target.value)}>
          <option value="">Nuevo cobro o pago hipotético</option>
          {pending.length > 0 && <optgroup label="Pendientes">{pending.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>}
          {scenario.hypothetical.length > 0 && <optgroup label="Hipotéticos">{scenario.hypothetical.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>}
        </Select>}</Field>
        <ScenarioItemForm hidden={hidden} key={selected?.id ?? 'new'} item={selected} change={selected ? scenario.changes[selected.id] : undefined} today={today} onSave={submit} onRemove={selected?.hypothetical ? () => {
          onChange({ ...scenario, hypothetical: scenario.hypothetical.filter(item => item.id !== selected.id) })
          setTarget('')
        } : undefined} />
      </div>
      <div className="min-w-0 space-y-3">
        <ReserveForm hidden={hidden} key={reserve} original={reserve} onSave={value => onChange({ ...scenario, reserve: value })} />
        <div className="overflow-hidden rounded-lg border border-border text-sm" aria-live="polite">
          <table className="w-full table-fixed text-left">
            <caption className="sr-only">Comparación de proyecciones</caption>
            <thead className="bg-secondary text-xs text-muted-foreground"><tr><th scope="col" className="px-2 py-2 sm:px-3">Indicador</th><th scope="col" className="px-2 sm:px-3">Base</th><th scope="col" className="px-2 text-violet-200 sm:px-3">Simulado</th></tr></thead>
            <tbody className="divide-y divide-border">{comparison.map(row => <tr key={row.title}><th scope="row" className="px-2 py-2 text-xs font-medium sm:px-3">{row.title}</th><td className="px-2 text-xs wrap-anywhere tabular-nums sm:px-3">{row.left}</td><td className="px-2 text-xs wrap-anywhere tabular-nums sm:px-3">{row.right}</td></tr>)}</tbody>
          </table>
          <p className="flex flex-wrap justify-between gap-2 border-t border-border bg-violet-400/5 px-3 py-2 text-xs">Diferencia de saldo final <strong className={cn('tabular-nums', delta < 0 && 'text-red-300')}>{delta > 0 && !hidden && '+'}{formatMoney(delta, hidden)}</strong></p>
        </div>
        {deficits.length > 0 && <div className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs" aria-live="polite">
          <p className="font-semibold text-red-300">Fechas con posible déficit</p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{deficits.map(({ from, to }) => <li key={from}>{compactDate(from)}{from !== to && ` a ${compactDate(to)}`}</li>)}</ul>
        </div>}
        {scenario.hypothetical.length > 0 && <ul aria-label="Compromisos hipotéticos" className="divide-y divide-border">{scenario.hypothetical.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><button type="button" className="text-left font-semibold wrap-anywhere hover:underline" onClick={() => setTarget(item.id)}>{item.name} <span className="text-xs font-normal text-muted-foreground">· {compactDate(item.dueDate)}</span></button><CommitmentAmount type={item.type} amount={item.amount} hidden={hidden} /></li>)}</ul>}
      </div>
    </div>
  </section>
}

function ScenarioItemForm({ item, change, today, hidden, onSave, onRemove }: {
  hidden: boolean;
  item?: CashFlowItem; change?: CashFlowScenario['changes'][string]; today: string;
  onSave: (item: CashFlowItem, excluded: boolean) => void; onRemove?: () => void;
}) {
  const [type, setType] = useState<CommitmentType>(item?.type ?? 'pago')
  const [name, setName] = useState(item?.name ?? '')
  const [date, setDate] = useState(change?.dueDate ?? item?.dueDate ?? today)
  const [amount, setAmount] = useState(item ? String(change?.amount ?? item.amount) : '')
  const [excluded, setExcluded] = useState(change?.excluded ?? false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = Number(amount)
    if (!name.trim() || !isIsoDate(date) || !/^\d+$/.test(amount) || !Number.isSafeInteger(value) || value <= 0 || value > maximumMovementAmount) {
      setError('Ingresa un nombre, una fecha válida y un monto entero positivo en CLP.')
      return
    }
    setError('')
    setSaved(true)
    onSave({ id: item?.id ?? crypto.randomUUID(), type, name: name.trim(), dueDate: date, amount: value, hypothetical: item?.hypothetical ?? !item }, excluded)
  }

  return <form onSubmit={save} onChange={() => setSaved(false)} noValidate className="space-y-3">
    {(!item || item.hypothetical) && <div className="grid gap-2 sm:grid-cols-[minmax(100px,0.6fr)_minmax(0,1fr)]">
      <Field label="Tipo hipotético">{id => <Select id={id} value={type} onChange={event => setType(event.target.value as CommitmentType)}>{commitmentTypes.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</Select>}</Field>
      <Field label="Nombre hipotético">{id => <Input id={id} value={name} maxLength={120} onChange={event => setName(event.target.value)} />}</Field>
    </div>}
    {item && !item.hypothetical && item.type === 'cobro' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-violet-300" checked={excluded} onChange={event => setExcluded(event.target.checked)} />Excluir este cobro del escenario</label>}
    <div className="grid gap-2 sm:grid-cols-2">
      <Field label="Fecha simulada">{id => <Input id={id} type="date" value={date} onChange={event => setDate(event.target.value)} />}</Field>
      <Field label="Monto simulado (CLP)">{id => <MoneyInput hidden={hidden} id={id} inputMode="numeric" maxLength={12} value={amount} onChange={event => setAmount(event.target.value)} />}</Field>
    </div>
    <div className="flex flex-wrap items-center gap-2"><Button type="submit" variant="outline">{item ? 'Aplicar al escenario' : 'Agregar al escenario'}</Button>{onRemove && <Button variant="ghost" onClick={onRemove}><Trash2 aria-hidden="true" />Quitar hipotético</Button>}{saved && <span role="status" className="text-xs text-violet-200">Escenario actualizado.</span>}</div>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </form>
}

function ReserveForm({ original, hidden, onSave }: { original: string; hidden: boolean; onSave: (value: number | null) => void }) {
  const [reserve, setReserve] = useState(original)
  const [error, setError] = useState('')
  return <form className="space-y-2" onSubmit={event => {
    event.preventDefault()
    const value = Number(reserve)
    if (reserve !== '' && (!/^\d+$/.test(reserve) || !Number.isSafeInteger(value) || value > maximumMovementAmount)) {
      setError('Ingresa una reserva entera en CLP, o deja el campo vacío.')
      return
    }
    setError('')
    onSave(reserve === '' ? null : value)
  }}>
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1"><Field label="Reserva simulada (CLP)" error={error}>{(id, attrs) => <MoneyInput hidden={hidden} id={id} value={reserve} inputMode="numeric" maxLength={12} onChange={event => setReserve(event.target.value)} {...attrs} />}</Field></div>
      <Button variant="outline" type="submit">Aplicar reserva</Button>
    </div>
  </form>
}
