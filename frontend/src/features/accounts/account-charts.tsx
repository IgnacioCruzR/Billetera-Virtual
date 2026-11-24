import { useId } from 'react'
import { ChartNoAxesCombined, ChartPie } from 'lucide-react'
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompactMoney, formatDate, formatMoney } from '@/lib/utils'
import { today } from '@/features/dashboard/mock-data'
import type { FinancialRecords, Period } from '@/features/dashboard/model'
import { getPeriodEndDates } from '@/features/movements/movement-data'
import { balanceOn, registeredBalance, type AccountWithBalance } from './account-balances'

const axis = { fill: 'var(--muted-foreground)', fontSize: 12 }

export function AccountDistributionChart({ accounts, hidden }: { accounts: AccountWithBalance[]; hidden: boolean }) {
  const title = useId()
  const slices = accounts.filter(item => item.balance > 0)
  const total = slices.reduce((sum, item) => sum + item.balance, 0)
  return (
    <section className="panel p-4 sm:p-5" aria-labelledby={title}>
      <h2 id={title} className="flex items-center gap-2.5 text-lg font-bold tracking-tight"><ChartPie className="size-[18px] text-primary" aria-hidden="true" /> Distribución del dinero</h2>
      <p className="mt-1 text-xs text-muted-foreground">Participación de cada cuenta con saldo positivo.</p>
      {slices.length ? (
        <div className="mt-3 grid items-center gap-3 min-[375px]:grid-cols-[minmax(105px,0.9fr)_minmax(0,1fr)]">
          <div className="relative mx-auto h-39 w-full max-w-43 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie data={slices} dataKey="balance" nameKey="name" startAngle={90} endAngle={-270} innerRadius="70%" outerRadius="95%" stroke="none" paddingAngle={slices.length > 1 ? 3 : 0} cornerRadius={4} isAnimationActive={false}>
                  {slices.map(account => <Cell key={account.id} fill={account.color} />)}
                </Pie>
                <Tooltip content={({ active, payload }) => active && payload?.length ? (
                  <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm shadow-lg"><p className="text-xs text-muted-foreground">{payload[0].name}</p><p className="font-semibold">{formatMoney(Number(payload[0].value), hidden)}</p></div>
                ) : null} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] text-muted-foreground">Total positivo</span>
              <span className="text-xs font-bold tabular-nums sm:text-sm">{total >= 1_000_000_000 && !hidden ? formatCompactMoney(total) : formatMoney(total, hidden)}</span>
            </div>
          </div>
          <ul className="max-h-44 min-w-0 space-y-2 overflow-y-auto text-xs">
            {slices.map(account => (
              <li key={account.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1">
                <span className="flex min-w-0 items-start gap-1.5 text-muted-foreground"><span className="mt-1 size-2 shrink-0 rounded-full" style={{ backgroundColor: account.color }} aria-hidden="true" /><span className="wrap-anywhere">{account.name}</span></span>
                <span className="font-semibold tabular-nums">{Math.round(account.balance / total * 100)}%</span>
                <span className="col-span-2 pl-3.5 text-[11px] text-muted-foreground tabular-nums">{formatMoney(account.balance, hidden)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : <p className="flex min-h-38 items-center justify-center text-sm text-muted-foreground">Aún no hay saldos positivos para distribuir.</p>}
    </section>
  )
}

export function AccountBalanceChart({ records, accountId, period, hidden }: { records: FinancialRecords; accountId: string; period: Period; hidden: boolean }) {
  const account = records.accounts.find(item => item.id === accountId)
  const points = getPeriodEndDates(period).filter(date => !account || date >= account.openedOn).map(date => ({
    date, label: formatDate(date, period === 'month' ? { day: 'numeric', month: 'short' } : { month: 'short' }),
    balance: account ? balanceOn(account, records, date) : registeredBalance(records, date),
  }))
  const last = points.at(-1)

  return (
    <div className="min-w-0">
      <div className="h-52 min-w-0" role="group" aria-label="Gráfico de evolución del saldo">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={points} margin={{ top: 12, right: 16, left: 0, bottom: 2 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
            <XAxis dataKey="label" tick={axis} tickMargin={8} tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis tick={hidden ? false : axis} width={hidden ? 8 : 76} tickLine={false} axisLine={false} tickFormatter={formatCompactMoney} domain={['auto', 'auto']} />
            <Tooltip content={({ active, payload }) => {
              const point = payload?.[0]?.payload as typeof last
              return active && point ? (
                <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm shadow-lg"><p className="text-xs text-muted-foreground">{point.date === today ? 'Saldo actual' : formatDate(point.date, { day: 'numeric', month: 'short' })}</p><p className="font-semibold">{formatMoney(point.balance, hidden)}</p></div>
              ) : null
            }} />
            <Line type="linear" dataKey="balance" stroke="var(--primary)" strokeWidth={2.4} dot={false} isAnimationActive={false} />
            {last && <ReferenceDot x={last.label} y={last.balance} r={5} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-primary" aria-hidden="true" /> Saldo histórico al cierre</span><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" aria-hidden="true" /> Hoy{last ? ` · ${formatMoney(last.balance, hidden)}` : ''}</span></p>
    </div>
  )
}

export function BalanceChartTitle({ id }: { id?: string }) {
  return <h2 id={id} className="flex items-center gap-2.5 text-lg font-bold tracking-tight"><ChartNoAxesCombined className="size-[18px] text-primary" aria-hidden="true" /> Evolución del saldo</h2>
}
