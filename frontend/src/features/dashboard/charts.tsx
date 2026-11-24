import { useId, useState } from 'react'
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { ChartNoAxesCombined, ChartPie } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatCompactMoney, formatMoney } from '@/lib/utils'
import { chartModes, type ChartMode, type ChartPoint, type ExpenseSlice } from './model'

const axisStyle = { fill: 'var(--muted-foreground)', fontSize: 12 }

const chartLabels = {
  balance: 'Evolución del saldo total',
  cashflow: 'Ingresos y gastos efectivos',
  savings: 'Ahorro neto del intervalo',
} satisfies Record<ChartMode, string>

export function EvolutionChart({ data, hidden }: { data: ChartPoint[]; hidden: boolean }) {
  const [mode, setMode] = useState<ChartMode>('balance')
  const gradientId = useId().replace(/:/g, '')

  return (
    <section className="panel flex min-h-[340px] flex-col p-4 sm:p-5" aria-labelledby="evolucion-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="panel-heading flex items-center gap-2.5" id="evolucion-title"><ChartNoAxesCombined className="size-[18px] text-primary" aria-hidden="true" /> Evolución financiera</h2>
          <p className="mt-1 text-sm text-muted-foreground">{chartLabels[mode]}</p>
        </div>
        <div className="flex max-w-full gap-0.5 rounded-[9px] border border-border bg-secondary p-1" role="group" aria-label="Serie financiera">
          {chartModes.map(item => (
            <Button
              key={item.id}
              size="sm"
              variant="ghost"
              aria-pressed={mode === item.id}
              onClick={() => setMode(item.id)}
              className={cn('h-7 rounded-md px-2 text-xs sm:px-2.5', mode === item.id && 'bg-accent text-foreground')}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-5 h-[224px] min-w-0" aria-label={chartLabels[mode]} role="group">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={data} margin={{ top: 10, right: 14, left: -4, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.015} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
            <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} tickMargin={9} minTickGap={19} />
            <YAxis
              tick={hidden ? false : axisStyle}
              width={hidden ? 14 : 75}
              tickCount={5}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatCompactMoney}
              domain={mode === 'balance' ? [(min: number) => Math.floor(min / 250_000) * 250_000, (max: number) => Math.ceil(max / 250_000) * 250_000] : ['auto', 'auto']}
            />
            <Tooltip
              cursor={{ stroke: '#536479', fill: 'transparent', strokeDasharray: '4 3' }}
              content={({ active, payload, label }) => active && payload?.length ? (
                <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm shadow-lg">
                  <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
                  {payload.map(entry => (
                    <div key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="font-semibold tabular-nums">{formatMoney(Number(entry.value), hidden)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            />
            {mode === 'balance' && <Area dataKey="balance" name="Saldo" type="monotone" stroke="var(--primary)" strokeWidth={2.5} fill={`url(#${gradientId})`} isAnimationActive={false} activeDot={{ r: 5, fill: 'var(--primary)', stroke: 'var(--card)', strokeWidth: 2 }} />}
            {mode === 'cashflow' && <Bar dataKey="income" name="Ingresos" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={34} isAnimationActive={false} />}
            {mode === 'cashflow' && <Bar dataKey="expense" name="Gastos" fill="#818CF8" radius={[4, 4, 0, 0]} maxBarSize={34} isAnimationActive={false} />}
            {mode === 'savings' && (
              <Bar dataKey="savings" name="Ahorro neto" radius={4} maxBarSize={42} isAnimationActive={false}>
                {data.map(point => <Cell key={point.date} fill={point.savings < 0 ? 'var(--warning)' : 'var(--primary)'} />)}
              </Bar>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {mode === 'cashflow' && (
        <div className="mt-1.5 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />Ingresos</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-indigo-400" />Gastos</span>
        </div>
      )}
    </section>
  )
}

export function ExpenseChart({ distribution, hidden }: { distribution: ExpenseSlice[]; hidden: boolean }) {
  const total = distribution.reduce((sum, category) => sum + category.amount, 0)

  return (
    <section className="panel flex min-h-[340px] flex-col p-4 sm:p-5" aria-labelledby="distribucion-title">
      <h2 className="panel-heading flex items-center gap-2.5" id="distribucion-title"><ChartPie className="size-[18px] text-primary" aria-hidden="true" /> Distribución de gastos</h2>
      <p className="mt-1 text-sm text-muted-foreground">Gastos por categoría en el período</p>
      <div className="grid flex-1 items-center gap-3 pt-4 min-[400px]:grid-cols-[minmax(110px,0.94fr)_minmax(0,1fr)] lg:gap-2 xl:gap-3">
        <div className="relative mx-auto h-[176px] w-full max-w-47 min-w-0 sm:h-[187px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie data={distribution} dataKey="amount" nameKey="name" startAngle={90} endAngle={-270} innerRadius="71%" outerRadius="96%" stroke="none" paddingAngle={3} cornerRadius={5} isAnimationActive={false}>
                {distribution.map(item => <Cell key={item.id} fill={item.color} />)}
              </Pie>
              <Tooltip
                content={({ active, payload }) => active && payload?.length ? (
                  <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm shadow-lg">
                    <p className="text-xs text-muted-foreground">{payload[0].name}</p>
                    <p className="mt-0.5 font-semibold">{formatMoney(Number(payload[0].value), hidden)}</p>
                  </div>
                ) : null}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span className="text-[11px] font-medium text-muted-foreground">Total gastos</span>
            <span className="money text-sm min-[440px]:text-base" title={formatMoney(total, hidden)}>
              {total >= 1_000_000_000 && !hidden ? formatCompactMoney(total) : formatMoney(total, hidden)}
            </span>
          </div>
        </div>
        <ul className="min-w-0 space-y-2.5 text-xs sm:text-[13px]">
          {distribution.map(item => (
            <li key={item.id} className="flex min-w-0 items-center justify-between gap-1.5" title={`${item.name} · ${formatMoney(item.amount, hidden)}`}>
              <span className="flex min-w-0 items-center gap-1.5 leading-tight text-muted-foreground"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>
              <span className="shrink-0 font-semibold tabular-nums">{total ? Math.round(item.amount / total * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
