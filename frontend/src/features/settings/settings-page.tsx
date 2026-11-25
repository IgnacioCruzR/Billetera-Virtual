import { useEffect, useRef } from 'react'
import { Bell, CircleDollarSign, Coffee, Database, Eye, HeartPulse, LayoutTemplate, LockKeyhole, Sparkles, Tag, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { useFinancialRecords } from '@/features/accounts/account-data'
import type { AssistantSession } from '@/features/assistant/use-assistant-session'
import { DetectionSettingsForm } from '@/features/micro-expenses/detection-settings'
import { CategoryManagement } from './settings-categories'
import { AppearanceSettings, Choice, FinanceSettings, HealthSettings, NotificationSettings, PrivacySettings, ProfileSettings } from './settings-preferences-panels'
import { AiSettings, DataExportPanel, PasswordSettings, SecurityPanel } from './settings-security-panels'
import { initialsFor, type SecuritySettings, type SettingsSection } from './preferences-model'
import type { SettingsSession } from './use-settings-session'

const sections = {
  perfil: { label: 'Perfil y región', icon: UserRound },
  finanzas: { label: 'Preferencias financieras', icon: CircleDollarSign },
  categorias: { label: 'Categorías', icon: Tag },
  hormiga: { label: 'Gastos hormiga', icon: Coffee },
  salud: { label: 'Salud financiera', icon: HeartPulse },
  notificaciones: { label: 'Notificaciones', icon: Bell },
  apariencia: { label: 'Apariencia', icon: LayoutTemplate },
  privacidad: { label: 'Privacidad', icon: Eye },
  asistente: { label: 'Asistente IA', icon: Sparkles },
  seguridad: { label: 'Seguridad', icon: LockKeyhole },
  datos: { label: 'Exportación y datos', icon: Database },
} satisfies Record<SettingsSection, { label: string; icon: typeof UserRound }>

const list = Object.entries(sections) as [SettingsSection, typeof sections[SettingsSection]][]

type Props = {
  section: string | null; dirty: boolean; settings: SettingsSession; finance: ReturnType<typeof useFinancialRecords>; assistant: AssistantSession;
  session: SecuritySettings; hidden: boolean; today: string; detected: ReadonlySet<string>; onPrivacy: () => void; onDirty: (dirty: boolean) => void;
  onSection: (section: SettingsSection) => void; onLogout: () => void; onToast: (text: string) => void;
}

function SettingsContent({ section, settings, finance, assistant, session, hidden, today, detected, onPrivacy, onDirty, onLogout, onToast }: Omit<Props, 'section' | 'dirty' | 'onSection'> & { section: SettingsSection }) {
  const changes = useRef(new Set<string>())
  useEffect(() => () => onDirty(false), [onDirty])
  function dirty(field: string, value: boolean) {
    if (value) changes.current.add(field)
    else changes.current.delete(field)
    onDirty(changes.current.size > 0)
  }
  const flag = (value: boolean) => dirty(section, value)
  switch (section) {
    case 'perfil': return <ProfileSettings settings={settings} onDirty={dirty} />
    case 'finanzas': return <FinanceSettings settings={settings} hidden={hidden} onDirty={flag} />
    case 'categorias': return <CategoryManagement finance={finance} onToast={onToast} />
    case 'hormiga': return <section className="panel p-4 sm:p-5">
      <h3 className="font-bold">Criterio de detección automática</h3>
      <p className="mt-1 mb-3 text-sm text-muted-foreground">El mismo criterio actualiza el dashboard y Gastos hormiga. Las marcas manuales se mantienen.</p>
      <DetectionSettingsForm config={settings.preferences.detection} hidden={hidden} onDirty={flag} onSave={async value => {
        await settings.updatePreference('detection', value); onToast('Criterio de gastos hormiga actualizado.')
      }} />
    </section>
    case 'salud': return <HealthSettings />
    case 'notificaciones': return <NotificationSettings settings={settings} onDirty={flag} />
    case 'apariencia': return <AppearanceSettings settings={settings} onDirty={flag} />
    case 'privacidad': return <PrivacySettings settings={settings} hidden={hidden} onPrivacy={onPrivacy} onDirty={flag} />
    case 'asistente': return <AiSettings session={assistant} settings={settings} onDirty={flag} onToast={onToast} />
    case 'seguridad': return <><SecurityPanel session={session} onLogout={onLogout} /><PasswordSettings settings={settings} onDirty={flag} /></>
    case 'datos': return <DataExportPanel records={finance.records} ready={finance.status === 'ready'} detected={detected} today={today} />
  }
}

export default function SettingsPage(props: Props) {
  const section: SettingsSection = props.section && Object.hasOwn(sections, props.section) ? props.section as SettingsSection : 'perfil'
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  const { settings, dirty } = props
  const profile = settings.profile
  return <main id="configuracion" className="dashboard-anchor mx-auto flex max-w-[1600px] min-w-0 flex-col gap-4 px-4 pt-5 pb-8 sm:gap-5 sm:px-7 sm:pt-7 2xl:px-9" aria-labelledby="settings-title">
    <div><h1 ref={heading} id="settings-title" tabIndex={-1} className="text-[clamp(1.7rem,3vw,2.1rem)] leading-tight font-extrabold tracking-[-0.045em] outline-none">Configuración</h1>
      <p className="mt-1 text-sm text-muted-foreground">Personaliza tu experiencia financiera.</p></div>
    <div className="panel flex min-w-0 flex-wrap items-center justify-between gap-3 border-primary/18 bg-linear-to-br from-[#183036] via-card to-card p-4 sm:p-5">
      <div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/12 text-lg font-extrabold text-emerald-200">{initialsFor(profile.name)}</span>
        <div className="min-w-0"><p className="font-bold wrap-anywhere">{profile.name}</p><p className="mt-0.5 text-xs wrap-anywhere text-muted-foreground">{profile.email}</p></div></div>
      <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', dirty ? 'border-warning/35 bg-warning/10 text-amber-200' : 'border-border bg-secondary/55 text-muted-foreground')}>{dirty ? 'Cambios pendientes' : 'Cuenta de demostración'}</span>
    </div>
    <div className="grid min-w-0 gap-4 md:grid-cols-[13.5rem_minmax(0,1fr)] lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="panel h-fit p-3 md:hidden"><Choice label="Sección de configuración" value={section} onChange={value => props.onSection(value as SettingsSection)}>
        {list.map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</Choice></div>
      <nav aria-label="Secciones de configuración" className="panel hidden h-fit min-w-0 gap-1 p-2 md:grid">
        {list.map(([id, { label, icon: Icon }]) => <Button key={id} size="sm" variant="ghost" aria-current={section === id ? 'page' : undefined}
          className={cn('h-auto min-h-9 justify-start gap-2 py-1.5 text-left text-sm', section === id && 'bg-primary/12 text-emerald-200')} onClick={() => props.onSection(id)}><Icon aria-hidden="true" className="size-4 shrink-0" />{label}</Button>)}
      </nav>
      <section className="grid min-w-0 gap-3 self-start" aria-labelledby="settings-section-title">
        <h2 id="settings-section-title" className="text-lg font-bold">{sections[section].label}</h2>
        {settings.status === 'loading' && <div role="status" aria-label="Cargando preferencias" className="panel h-36 bg-accent motion-safe:animate-pulse" />}
        {settings.status === 'error' && <div role="alert" className="panel flex flex-wrap items-center gap-2 p-3 text-sm">No se pudieron cargar las preferencias. <Button variant="outline" size="sm" onClick={settings.retry}>Reintentar</Button></div>}
        {settings.status === 'ready' && <SettingsContent key={section} {...props} section={section} />}
      </section>
    </div>
  </main>
}
