import { useRef, useState } from 'react'
import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { Account, Movement } from '@/features/dashboard/model'
import { formatDate } from '@/lib/utils'
import { accountLabel, categoryLabel } from './history'
import { classificationOf } from './movement-data'
import { MicroExpenseBadge, TransactionAmount, TransactionIcon, TransactionTypeBadge, transactionDescription } from './transaction-history'

type DialogProps = { item: Movement; onClose: () => void; onCloseAutoFocus: (event: Event) => void }

export function TransactionDetailDrawer({ item, accounts, detected, hidden, onClose, onCloseAutoFocus }: DialogProps & {
  accounts: Account[]; detected: ReadonlySet<string>; hidden: boolean;
}) {
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} className="h-dvh max-h-none w-full max-w-md rounded-none border-y-0 border-r-0" style={{ top: 0, left: 'auto', right: 0, translate: 'none' }}>
        <DialogTitle className="panel-heading pr-8 font-sans text-xl">Detalle del movimiento</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">Datos de la operación registrada.</DialogDescription>
        <div className="mt-5 flex min-w-0 items-start gap-3 rounded-xl border border-border bg-secondary p-4">
          <TransactionIcon type={item.type} />
          <div className="min-w-0"><p className="font-semibold wrap-anywhere">{transactionDescription(item)}</p><div className="mt-1 text-xl"><TransactionAmount item={item} hidden={hidden} /></div></div>
        </div>
        <dl className="mt-4 divide-y divide-border text-sm [&>div]:grid [&>div]:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] [&>div]:items-center [&>div]:gap-3 [&>div]:py-3 [&_dt]:text-muted-foreground [&_dd]:text-right [&_dd]:font-medium">
          <div><dt>Tipo</dt><dd><TransactionTypeBadge type={item.type} /></dd></div>
          <div><dt>Fecha</dt><dd><time dateTime={item.date}>{formatDate(item.date, { day: 'numeric', month: 'long', year: 'numeric' })}</time></dd></div>
          <div><dt>{item.type === 'ingreso' ? 'Cuenta de destino' : 'Cuenta de origen'}</dt><dd>{accountLabel(accounts, item.accountId)}</dd></div>
          {item.type === 'transferencia' ? <div><dt>Cuenta de destino</dt><dd>{accountLabel(accounts, item.destinationId)}</dd></div> : <div><dt>Categoría</dt><dd>{categoryLabel(item) || '—'}</dd></div>}
          {item.type === 'gasto' && <div><dt>Clasificación</dt><dd><MicroExpenseBadge status={classificationOf(item, detected)} /></dd></div>}
          <div><dt>Moneda</dt><dd>CLP</dd></div>
        </dl>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteTransactionDialog({ item, onClose, onCloseAutoFocus, onDelete }: DialogProps & { onDelete: (id: string) => Promise<void> }) {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function remove() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError(false)
    try {
      await onDelete(item.id)
      onClose()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
      lock.current = false
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !lock.current) onClose() }}>
      <DialogContent closeDisabled={busy} aria-busy={busy} onCloseAutoFocus={onCloseAutoFocus}>
        <span className="mb-3 grid size-10 place-items-center rounded-lg bg-danger/12 text-red-300"><TriangleAlert className="size-5" aria-hidden="true" /></span>
        <DialogTitle className="panel-heading pr-8 font-sans text-xl">Eliminar movimiento</DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">¿Quieres eliminar «{transactionDescription(item)}»? Esta acción puede modificar tus saldos y estadísticas financieras.</DialogDescription>
        {error && <p className="mt-3 text-sm text-red-300" role="alert">No se pudo eliminar el movimiento. Intenta nuevamente.</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button className="bg-danger text-background hover:bg-red-400" onClick={remove} disabled={busy}>{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? 'Eliminando…' : 'Eliminar movimiento'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
