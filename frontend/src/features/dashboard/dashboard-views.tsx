import { useState } from 'react'
import { Eye, EyeOff, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { categoryName } from '@/features/budgets/budget-cards'
import { DetectionSettingsForm } from '@/features/micro-expenses/detection-settings'
import type { MicroExpenseDetectionConfig } from '@/features/micro-expenses/micro-expense-model'
import { formatDate, formatMoney } from '@/lib/utils'
import { user } from './mock-data'
import type { DashboardView } from './navigation'
import type { DashboardSnapshot } from './use-dashboard'

const viewTitles = {
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
  const reserved = data.savings.reserved
  const payment = data.commitments.find(item => item.type === 'pago' && item.dueDate >= data.today)
  const overdue = data.commitments.some(item => item.type === 'pago' && item.dueDate < data.today)
  const exceeded = data.budgets.filter(budget => budget.used > budget.limit)
  const money = (amount: number) => formatMoney(amount, hidden)
  const answers = {
    balance: `En CLP, tu saldo actual es ${money(data.balance)} y tienes ${money(reserved)} reservados en metas. Tu saldo disponible es ${money(data.balance - reserved)}.`,
    budget: exceeded.length
      ? `Este mes superaste ${exceeded.map(item => `${categoryName(item.categoryId)} por ${money(item.used - item.limit)}`).join(', ')}.`
      : data.budgets.length ? 'Los gastos presupuestados están dentro de los límites del mes.' : 'El mes aún no tiene categorías presupuestadas.',
    payments: payment
      ? `Tu próximo pago es ${payment.name} el ${formatDate(payment.dueDate, { day: 'numeric', month: 'long' })}, por ${money(payment.amount)}.`
      : overdue ? 'Tienes pagos vencidos por revisar en Cobros y pagos.' : 'No tienes pagos pendientes en los datos actuales.',
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

export function DashboardViews({ view, onClose, onCloseAutoFocus, data, hidden, onTogglePrivacy, criteria, onCriteria }: {
  view: DashboardView | null; onClose: () => void; onCloseAutoFocus: (event: Event) => void;
  data: DashboardSnapshot; hidden: boolean; onTogglePrivacy: () => void;
  criteria: MicroExpenseDetectionConfig; onCriteria: (value: MicroExpenseDetectionConfig) => void;
}) {
  return (
    <Dialog open={view !== null} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        {view && <><DialogTitle className="panel-heading pr-7 text-xl">{viewTitles[view].title}</DialogTitle><DialogDescription className="mt-1 text-sm text-muted-foreground">{viewTitles[view].description}</DialogDescription></>}
        {view === 'asistente' && <AssistantView data={data} hidden={hidden} />}
        {view === 'configuracion' && (
          <div className="mt-5 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3"><span className="text-muted-foreground">Moneda</span><span className="font-semibold">Peso chileno · CLP</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Privacidad de montos</span><Button variant="outline" aria-pressed={hidden} onClick={onTogglePrivacy}>{hidden ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}{hidden ? 'Mostrar montos' : 'Ocultar montos'}</Button></div>
            <h3 className="font-semibold">Detección de gastos hormiga</h3>
            <DetectionSettingsForm config={criteria} hidden={hidden} onSave={onCriteria} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
