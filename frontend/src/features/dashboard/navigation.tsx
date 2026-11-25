import { useState } from 'react'
import {
  Activity, ArrowLeftRight, Bell, CalendarDays, ChartNoAxesCombined, CircleDollarSign,
  Coffee, LayoutGrid, Menu, PiggyBank, Plus, Settings, Sparkles, Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select } from '@/components/ui/field'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { initialsFor, type NotificationKind, type UserProfile } from '@/features/settings/preferences-model'
import { periods, type Period } from './model'

const navigation = [
  {
    title: 'Principal', items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
      { id: 'movimientos', label: 'Movimientos', icon: ArrowLeftRight },
      { id: 'cuentas', label: 'Mis cuentas', icon: Wallet },
      { id: 'presupuestos', label: 'Presupuestos', icon: ChartNoAxesCombined },
      { id: 'compromisos', label: 'Cobros y pagos', icon: CalendarDays },
    ],
  },
  {
    title: 'Análisis', items: [
      { id: 'hormiga', label: 'Gastos hormiga', icon: Coffee },
      { id: 'metas', label: 'Metas de ahorro', icon: PiggyBank },
      { id: 'salud', label: 'Salud financiera', icon: Activity },
    ],
  },
  {
    title: 'Herramientas', items: [
      { id: 'asistente', label: 'Asistente IA', icon: Sparkles },
      { id: 'configuracion', label: 'Configuración', icon: Settings },
    ],
  },
] as const

export type NavigationItem = typeof navigation[number]['items'][number]['id']
export type ApplicationPage = NavigationItem
export type AppNotification = { id: string; title: string; detail: string; section: NavigationItem; kind: NotificationKind; privateTitle?: string; privateDetail?: string }

type NavigationProps = { active: NavigationItem; onNavigate: (item: NavigationItem) => void }

