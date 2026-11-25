import { useState, type FormEvent } from 'react'
import { Download, Eye, EyeOff, LogOut, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { downloadCsv } from '@/lib/csv'
import { analysisCatalog, analysisTypes } from '@/features/assistant/assistant-model'
import type { AssistantSession } from '@/features/assistant/use-assistant-session'
import type { FinancialRecords } from '@/features/dashboard/model'
import { Choice, Toggle } from './settings-preferences-panels'
import { SectionForm } from './settings-form'
import { ConfirmationDialog } from './settings-confirmation'
import { defaultPreferences, exportTypes, passwordIssue, snapshotExport, type DataExportRequest, type SecuritySettings as SessionInfo } from './preferences-model'
import { prepareExport } from './settings-export'
import type { SettingsSession } from './use-settings-session'

export function AiSettings({ session, settings, onDirty, onToast }: {
  session: AssistantSession; settings: SettingsSession; onDirty: (dirty: boolean) => void; onToast: (text: string) => void;
}) {
  const [confirm, setConfirm] = useState<'revoke' | 'clear' | null>(null)
  const consentText = { unset: 'Sin decisión registrada', allowed: 'Autorización concedida', declined: 'Solo demostración local', revoked: 'Autorización revocada' }
  return <>
    <SectionForm title="Uso del asistente" initial={settings.preferences.assistant} defaults={defaultPreferences.assistant} onDirty={onDirty}
      onSave={value => settings.updatePreference('assistant', value)}>
      {(value, set) => <Toggle label="Habilitar el asistente financiero" value={value.enabled} onChange={enabled => set({ enabled })} />}
    </SectionForm>
    <section className="panel space-y-3 p-4 sm:p-5">
      <div><h3 className="text-base font-bold">Procesamiento y autorización</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Según el análisis, el asistente puede consultar agregados de movimientos, cuentas, presupuestos, pagos y metas. Una futura integración podría enviar al proveedor externo los datos necesarios. Su acceso es de solo lectura y el registro de operaciones requiere tu confirmación por separado.</p></div>
      <p className="text-sm font-semibold text-emerald-200">{consentText[session.consent.preference]}</p>
      {session.run.status === 'processing' && <p className="rounded-lg bg-warning/10 p-2 text-sm text-amber-200">Hay un análisis en procesamiento. Revocar o desactivar descarta su espera en el navegador.</p>}
      <div className="flex flex-wrap gap-2">
        {session.consent.preference !== 'allowed' && <Button size="sm" onClick={() => { session.setPreference('allowed'); onToast('Autorización de sesión concedida.') }}>Autorizar en esta sesión</Button>}
        <Button variant="outline" size="sm" disabled={session.consent.preference !== 'allowed'} onClick={() => setConfirm('revoke')}>Revocar autorización</Button>
        <Button variant="outline" size="sm" disabled={!session.history.length && session.run.status !== 'processing'} onClick={() => setConfirm('clear')}>Eliminar informes de la sesión</Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">La demostración procesa los registros localmente. Revocar impide solicitar nuevos análisis hasta volver a autorizar. Las gestiones con un proveedor externo requerirán verificación por el servicio.</p>
      <details className="rounded-lg border border-border p-3 text-sm"><summary className="cursor-pointer font-semibold">Tipos de análisis disponibles</summary><ul className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-2">{analysisTypes.map(item => <li key={item}>{analysisCatalog[item].title}</li>)}</ul></details>
      <a className="text-sm font-semibold text-emerald-200 hover:underline" href="#configuracion?seccion=privacidad">Ver controles de privacidad</a>
    </section>
    {confirm && <ConfirmationDialog title={confirm === 'revoke' ? 'Revocar autorización de IA' : 'Eliminar informes temporales'}
      description={confirm === 'revoke' ? 'Se bloquearán las nuevas solicitudes y se descartará la espera en curso. Puedes conservar o borrar por separado los informes de esta sesión.' : 'Se eliminarán los informes del navegador y se descartará cualquier espera en curso de esta sesión.'}
      action={confirm === 'revoke' ? 'Confirmar revocación' : 'Confirmar eliminación'} onClose={() => setConfirm(null)} onConfirm={() => {
        if (confirm === 'revoke') { session.setPreference('revoked'); onToast('Autorización revocada.') }
        else { session.clearHistory(); onToast('Informes temporales eliminados.') }
        setConfirm(null)
      }} />}
  </>
}

export function PasswordSettings({ settings, onDirty }: { settings: SettingsSession; onDirty: (value: boolean) => void }) {
  const [visible, setVisible] = useState(false)
  const [strength, setStrength] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  function clear(form: HTMLFormElement) { form.reset(); setStrength(''); setVisible(false); onDirty(false) }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const values = new FormData(form)
    const issue = passwordIssue(String(values.get('current') ?? ''), String(values.get('next') ?? ''), String(values.get('confirmation') ?? ''))
    if (issue) { setError(issue); return }
    clear(form); setError(''); setBusy(true)
    try { await settings.preparePasswordChange() }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'El servicio de identidad no está disponible.') }
    finally { setBusy(false) }
  }
  return <form onSubmit={submit} onChange={() => onDirty(true)} className="panel space-y-3 p-4 sm:p-5" noValidate>
    <div><h3 className="font-bold">Cambio de contraseña</h3><p className="mt-1 text-sm text-muted-foreground">Pendiente de integración. Usa valores ficticios para probar el formulario.</p></div>
    <fieldset disabled={busy} className="grid gap-3">
      <Field label="Contraseña actual de ejemplo">{id => <Input id={id} type={visible ? 'text' : 'password'} name="current" autoComplete="off" maxLength={128} />}</Field>
      <Field label="Nueva contraseña de ejemplo">{id => <Input id={id} type={visible ? 'text' : 'password'} name="next" autoComplete="off" maxLength={128}
        onChange={event => { const value = event.target.value; setStrength(!value ? '' : value.length < 12 ? 'Corta' : /[0-9]/.test(value) && /[^\p{L}\p{N}]/u.test(value) ? 'Variada' : 'Aceptable por longitud') }} />}</Field>
      {strength && <p className="text-xs text-muted-foreground" role="status">Fortaleza orientativa · {strength}</p>}
      <Field label="Confirma la nueva contraseña">{id => <Input id={id} type={visible ? 'text' : 'password'} name="confirmation" autoComplete="off" maxLength={128} />}</Field>
    </fieldset>
    {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => setVisible(value => !value)} aria-pressed={visible}>{visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{visible ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}</Button>
      <Button variant="ghost" size="sm" onClick={event => { if (event.currentTarget.form) clear(event.currentTarget.form); setError('') }}>Cancelar cambios</Button>
      <Button size="sm" type="submit" disabled={busy}>{busy ? 'Comprobando…' : 'Comprobar formulario'}</Button>
    </div>
  </form>
}

