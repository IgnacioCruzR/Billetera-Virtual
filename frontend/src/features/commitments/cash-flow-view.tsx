import { useId, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CircleAlert, Clock3, ShieldCheck, TrendingUp, Wallet } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Field, Select } from '@/components/ui/field'
import { cn, formatCompactMoney, formatMoney } from '@/lib/utils'
import { compactDate, CommitmentAmount, CommitmentIcon, longDate, type CommitmentActionHandler } from './commitment-list'
import type { CashFlowProjection, CommitmentSummary, FinancialRisk } from './commitment-model'

export function CommitmentOverview({ summary, projection, hidden }: { summary: CommitmentSummary; projection: CashFlowProjection; hidden: boolean }) {
  const cards = [
    { title: 'Cobros pendientes', amount: summary.receipts, icon: ArrowDownLeft, color: 'text-primary bg-primary/10' },
    { title: 'Pagos pendientes', amount: summary.payments, icon: ArrowUpRight, color: 'text-red-300 bg-danger/10' },
    { title: 'Saldo actual', amount: projection.startingBalance, icon: Wallet, color: 'text-foreground bg-secondary' },
    { title: 'Saldo proyectado', amount: projection.finalBalance, icon: TrendingUp, color: 'text-blue-300 bg-blue-400/10' },
  ]
  return <section aria-label="Resumen de cobros y pagos" className="space-y-3">
    <div className="grid gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ title, amount, icon: Icon, color }) => <article key={title} aria-label={title} className="panel min-w-0 p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-muted-foreground">{title}</h2><span className={cn('shrink-0 rounded-lg p-2', color)}><Icon className="size-4" aria-hidden="true" /></span></div>
        <p className={cn('mt-1 text-[clamp(1.3rem,2.4vw,1.85rem)] leading-tight font-bold tracking-tight break-words tabular-nums', amount < 0 && 'text-red-300')}>{formatMoney(amount, hidden)}</p>
      </article>)}
    </div>
    <dl className="panel grid gap-3 px-4 py-3 text-sm min-[480px]:grid-cols-2 xl:grid-cols-4">
      <div><dt className="text-xs text-muted-foreground">Pendientes en total</dt><dd className="font-semibold">{summary.pendingCount}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Vencidos sin resolver</dt><dd className={cn('font-semibold', summary.overdueCount > 0 && 'text-amber-200')}>{summary.overdueCount}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Próximo vencimiento</dt><dd className="font-semibold wrap-anywhere">{summary.next ? `${compactDate(summary.next.dueDate)} · ${summary.next.name}` : 'Sin próximos vencimientos'}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Margen final sobre la reserva</dt><dd className={cn('font-semibold tabular-nums', (projection.margin ?? 0) < 0 && 'text-red-300')}>{projection.margin === null ? 'Sin reserva' : formatMoney(projection.margin, hidden)}</dd></div>
    </dl>
  </section>
}

function riskCopy(risk: FinancialRisk, hidden: boolean): [string, string] {
  const date = compactDate(risk.date)
  const amount = risk.amount === undefined ? '' : formatMoney(risk.amount, hidden)
  switch (risk.id) {
    case 'due': return ['Pago próximo a vencer', `Verifica que puedas cubrir el pago de ${amount} del ${date}.`]
    case 'overdue': return [risk.count === 1 ? '1 compromiso vencido' : `${risk.count} compromisos vencidos`, 'Revisa si ocurrieron, si necesitas reprogramarlos o si corresponde cancelarlos.']
    case 'before-receipts': return ['Pagos antes del primer cobro', `Revisa cómo cubrirás los pagos desde el ${date} mientras esperas los cobros.`]
    case 'deficit': return ['Posible déficit', `Desde el ${date} puede faltar dinero. El saldo mínimo es ${amount}. Revisa las fechas de pago y recepción.`]
    case 'depleted': return ['Posible agotamiento del saldo', `El ${date} el saldo puede agotarse. Revisa cuánto necesitas reservar para imprevistos.`]
    case 'concentration': return ['Pagos concentrados', `El ${date} coinciden ${risk.count} pagos por ${amount}. Considera repartir los vencimientos.`]
    case 'reserve': return ['Saldo inferior a la reserva', `El ${date} el saldo baja de ${amount}. Revisa qué pagos puedes reprogramar.`]
  }
}