function SidebarContent({ active, onNavigate, compact = false }: NavigationProps & { compact?: boolean }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-secondary">
      <div className={cn('flex h-[73px] shrink-0 items-center gap-3 border-b border-border px-5', compact && 'justify-center px-0')}>
        <span className="grid size-9 place-items-center rounded-[10px] bg-primary text-primary-foreground" aria-hidden="true">
          <Wallet className="size-5" strokeWidth={2.15} />
        </span>
        <span className={cn('font-display text-lg font-extrabold tracking-[-0.035em]', compact && 'sr-only')}>Billetera Virtual</span>
      </div>
      <nav aria-label="Navegación principal" className={cn('flex-1 space-y-6 overflow-auto px-3 py-6', compact && 'space-y-4 px-2')}>
        {navigation.map(group => (
          <div key={group.title}>
            <p className={cn('mb-2 px-3 text-[11px] font-bold tracking-[0.11em] text-muted-foreground uppercase', compact && 'sr-only')}>{group.title}</p>
            <ul className="space-y-1">
              {group.items.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <Button
                    variant="ghost"
                    aria-current={active === id ? (id in pageTitles ? 'page' : 'location') : undefined}
                    onClick={() => onNavigate(id)}
                    title={compact ? label : undefined}
                    className={cn('h-10 w-full justify-start gap-3 px-3 font-medium', compact && 'justify-center px-0', active === id && 'bg-primary/13 font-semibold text-emerald-300 hover:bg-primary/17 hover:text-emerald-200')}
                  >
                    <Icon className="size-[17px]" aria-hidden="true" />
                    <span className={compact ? 'sr-only' : undefined}>{label}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-border px-5 py-4 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-2"><CircleDollarSign className="size-4 shrink-0" aria-hidden="true" /><span className={compact ? 'sr-only' : undefined}>Datos de demostración</span></span>
      </div>
    </div>
  )
}

export function Sidebar(props: NavigationProps & { compact?: boolean }) {
  return <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] border-r border-border lg:block"><SidebarContent {...props} /></aside>
}

function MobileNavigation({ active, onNavigate }: NavigationProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9 lg:hidden" aria-label="Abrir menú"><Menu /></Button>
      </DialogTrigger>
      <DialogContent className="h-dvh max-h-none w-[min(85vw,19rem)] rounded-none border-y-0 border-l-0 p-0 sm:p-0" style={{ translate: 'none', top: 0, left: 0 }}>
        <DialogTitle className="sr-only">Menú de Billetera Virtual</DialogTitle>
        <DialogDescription className="sr-only">Accesos a las secciones del dashboard</DialogDescription>
        <SidebarContent active={active} onNavigate={item => { setOpen(false); onNavigate(item) }} />
      </DialogContent>
    </Dialog>
  )
}

export function PeriodSelect({ period, onChange, compact = false, label = 'Período del dashboard' }: { period: Period; onChange: (period: Period) => void; compact?: boolean; label?: string }) {
  return (
    <div className="relative">
      <Select aria-label={label} value={period} onChange={event => onChange(event.target.value as Period)} className="w-full bg-secondary pl-9 font-medium sm:w-45">
        {periods.map(option => <option key={option.id} value={option.id}>{compact && option.id === 'quarter' ? '3 meses' : option.label}</option>)}
      </Select>
      <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>
  )
}

function Notifications({ onNavigate, alerts, hidden }: { onNavigate: (item: NavigationItem) => void; alerts: AppNotification[]; hidden: boolean }) {
  const [read, setRead] = useState<string[]>([])
  const unread = alerts.filter(alert => !read.includes(alert.id)).length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative bg-background" aria-label={unread ? `Notificaciones (${unread} sin leer)` : 'Notificaciones'}>
          <Bell />
          {unread > 0 && <span className="absolute top-[8px] right-[8px] size-2 rounded-full border-2 border-background bg-primary" aria-hidden="true" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Bandeja de notificaciones" className="w-82 max-w-[calc(100vw-1.5rem)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="panel-heading shrink-0">Notificaciones</h2>
          {unread > 0 && <Button size="sm" variant="muted" onClick={() => setRead(current => [...new Set([...current, ...alerts.map(item => item.id)])])}>Marcar leídas</Button>}
        </div>
        {!alerts.length && <p className="text-sm text-muted-foreground">No tienes avisos pendientes.</p>}
        <ul className="space-y-1">
          {alerts.map(alert => (
            <li key={alert.id}>
              <PopoverClose asChild>
                <button
                  className="flex w-full gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-accent"
                  onClick={() => {
                    setRead(current => current.includes(alert.id) ? current : [...current, alert.id])
                    onNavigate(alert.section)
                  }}
                >
                  <span aria-hidden="true" className={cn('mt-1.5 size-2 shrink-0 rounded-full', read.includes(alert.id) ? 'bg-muted-foreground/30' : 'bg-primary')} />
                  <span><span className="block text-sm font-semibold">{hidden ? alert.privateTitle ?? alert.title : alert.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{hidden ? alert.privateDetail ?? alert.detail : alert.detail}</span></span>
                </button>
              </PopoverClose>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

export function RegisterButton({ onClick, className, disabled }: { onClick: () => void; className?: string; disabled?: boolean }) {
  return <Button className={cn('font-bold', className)} onClick={onClick} disabled={disabled}><Plus className="size-[18px]" aria-hidden="true" /> Registrar movimiento</Button>
}

export const pageTitles: Record<ApplicationPage, string> = { dashboard: 'Dashboard', movimientos: 'Movimientos', cuentas: 'Mis cuentas', presupuestos: 'Presupuestos', compromisos: 'Cobros y pagos', hormiga: 'Gastos hormiga', metas: 'Metas de ahorro', salud: 'Salud financiera', asistente: 'Asistente financiero', configuracion: 'Configuración' }

export function Header({ active, onNavigate, period, onPeriod, onRegister, page, ready, alerts, profile, hidden }: NavigationProps & {
  period: Period; onPeriod: (period: Period) => void; onRegister: () => void; page: ApplicationPage; ready: boolean; alerts: AppNotification[]; profile: UserProfile; hidden: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-[73px] max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-7 2xl:px-9">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <MobileNavigation active={active} onNavigate={onNavigate} />
          <span className="truncate font-display text-base font-extrabold tracking-[-0.02em] sm:text-lg">{pageTitles[page]}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
          {page === 'dashboard' && <div className="hidden sm:block"><PeriodSelect period={period} onChange={onPeriod} /></div>}
          <Notifications onNavigate={onNavigate} alerts={alerts} hidden={hidden} />
          <Button variant="muted" size="icon" aria-label={`Preferencias de ${profile.name}`} title={profile.name} onClick={() => onNavigate('configuracion')} className="size-9 rounded-full border border-primary/20 text-xs font-bold">
            {initialsFor(profile.name)}
          </Button>
          {page !== 'movimientos' && <RegisterButton className="ml-1 hidden sm:inline-flex" onClick={onRegister} disabled={!ready} />}
          {page !== 'dashboard' && page !== 'cuentas' && page !== 'movimientos' && <Button size="icon" className="size-9 sm:hidden" aria-label="Registrar movimiento" title="Registrar movimiento" onClick={onRegister} disabled={!ready}><Plus aria-hidden="true" /></Button>}
        </div>
      </div>
    </header>
  )
}