export function SecurityPanel({ session, onLogout }: { session: SessionInfo; onLogout: () => void }) {
  return <section className="panel space-y-2 p-4 sm:p-5">
    <h3 className="flex items-center gap-2 font-bold"><ShieldCheck className="size-4 text-blue-300" aria-hidden="true" />Sesión de demostración</h3>
    <p className="text-sm text-muted-foreground">Inicio local · {new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(session.signedInAt))}</p>
    <p className="text-sm text-muted-foreground">Al cerrar la sesión se limpian los registros de esta demo, solicitudes e informes de este navegador.</p>
    <Button variant="outline" size="sm" onClick={onLogout}><LogOut aria-hidden="true" />Cerrar sesión</Button>
  </section>
}

export function DataExportPanel({ records, today, detected, ready }: { records: FinancialRecords; today: string; detected: ReadonlySet<string>; ready: boolean }) {
  const [request, setRequest] = useState<DataExportRequest>({ type: 'movements', from: today.slice(0, 7) + '-01', to: today })
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<ReturnType<typeof prepareExport> | null>(null)
  const update = (value: DataExportRequest) => { setRequest(value); setPreview(null); setError('') }
  return <>
    <section className="panel space-y-3 p-4 sm:p-5">
      <div><h3 className="font-bold">Exportar datos de demostración</h3><p className="mt-1 text-sm text-muted-foreground">Prepara un CSV de un conjunto de datos. El archivo incluye los importes del conjunto elegido y refleja los registros de la demo.</p></div>
      <Choice label="Conjunto de datos" value={request.type} onChange={type => update({ ...request, type: type as DataExportRequest['type'] })}>{exportTypes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</Choice>
      {!snapshotExport(request.type) ? <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Desde">{id => <Input id={id} type="date" max={today} value={request.from} onChange={event => update({ ...request, from: event.target.value })} />}</Field>
        <Field label="Hasta">{id => <Input id={id} type="date" max={today} value={request.to} onChange={event => update({ ...request, to: event.target.value })} />}</Field>
      </div> : <p className="text-xs text-muted-foreground">Se exporta el estado actual del catálogo.</p>}
      {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
      {!preview && <Button variant="outline" disabled={!ready} onClick={() => {
        try { setPreview(prepareExport(request, records, detected, today)); setError('') }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo preparar la exportación.') }
      }}>Preparar exportación</Button>}
      {preview && <div className="rounded-lg border border-primary/25 p-3" role="region" aria-label="Vista previa de exportación">
        <p className="text-sm font-semibold">{exportTypes.find(item => item.id === request.type)?.label} · {preview.rows} registros</p>
        <p className="mb-2 text-xs text-muted-foreground wrap-anywhere">{snapshotExport(request.type) ? 'Estado actual' : request.from + ' a ' + request.to} · {preview.filename}</p>
        <div className="flex flex-wrap gap-2"><Button size="sm" disabled={!preview.rows} onClick={() => downloadCsv(preview.csv, preview.filename)}><Download aria-hidden="true" />Descargar CSV de demostración</Button>
          <Button variant="outline" size="sm" onClick={() => setPreview(null)}>Cambiar selección</Button></div>
      </div>}
    </section>
    <section className="panel p-4 sm:p-5"><h3 className="font-bold">Datos de la cuenta</h3>
      <p className="mt-1 text-sm text-muted-foreground">Aquí puedes revisar las preferencias, el procesamiento mediante IA y los conjuntos exportables. Una futura solicitud de eliminación de cuenta requerirá verificación de identidad, confirmación y una política de retención y eliminación coordinada entre servicios.</p>
    </section>
  </>
}