export function FinancialRiskPanel({ risks, hidden, simulated, onDay }: { risks: FinancialRisk[]; hidden: boolean; simulated: boolean; onDay: (date: string) => void }) {
  return <aside className="panel min-w-0 p-4" aria-label="Análisis preventivo">
    <div className="flex gap-2.5"><CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-200" aria-hidden="true" /><div><h2 className="font-bold tracking-tight">Análisis preventivo</h2><p className="mt-0.5 text-xs text-muted-foreground">{simulated ? 'Riesgos del escenario simulado' : 'Riesgos del flujo proyectado'}</p></div></div>
    {risks.length ? <ul className="mt-3 divide-y divide-border/75">
      {risks.map(risk => {
        const [title, body] = riskCopy(risk, hidden)
        return <li key={risk.id}><button type="button" className="w-full rounded-md px-1 py-2.5 text-left hover:bg-accent focus-visible:outline-primary" onClick={() => onDay(risk.date)}>
          <span className={cn('block text-sm font-semibold', risk.id === 'deficit' ? 'text-red-300' : 'text-amber-100')}>{title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{body}</span>
        </button></li>
      })}
    </ul> : <p className="mt-4 flex gap-2 rounded-lg bg-primary/10 p-3 text-sm"><ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />Sin riesgos detectados en el horizonte seleccionado.</p>}
  </aside>
}

export function CashFlowChart({ base, simulated, date, onDay, hidden, onAction }: {
  base: CashFlowProjection; simulated?: CashFlowProjection; date: string; onDay: (date: string) => void; hidden: boolean; onAction: CommitmentActionHandler;
}) {
  const [showAxis, setShowAxis] = useState(false)
  const titleId = useId()
  const projection = simulated ?? base
  const today = base.points[0].date
  const point = projection.points.find(item => item.date === date) ?? projection.points[0]
  const data = [{ key: 'actual', base: base.startingBalance, simulated: simulated?.startingBalance },
    ...base.points.map((item, index) => ({ key: item.date, base: item.balance, simulated: simulated?.points[index].balance }))]
  const floor = Math.min(0, base.minimumBalance, projection.minimumBalance)
  const money = (amount: unknown) => formatMoney(Number(amount), hidden)
  const mark = (key: unknown) => key === 'actual' ? 'Actual' : compactDate(String(key))
  const dates = new Map(projection.points.map(item => [item.date, item]))
  return <section aria-labelledby={titleId} className="panel min-w-0 overflow-hidden p-3.5 sm:p-4">
    <h2 id={titleId} className="font-bold tracking-tight">Flujo de caja proyectado</h2>
    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Hasta el {longDate(base.endDate)} inclusive. Los vencidos se incluyen hoy. Los cobros son estimaciones.</p>
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />Actual</span>
      <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-budget-time" />Proyección base</span>
      {simulated && <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-violet-300" />Simulación</span>}
      <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="font-bold text-blue-200">○</span>Fecha con compromisos</span>
      {projection.reserve !== null && projection.reserve > 0 && <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-reserve" />Reserva</span>}
      {floor < 0 && <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded bg-danger/50" />Zona de déficit</span>}
    </div>
    <div className="mt-2 h-[225px] w-full min-w-0 sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%" onResize={width => setShowAxis(width >= 410)}>
        <LineChart data={data} margin={{ top: 13, right: 12, left: 2, bottom: 4 }} onClick={event => { if (typeof event.activeLabel === 'string') onDay(event.activeLabel === 'actual' ? today : event.activeLabel) }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="key" tickFormatter={mark} interval="preserveStartEnd" minTickGap={24} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis hide={!showAxis} width={70} domain={[floor, 'auto']} tickFormatter={value => hidden ? '••••' : formatCompactMoney(Number(value))} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} tickLine={false} axisLine={false} />
          {floor < 0 && <ReferenceArea y1={floor} y2={0} fill="var(--danger)" fillOpacity={0.12} />}
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
          {projection.reserve !== null && projection.reserve > 0 && <ReferenceLine y={projection.reserve} stroke="var(--reserve)" strokeDasharray="3 4" ifOverflow="extendDomain" />}
          <ReferenceLine x={point.date} stroke="var(--muted-foreground)" strokeOpacity={0.6} />
          <Tooltip content={({ active, label, payload }) => {
            if (!active || !payload?.length || typeof label !== 'string') return null
            const entries = dates.get(label)
            return <div className="space-y-1 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
              <p className="font-semibold">{mark(label)}</p>
              {label === 'actual' ? <p>Saldo actual · {money(base.startingBalance)}</p> : <>
                {payload.map(item => <p key={String(item.dataKey)}>{item.name} · {money(item.value)}</p>)}
                {entries && entries.receipts > 0 && <p className="text-emerald-300">Cobros · {money(entries.receipts)}</p>}
                {entries && entries.payments > 0 && <p className="text-red-300">Pagos · {money(entries.payments)}</p>}
              </>}
            </div>
          }} />
          <Line type="stepAfter" name="Proyección base" dataKey="base" stroke="var(--budget-time)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          {simulated && <Line type="stepAfter" name="Simulación" dataKey="simulated" stroke="#c4b5fd" strokeWidth={2} strokeDasharray="3 4" dot={false} isAnimationActive={false} />}
          <ReferenceDot x="actual" y={base.startingBalance} r={4} fill="var(--primary)" stroke="var(--card)" />
          {projection.points.filter(item => item.items.length > 0).map(item => <ReferenceDot key={item.date} x={item.date} y={item.balance} shape={({ cx, cy }) => (
            <g role="button" tabIndex={0} aria-label={`Consultar flujo del ${longDate(item.date)}`} aria-pressed={item.date === point.date} className="cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
              onClick={event => { event.stopPropagation(); onDay(item.date) }}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onDay(item.date) }
              }}>
              <circle cx={cx} cy={cy} r={9} fill="transparent" />
              <circle cx={cx} cy={cy} r={item.date === point.date ? 5 : 3.5} fill={simulated ? '#c4b5fd' : '#93c5fd'} stroke="var(--card)" />
            </g>
          )} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <dl className="grid gap-2 border-b border-border pb-3 text-sm min-[480px]:grid-cols-2" aria-live="polite">
      <div><dt className="text-xs text-muted-foreground">Saldo mínimo{simulated ? ' simulado' : ''}</dt><dd className="font-semibold tabular-nums">{money(projection.minimumBalance)} · {compactDate(projection.minimumDate)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Primer déficit{simulated ? ' simulado' : ''}</dt><dd className={cn('font-semibold', projection.firstDeficit && 'text-red-300')}>{projection.firstDeficit ? longDate(projection.firstDeficit) : 'Sin déficit previsto'}</dd></div>
    </dl>
    <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
      <div className="flex items-center gap-2"><Clock3 className="size-4 text-muted-foreground" aria-hidden="true" /><p className="text-sm font-semibold" aria-live="polite">{money(point.balance)} al cierre del día</p></div>
      <Field label="Fecha del flujo de caja">{id => <Select id={id} value={point.date} onChange={event => onDay(event.target.value)}>{projection.points.map(item => <option key={item.date} value={item.date}>{compactDate(item.date)}{item.date === today ? ' · Hoy' : ''}{item.items.length ? ` · ${item.items.length} compromiso(s)` : ''}</option>)}</Select>}</Field>
    </div>
    {point.items.length ? <ul className="mt-2 divide-y divide-border">
      {point.items.map(item => <li key={item.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
        <CommitmentIcon type={item.type} />
        <div className="min-w-0 flex-1">
          {simulated ? <span className="font-semibold wrap-anywhere">{item.name}</span> : <button type="button" className="text-left font-semibold wrap-anywhere hover:underline focus-visible:outline-primary" onClick={event => onAction('detail', item.id, event.currentTarget)}>{item.name}</button>}
          {(item.hypothetical || item.dueDate < today) && <p className="text-xs text-muted-foreground">{item.hypothetical ? 'Hipotético' : `Vencido el ${longDate(item.dueDate)}`}</p>}
        </div>
        <CommitmentAmount type={item.type} amount={item.amount} hidden={hidden} />
      </li>)}
    </ul> : <p className="mt-2 text-xs text-muted-foreground">No hay compromisos proyectados para este día.</p>}
  </section>
}
