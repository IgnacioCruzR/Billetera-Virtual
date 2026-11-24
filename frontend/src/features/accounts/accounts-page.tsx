import { useState } from 'react'
import { Eye, EyeOff, Plus, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/field'
import { today } from '@/features/dashboard/mock-data'
import { PeriodSelect } from '@/features/dashboard/navigation'
import type { Period } from '@/features/dashboard/model'
import { cn, formatMoney } from '@/lib/utils'
import { balanceOn, summarizeAccounts, type AccountSummary, type AccountWithBalance } from './account-balances'
import { AccountCard, AccountQuickActions, type AccountActionHandler, type AccountMovementHandler } from './account-cards'
import { AccountBalanceChart, AccountDistributionChart, BalanceChartTitle } from './account-charts'
import { totalReserved, type useFinancialRecords } from './account-data'
import { AccountAdjustmentDialog, AccountDetail, AccountFormDialog, AccountStatusDialog } from './account-dialogs'

function AccountSummaryPanel({ summary, hidden, onMovement }: { summary: AccountSummary; hidden: boolean; onMovement: AccountMovementHandler }) {
  const entries = [
    { label: 'Saldo de cuentas activas', value: summary.activeBalance },
    { label: 'Reservado para metas', value: summary.reserved },
    { label: 'Disponible no reservado', value: summary.available },
  ]
  return (
    <section aria-label="Resumen de cuentas" className="panel flex flex-col justify-between gap-4 bg-linear-to-br from-card via-card to-[#162a2b] p-4 sm:p-5">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-muted-foreground"><Wallet className="size-4 text-primary" aria-hidden="true" /> Patrimonio financiero registrado</h2>
          <span className="rounded-md border border-border bg-secondary/65 px-2 py-0.5 text-xs text-muted-foreground">{summary.activeCount} {summary.activeCount === 1 ? 'cuenta activa' : 'cuentas activas'}</span>
        </div>
        <p className="text-[clamp(1.8rem,4vw,2.6rem)] leading-tight font-bold tracking-[-0.045em] tabular-nums wrap-anywhere">{formatMoney(summary.registered, hidden)}</p>
        <p className="mt-1 text-xs text-muted-foreground">Saldo de tus cuentas activas y archivadas.</p>
        <dl className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {entries.map(item => (
            <div key={item.label} className="min-w-0 rounded-lg border border-border bg-secondary/55 p-2.5 last:col-span-2 sm:last:col-span-1">
              <dt className="text-xs leading-snug text-muted-foreground">{item.label}</dt>
              <dd className={cn('mt-1 text-sm font-semibold tabular-nums wrap-anywhere sm:text-base', item.label === 'Reservado para metas' && 'text-indigo-300')}>{item.value === null ? 'Sin datos' : formatMoney(item.value, hidden)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <AccountQuickActions count={summary.activeCount} onMovement={onMovement} />
    </section>
  )
}

type Modal = { type: 'create' } | { type: 'edit' | 'detail' | 'archive' | 'reactivate' | 'delete' | 'adjust'; id: string }

export function AccountsPage({ finance, detected, hidden, onTogglePrivacy, onMovement, onHistory, onToast }: {
  finance: ReturnType<typeof useFinancialRecords>; detected: ReadonlySet<string>; hidden: boolean;
  onTogglePrivacy: () => void; onMovement: AccountMovementHandler; onHistory: (id: string) => void; onToast: (message: string) => void;
}) {
  const [tab, setTab] = useState<'activa' | 'archivada'>('activa')
  const [period, setPeriod] = useState<Period>('month')
  const [chartAccount, setChartAccount] = useState('')
  const [modal, setModal] = useState<Modal | null>(null)
  const [source, setSource] = useState<HTMLElement | null>(null)
  const { records, status } = finance
  const accounts: AccountWithBalance[] = records.accounts.map(account => ({ ...account, balance: balanceOn(account, records, today) }))
  const summary = summarizeAccounts(accounts, totalReserved)
  const archivedCount = accounts.length - summary.activeCount
  const visible = accounts.filter(account => account.status === tab)
  const selected = modal && 'id' in modal ? accounts.find(item => item.id === modal.id) : undefined
  const effectiveChartAccount = accounts.some(item => item.id === chartAccount) ? chartAccount : ''

  function create(trigger: HTMLElement) {
    setSource(trigger)
    setModal({ type: 'create' })
  }

  const onAction: AccountActionHandler = (type, account, trigger) => {
    if (type === 'history') { onHistory(account.id); return }
    setSource(trigger)
    setModal({ type, id: account.id })
  }

  function close() { setModal(null) }
  function restore(event: Event) {
    event.preventDefault()
    if (source?.isConnected) source.focus({ preventScroll: true })
    else document.getElementById('accounts-title')?.focus({ preventScroll: true })
  }

  return (
    <main id="cuentas" className="dashboard-anchor mx-auto flex max-w-[1600px] flex-col gap-5 px-4 pt-5 pb-8 sm:px-7 sm:pt-7 2xl:px-9" aria-labelledby="accounts-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="accounts-title" tabIndex={-1} className="text-[clamp(1.7rem,3vw,2.1rem)] leading-tight font-bold tracking-[-0.045em] outline-none">Mis cuentas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Administra dónde tienes tu dinero y consulta cómo se distribuye.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onTogglePrivacy} aria-pressed={hidden}>{hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{hidden ? 'Mostrar montos' : 'Ocultar montos'}</Button>
          <Button onClick={event => create(event.currentTarget)} disabled={status !== 'ready'}><Plus aria-hidden="true" /> Nueva cuenta</Button>
        </div>
      </div>
      {status === 'loading' && <div className="grid gap-3 sm:grid-cols-2" role="status" aria-label="Cargando cuentas"><div className="panel h-52 animate-pulse bg-accent" /><div className="panel h-52 animate-pulse bg-accent" /></div>}
      {status === 'error' && <div className="panel flex flex-wrap items-center gap-3 p-4" role="alert"><p>No se pudieron cargar las cuentas.</p><Button variant="outline" onClick={finance.reload}>Reintentar</Button></div>}
      {status === 'ready' && (
        <>
          <div className="grid gap-4 min-[1130px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] sm:gap-5">
            <AccountSummaryPanel summary={summary} hidden={hidden} onMovement={onMovement} />
            <AccountDistributionChart accounts={accounts} hidden={hidden} />
          </div>
          <section aria-labelledby="account-list-title">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="account-list-title" className="text-lg font-bold tracking-tight">Cuentas registradas</h2>
              <div role="group" aria-label="Estado de las cuentas" className="flex flex-wrap gap-1 rounded-lg border border-border bg-secondary p-1">
                <Button size="sm" variant={tab === 'activa' ? 'muted' : 'ghost'} aria-pressed={tab === 'activa'} onClick={() => setTab('activa')}>Activas ({summary.activeCount})</Button>
                <Button size="sm" variant={tab === 'archivada' ? 'muted' : 'ghost'} aria-pressed={tab === 'archivada'} onClick={() => setTab('archivada')}>Archivadas ({archivedCount})</Button>
              </div>
            </div>
            {visible.length ? (
              <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3 min-[1660px]:grid-cols-4">
                {visible.map(account => <AccountCard account={account} hidden={hidden} key={account.id} onAction={onAction} onMovement={onMovement} canTransfer={summary.activeCount > 1} />)}
              </div>
            ) : (
              <div className="panel px-4 py-8 text-center">
                <p className="font-semibold">{tab === 'archivada' ? 'Aún no tienes cuentas archivadas.' : 'Aún no tienes cuentas activas.'}</p>
                {tab === 'activa' && <Button variant="outline" className="mt-3" onClick={event => create(event.currentTarget)}>Crear una cuenta</Button>}
              </div>
            )}
          </section>
          {accounts.length > 0 && (
            <section className="panel p-4 sm:p-5" aria-labelledby="account-balance-title">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <BalanceChartTitle id="account-balance-title" />
                <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Select aria-label="Cuenta para la evolución" value={effectiveChartAccount} onChange={event => setChartAccount(event.target.value)} className="min-w-0 sm:max-w-54">
                    <option value="">Todas las cuentas</option>
                    {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </Select>
                  <PeriodSelect period={period} onChange={setPeriod} label="Período de evolución" />
                </div>
              </div>
              <AccountBalanceChart records={records} accountId={effectiveChartAccount} period={period} hidden={hidden} />
            </section>
          )}
        </>
      )}
      {(modal?.type === 'create' || (modal?.type === 'edit' && selected)) && (
        <AccountFormDialog hidden={hidden} account={selected} onClose={close} onCloseAutoFocus={restore} onSave={async (draft, id) => {
          await finance.saveAccount(draft, id)
          if (!id) setTab('activa')
          onToast(id ? 'Cuenta actualizada.' : 'Cuenta creada.')
        }} />
      )}
      {modal?.type === 'detail' && selected && <AccountDetail account={selected} records={records} detected={detected} hidden={hidden} onClose={close} onCloseAutoFocus={restore} onHistory={() => { close(); onHistory(selected.id) }} />}
      {modal?.type === 'adjust' && selected && <AccountAdjustmentDialog account={selected} records={records} hidden={hidden} onClose={close} onCloseAutoFocus={restore} onSave={async draft => { await finance.adjustAccount(draft); onToast('Ajuste registrado.') }} />}
      {selected && (modal?.type === 'archive' || modal?.type === 'reactivate' || modal?.type === 'delete') && (
        <AccountStatusDialog account={selected} action={modal.type} records={records} hidden={hidden} onClose={close} onCloseAutoFocus={restore} onConfirm={async () => {
          if (modal.type === 'delete') { await finance.removeAccount(selected.id); onToast('Cuenta eliminada.'); return }
          await finance.setAccountStatus(selected.id, modal.type === 'archive' ? 'archivada' : 'activa')
          onToast(modal.type === 'archive' ? 'Cuenta archivada.' : 'Cuenta reactivada.')
        }} />
      )}
    </main>
  )
}
