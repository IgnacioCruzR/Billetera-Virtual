import type { ReactNode } from 'react'
import { ClipboardList, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, MoneyInput, Select } from '@/components/ui/field'
import { formatDate } from '@/lib/utils'
import { periods } from '@/features/dashboard/model'
import { projectionHorizons } from '@/features/commitments/commitment-model'
import { healthMethodology } from '@/features/health/health-assessment'
import { healthPeriods } from '@/features/health/health-model'
import { pillarContent } from '@/features/health/health-overview'
import { defaultNotifications, defaultPreferences, notificationCatalog, timeZones, validateFinancial, type FinancialPreferences, type RegionalPreferences } from './preferences-model'
import { SectionForm } from './settings-form'
import type { SettingsSession } from './use-settings-session'

export function Toggle({ label, value, onChange, disabled, description }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean; description?: string }) {
  return <label className="flex min-w-0 items-start justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3">
    <span className="min-w-0"><span className="block text-sm font-semibold">{label}</span>{description && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>}</span>
    <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={value} disabled={disabled} onChange={event => onChange(event.target.checked)} />
  </label>
}
export function Choice({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <Field label={label}>{id => <Select id={id} value={value} onChange={event => onChange(event.target.value)}>{children}</Select>}</Field>
}

export function ProfileSettings({ settings, onDirty }: { settings: SettingsSession; onDirty: (field: string, dirty: boolean) => void }) {
  const { profile, preferences } = settings
  return <>
    <SectionForm title="Perfil personal" initial={profile.name} onDirty={value => onDirty('name', value)} onSave={settings.updateProfile} label="Guardar perfil">
      {(name, update) => <>
        <Field label="Nombre visible">{id => <Input id={id} autoComplete="nickname" maxLength={60} value={name} onChange={event => update(event.target.value)} />}</Field>
        {profile.registeredOn && <p className="text-xs text-muted-foreground">Fecha de registro · {formatDate(profile.registeredOn, { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
      </>}
    </SectionForm>
    <SectionForm title="Idioma y región" description="La zona horaria determina el corte de movimientos, indicadores y vencimientos." initial={preferences.regional} defaults={defaultPreferences.regional} onDirty={value => onDirty('regional', value)} onSave={value => settings.updatePreference('regional', value)} label="Guardar región">
      {(value, set) => <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-2.5 text-sm"><p className="text-xs text-muted-foreground">Idioma y configuración regional</p><p className="mt-0.5 font-semibold">Español · Chile (es-CL)</p></div>
        <div className="rounded-lg border border-border p-2.5 text-sm"><p className="text-xs text-muted-foreground">Moneda principal</p><p className="mt-0.5 font-semibold">Peso chileno · CLP</p></div>
        <Choice label="Zona horaria" value={value.timeZone} onChange={timeZone => set({ ...value, timeZone })}>{timeZones.map(zone => <option key={zone.id} value={zone.id}>{zone.label} · {zone.id}</option>)}</Choice>
        <Choice label="Período inicial del dashboard" value={value.dashboardPeriod} onChange={dashboardPeriod => set({ ...value, dashboardPeriod: dashboardPeriod as RegionalPreferences['dashboardPeriod'] })}>{periods.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</Choice>
        <Choice label="Formato monetario" value={value.money} onChange={money => set({ ...value, money: money as RegionalPreferences['money'] })}><option value="symbol">Símbolo · $12.500</option><option value="code">Código · CLP 12.500</option></Choice>
        <Choice label="Formato de fechas" value={value.dates} onChange={dates => set({ ...value, dates: dates as RegionalPreferences['dates'] })}><option value="localized">Localizado · 12 nov 2026</option><option value="numeric">Numérico · 12/11/2026</option></Choice>
      </div>}
    </SectionForm>
  </>
}

export function FinanceSettings({ settings, hidden, onDirty }: { settings: SettingsSession; hidden: boolean; onDirty: (value: boolean) => void }) {
  const initial = settings.preferences.financial
  const serialize = (item: FinancialPreferences) => ({ ...item, budgetWarning: String(item.budgetWarning), minimumFree: item.minimumFree === null ? '' : String(item.minimumFree) })
  return <SectionForm title="Preferencias financieras" description="Los valores predeterminados se aplican a formularios y proyecciones nuevos." initial={serialize(initial)} defaults={serialize(defaultPreferences.financial)} onDirty={onDirty}
    onSave={async value => {
      const draft = { ...value, budgetWarning: /^\d+$/.test(value.budgetWarning) ? Number(value.budgetWarning) : NaN,
        minimumFree: value.minimumFree === '' ? null : /^\d+$/.test(value.minimumFree) ? Number(value.minimumFree) : NaN }
      const error = Object.values(validateFinancial(draft))[0]
      if (error) throw new Error(error)
      await settings.updatePreference('financial', draft)
    }}>
    {(value, set) => <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Umbral presupuestario inicial (%)">{id => <Input id={id} inputMode="numeric" maxLength={3} value={value.budgetWarning} onChange={event => set({ ...value, budgetWarning: event.target.value })} />}</Field>
        <Choice label="Horizonte de proyección" value={String(value.horizon)} onChange={horizon => set({ ...value, horizon: Number(horizon) as FinancialPreferences['horizon'] })}>{projectionHorizons.map(days => <option key={days} value={days}>{days} días</option>)}</Choice>
        <Field label="Reserva mínima deseada (CLP)">{id => <MoneyInput hidden={hidden} id={id} inputMode="numeric" maxLength={12} placeholder="Opcional" value={value.minimumFree} onChange={event => set({ ...value, minimumFree: event.target.value })} />}</Field>
        <Choice label="Período inicial de análisis" value={value.analysisPeriod} onChange={analysisPeriod => set({ ...value, analysisPeriod: analysisPeriod as FinancialPreferences['analysisPeriod'] })}>{healthPeriods.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</Choice>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">El umbral se aplica al crear un presupuesto. La reserva mínima es una referencia de caja para simulaciones y se mantiene independiente de los aportes y reservas efectivos.</p>
    </>}
  </SectionForm>
}

export function HealthSettings() {
  const method = healthMethodology
  return <section className="panel p-4 sm:p-5">
    <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-bold">Metodología vigente</h3><span className="rounded-md bg-blue-400/10 px-2 py-1 text-xs font-semibold text-blue-200">{method.version}</span></div>
    <p className="mt-1 text-sm text-muted-foreground">Referencias orientativas del producto. Los cambios quedan sujetos a la aprobación de la metodología y su versión.</p>
    <dl className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(method.weights).map(([id, weight]) => <div key={id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
      <dt className="text-sm">{pillarContent[id as keyof typeof pillarContent].name}</dt><dd className="shrink-0 font-semibold text-blue-200">{weight} %</dd>
    </div>)}</dl>
    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
      <div><dt className="text-muted-foreground">Tasa de ahorro</dt><dd>{method.savingsReference * 100} %</dd></div>
      <div><dt className="text-muted-foreground">Proporción prescindible</dt><dd>{method.discretionaryReference * 100} %</dd></div>
      <div><dt className="text-muted-foreground">Horizonte de equilibrio</dt><dd>{method.horizon} días</dd></div>
    </dl>
    <a className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 hover:underline" href="#salud"><ClipboardList className="size-4" aria-hidden="true" />Abrir Salud financiera</a>
  </section>
}

export function NotificationSettings({ settings, onDirty }: { settings: SettingsSession; onDirty: (value: boolean) => void }) {
  return <SectionForm title="Bandeja interna" description="El control general pausa los avisos. Las reglas individuales conservan sus propios valores." initial={settings.notifications} defaults={defaultNotifications} onSave={settings.updateNotifications} onDirty={onDirty}>
    {(value, set) => <>
      <Toggle label="Mostrar notificaciones en la aplicación" value={value.enabled} onChange={enabled => set({ ...value, enabled })} />
      <Choice label="Anticipación de cobros y pagos" value={String(value.daysAhead)} onChange={days => set({ ...value, daysAhead: Number(days) as 1 | 3 | 7 })}>
        <option value="1">1 día antes</option><option value="3">3 días antes</option><option value="7">7 días antes</option>
      </Choice>
      <div className="grid gap-2 sm:grid-cols-2">{notificationCatalog.map(item =>
        <Toggle key={item.id} label={item.label} description={item.active ? undefined : 'Pendiente de integración'} disabled={!item.active} value={value.rules[item.id]}
          onChange={enabled => set({ ...value, rules: { ...value.rules, [item.id]: enabled } })} />)}</div>
    </>}
  </SectionForm>
}

export function AppearanceSettings({ settings, onDirty }: { settings: SettingsSession; onDirty: (value: boolean) => void }) {
  return <SectionForm title="Presentación" description="Tema oscuro. Las preferencias se aplican en este dispositivo." initial={settings.preferences.appearance} defaults={defaultPreferences.appearance} onSave={value => settings.updatePreference('appearance', value)} onDirty={onDirty}>
    {(value, set) => <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Choice label="Densidad" value={value.density} onChange={density => set({ ...value, density: density as typeof value.density })}><option value="comfortable">Cómoda</option><option value="compact">Compacta</option></Choice>
        <Choice label="Tamaño de texto" value={value.textSize} onChange={textSize => set({ ...value, textSize: textSize as typeof value.textSize })}><option value="standard">Estándar</option><option value="large">Grande</option></Choice>
      </div>
      <Toggle label="Reducir animaciones" description="También se respeta la preferencia de movimiento del dispositivo." value={value.reducedMotion} onChange={reducedMotion => set({ ...value, reducedMotion })} />
      <Toggle label="Mostrar gráficos en el dashboard" value={value.charts} onChange={charts => set({ ...value, charts })} />
      <Toggle label="Sidebar compacto en escritorio" value={value.compactSidebar} onChange={compactSidebar => set({ ...value, compactSidebar })} />
    </>}
  </SectionForm>
}

export function PrivacySettings({ settings, hidden, onPrivacy, onDirty }: { settings: SettingsSession; hidden: boolean; onPrivacy: () => void; onDirty: (value: boolean) => void }) {
  return <>
    <section className="panel p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-base font-bold"><ShieldCheck className="size-4 text-blue-300" aria-hidden="true" />Privacidad durante la sesión</h3>
      <p className="mt-1 text-sm text-muted-foreground">El modo de privacidad oculta importes en los módulos, gráficos y recomendaciones. El ocultamiento es visual. Las exportaciones confirmadas incluyen valores y la autorización de procesamiento se controla por separado.</p>
      <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={onPrivacy} aria-pressed={hidden}>{hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{hidden ? 'Mostrar montos' : 'Ocultar montos'}</Button>
        <Button variant="ghost" size="sm" asChild><a href="#configuracion?seccion=asistente">Consultar qué datos usa el asistente</a></Button></div>
    </section>
    <SectionForm title="Visibilidad inicial" initial={settings.preferences.privacy} defaults={defaultPreferences.privacy} onSave={value => settings.updatePreference('privacy', value)} onDirty={onDirty}>
      {(value, set) => <Toggle label="Ocultar montos al iniciar la aplicación" value={value.hideOnStart} onChange={hideOnStart => set({ hideOnStart })} />}
    </SectionForm>
  </>
}

