import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/field'
import { categoryName } from '@/features/budgets/budget-cards'
import { maximumMovementAmount } from '@/features/movements/movement-data'
import { formatDate, formatMoney } from '@/lib/utils'
import { goals, user } from './mock-data'
import type { MicroExpenseCriteria } from './model'
import type { DashboardView } from './navigation'
import type { DashboardSnapshot } from './use-dashboard'

const viewTitles = {
  metas: { title: 'Metas de ahorro', description: 'Consulta cuánto has reservado para cada objetivo.' },
  asistente: { title: 'Asistente financiero', description: 'Explora tus cifras con respuestas de demostración.' },
  configuracion: { title: 'Configuración', description: `Preferencias de ${user.name}.` },
} satisfies Record<DashboardView, { title: string; description: string }>

const prompts = [
  { id: 'balance', label: '¿Cuál es mi saldo disponible?' },
  { id: 'budget', label: '¿Qué presupuesto necesita atención?' },
  { id: 'payments', label: '¿Cuál es mi próximo pago?' },
] as const

function AssistantView({ data, hidden }: { data: DashboardSnapshot; hidden: boolean }) {
  const [selected, setSelected] = useState<typeof prompts[number]['id'] | null>(null)
  const reserved = goals.reduce((sum, goal) => sum + goal.saved, 0)
  const payment = data.commitments.find(item => item.type === 'pago')
  const exceeded = data.budgets.filter(budget => budget.used > budget.limit)
  const money = (amount: number) => formatMoney(amount, hidden)
  const answers = {
    balance: `En CLP, tu saldo actual es ${money(data.balance)} y tienes ${money(reserved)} reservados en metas. Tu saldo disponible es ${money(data.balance - reserved)}.`,
    budget: exceeded.length
      ? `Este mes superaste ${exceeded.map(item => `${categoryName(item.categoryId)} por ${money(item.used - item.limit)}`).join(', ')}.`
      : data.budgets.length ? 'Los gastos presupuestados están dentro de los límites del mes.' : 'El mes aún no tiene categorías presupuestadas.',
    payments: payment
      ? `Tu próximo pago es ${payment.description} el ${formatDate(payment.date, { day: 'numeric', month: 'long' })}, por ${money(payment.amount)}.`
      : 'No tienes pagos pendientes en los datos actuales.',
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Preguntas de ejemplo">
        {prompts.map(prompt => (
          <Button className="h-auto min-h-8 whitespace-normal py-1.5 text-left" variant={selected === prompt.id ? 'muted' : 'outline'} size="sm" key={prompt.id} onClick={() => setSelected(prompt.id)} aria-pressed={selected === prompt.id}>{prompt.label}</Button>
        ))}
      </div>
      {selected && <p role="status" className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/70 p-3 text-sm leading-relaxed"><Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />{answers[selected]}</p>}
    </div>
  )
}

function MicroExpensePreferences({ criteria, onSave }: { criteria: MicroExpenseCriteria; onSave: (value: MicroExpenseCriteria) => void }) {
  const [errors, setErrors] = useState({ amount: '', count: '' })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const maximumAmount = Number(data.get('maximum'))
    const minimumCount = Number(data.get('frequency'))
    const amount = !Number.isInteger(maximumAmount) || maximumAmount < 1 || maximumAmount > maximumMovementAmount ? 'Ingresa un monto entero entre 1 y 999.999.999.999 CLP.' : ''
    const count = !Number.isSafeInteger(minimumCount) || minimumCount < 1 ? 'Ingresa una frecuencia entera mayor que cero.' : ''
    setErrors({ amount, count })
    if (!amount && !count) onSave({ maximumAmount, minimumCount })
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 border-t border-border pt-3">
      <h3 className="font-semibold">Detección de gastos hormiga</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Monto máximo (CLP)" error={errors.amount}>{(id, attrs) => <Input id={id} name="maximum" type="number" min={1} step={1} defaultValue={criteria.maximumAmount} required {...attrs} />}</Field>
        <Field label="Frecuencia mínima mensual" error={errors.count}>{(id, attrs) => <Input id={id} name="frequency" type="number" min={1} step={1} defaultValue={criteria.minimumCount} required {...attrs} />}</Field>
      </div>
      <Button size="sm" type="submit">Guardar criterio</Button>
    </form>
  )
}

export function DashboardViews({ view, onClose, onCloseAutoFocus, data, hidden, onTogglePrivacy, criteria, onCriteria }: {
  view: DashboardView | null; onClose: () => void; onCloseAutoFocus: (event: Event) => void;
  data: DashboardSnapshot; hidden: boolean; onTogglePrivacy: () => void;
  criteria: MicroExpenseCriteria; onCriteria: (value: MicroExpenseCriteria) => void;
}) {
  const money = (amount: number) => formatMoney(amount, hidden)
  return (
    <Dialog open={view !== null} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        {view && <><DialogTitle className="panel-heading pr-7 text-xl">{viewTitles[view].title}</DialogTitle><DialogDescription className="mt-1 text-sm text-muted-foreground">{viewTitles[view].description}</DialogDescription></>}
        {view === 'metas' && (
          <ul className="mt-5 grid gap-3">
            {goals.map(goal => (
              <li key={goal.id} className="rounded-lg border border-border bg-secondary/70 p-3">
                <p className="text-sm font-semibold">{goal.name}</p>
                <progress className="my-1.5 h-2 w-full accent-primary" aria-label={goal.name} max={goal.target} value={goal.saved} />
                <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{money(goal.saved)}</span> de {money(goal.target)}</p>
              </li>
            ))}
          </ul>
        )}
        {view === 'asistente' && <AssistantView data={data} hidden={hidden} />}
        {view === 'configuracion' && (
          <div className="mt-5 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3"><span className="text-muted-foreground">Moneda</span><span className="font-semibold">Peso chileno · CLP</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Privacidad de montos</span><Button variant="outline" aria-pressed={hidden} onClick={onTogglePrivacy}>{hidden ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}{hidden ? 'Mostrar montos' : 'Ocultar montos'}</Button></div>
            <MicroExpensePreferences criteria={criteria} onSave={onCriteria} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
