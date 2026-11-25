import { isIsoDate } from '../../lib/calendar.ts'
import { projectionHorizons, type ProjectionHorizon } from '../commitments/commitment-model.ts'
import type { Period } from '../dashboard/model.ts'
import type { FinancialHealthPeriod } from '../health/health-model.ts'
import type { MicroExpenseDetectionConfig } from '../micro-expenses/micro-expense-model.ts'
import { defaultDetection } from '../micro-expenses/micro-expense-detection.ts'
import { DEFAULT_WARNING_THRESHOLD } from '../budgets/budget-calculations.ts'
import { DEFAULT_HORIZON, NOTIFICATION_DAYS } from '../commitments/cash-flow.ts'

const supportedTimeZone = (zone: string) => {
  try { new Intl.DateTimeFormat('es-CL', { timeZone: zone }); return true }
  catch { return false }
}
export const timeZones = ([
  { id: 'America/Santiago', label: 'Santiago' }, { id: 'America/Punta_Arenas', label: 'Punta Arenas' },
  { id: 'America/Coyhaique', label: 'Coyhaique' }, { id: 'Pacific/Easter', label: 'Rapa Nui' },
  { id: 'UTC', label: 'UTC' },
] as const).filter(zone => supportedTimeZone(zone.id))

export interface UserProfile { id: string; name: string; email: string; registeredOn?: string }
export interface RegionalPreferences { currency: 'CLP'; locale: 'es-CL'; language: 'es'; timeZone: string; money: 'symbol' | 'code'; dates: 'localized' | 'numeric'; dashboardPeriod: Period }
export interface FinancialPreferences { budgetWarning: number; horizon: ProjectionHorizon; minimumFree: number | null; analysisPeriod: FinancialHealthPeriod }
export interface AppearancePreferences { density: 'comfortable' | 'compact'; textSize: 'standard' | 'large'; reducedMotion: boolean; charts: boolean; compactSidebar: boolean }
export interface PrivacyPreferences { hideOnStart: boolean }
export interface UserPreferences {
  regional: RegionalPreferences; financial: FinancialPreferences; appearance: AppearancePreferences; privacy: PrivacyPreferences
  detection: MicroExpenseDetectionConfig; assistant: { enabled: boolean }
}

export const notificationCatalog = [
  { id: 'budgetWarning', label: 'Advertencias presupuestarias', active: true },
  { id: 'budgetExceeded', label: 'Presupuestos excedidos', active: true },
  { id: 'due', label: 'Próximos cobros y pagos', active: true },
  { id: 'overdue', label: 'Compromisos vencidos', active: true },
  { id: 'cashRisk', label: 'Riesgo de déficit financiero', active: true },
  { id: 'goalReached', label: 'Metas de ahorro alcanzadas', active: true },
  { id: 'goalMilestone', label: 'Hitos de ahorro', active: true },
  { id: 'goalDue', label: 'Fechas objetivo de ahorro', active: true },
  { id: 'confirmation', label: 'Confirmaciones de cobros y pagos', active: true },
  { id: 'micro', label: 'Información sobre gastos hormiga', active: false },
  { id: 'summary', label: 'Resúmenes financieros periódicos', active: false },
] as const
export type NotificationKind = typeof notificationCatalog[number]['id']
export type NotificationRule = { kind: NotificationKind; enabled: boolean }
export interface NotificationPreferences { enabled: boolean; daysAhead: 1 | 3 | 7; rules: Record<NotificationKind, boolean> }

export const defaultPreferences: UserPreferences = {
  regional: { currency: 'CLP', locale: 'es-CL', language: 'es', timeZone: 'America/Santiago', money: 'symbol', dates: 'localized', dashboardPeriod: 'month' },
  financial: { budgetWarning: DEFAULT_WARNING_THRESHOLD, horizon: DEFAULT_HORIZON, minimumFree: null, analysisPeriod: 'month' },
  appearance: { density: 'comfortable', textSize: 'standard', reducedMotion: false, charts: true, compactSidebar: false },
  privacy: { hideOnStart: false },
  detection: defaultDetection, assistant: { enabled: true },
}
export const defaultNotifications: NotificationPreferences = {
  enabled: true, daysAhead: NOTIFICATION_DAYS, rules: Object.fromEntries(notificationCatalog.map(item => [item.id, item.active])) as NotificationPreferences['rules'],
}

export type SettingsSection = 'perfil' | 'finanzas' | 'categorias' | 'hormiga' | 'salud' | 'notificaciones' | 'apariencia' | 'privacidad' | 'asistente' | 'seguridad' | 'datos'
export type SettingsSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'cancelled'
export interface SecuritySettings { provider: 'demo'; signedInAt: string }
export interface FinancialHealthPreferences { version: string; savingsReference: number; discretionaryReference: number; horizon: ProjectionHorizon }

const periods = new Set(['month', 'quarter', 'year'])
const analysisPeriods = new Set(['month', 'previous', 'quarter', 'half-year', 'year'])
const CLP_MAX = 999_999_999_999

export function validateProfile(name: string) {
  return name.trim().length < 2 || name.trim().length > 60 ? 'Usa un nombre visible de 2 a 60 caracteres.' : ''
}
export const initialsFor = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => [...part][0]).join('').toLocaleUpperCase('es-CL')

export function validateRegional(value: RegionalPreferences) {
  if (value.currency !== 'CLP' || value.locale !== 'es-CL' || value.language !== 'es') return 'Selecciona el formato regional disponible.'
  if (!timeZones.some(item => item.id === value.timeZone)) return 'Selecciona una zona horaria disponible.'
  if (!periods.has(value.dashboardPeriod) || !['symbol', 'code'].includes(value.money) || !['localized', 'numeric'].includes(value.dates)) return 'Revisa el período y los formatos seleccionados.'
  return ''
}

export function validateFinancial(value: FinancialPreferences) {
  const errors: Partial<Record<keyof FinancialPreferences, string>> = {}
  if (!Number.isInteger(value.budgetWarning) || value.budgetWarning < 1 || value.budgetWarning > 100) errors.budgetWarning = 'Usa un porcentaje entero entre 1 y 100.'
  if (!projectionHorizons.includes(value.horizon)) errors.horizon = 'Selecciona un horizonte válido.'
  if (value.minimumFree !== null && (!Number.isSafeInteger(value.minimumFree) || value.minimumFree < 0 || value.minimumFree > CLP_MAX)) errors.minimumFree = 'Ingresa una reserva entera en CLP o deja el campo vacío.'
  if (!analysisPeriods.has(value.analysisPeriod)) errors.analysisPeriod = 'Selecciona un período disponible.'
  return errors
}

export function validateDetection(value: MicroExpenseDetectionConfig) {
  if (typeof value.enabled !== 'boolean' || !Number.isSafeInteger(value.maximumAmount) || value.maximumAmount < 1 || value.maximumAmount > CLP_MAX ||
    !Number.isSafeInteger(value.minimumCount) || value.minimumCount < 1 || !['weekday', 'pattern'].includes(value.frequencyView) ||
    !Array.isArray(value.excludedCategoryIds) || value.excludedCategoryIds.some(item => typeof item !== 'string')) return 'Revisa el monto, la frecuencia y las exclusiones.'
  return ''
}
export function validatePresentation(value: Pick<UserPreferences, 'appearance' | 'privacy' | 'assistant'>) {
  const { appearance, privacy, assistant } = value
  if (!['comfortable', 'compact'].includes(appearance.density) || !['standard', 'large'].includes(appearance.textSize) ||
      [appearance.charts, appearance.compactSidebar, appearance.reducedMotion, privacy.hideOnStart, assistant.enabled].some(item => typeof item !== 'boolean')) {
    return 'Revisa las preferencias de presentación y privacidad.'
  }
  return ''
}
export const notificationsFor = <T extends { kind: NotificationKind }>(items: T[], options: NotificationPreferences) =>
  options.enabled ? items.filter(item => options.rules[item.kind]) : []

export const exportTypes = [
  { id: 'movements', label: 'Movimientos' }, { id: 'accounts', label: 'Cuentas' }, { id: 'categories', label: 'Categorías' },
  { id: 'budgets', label: 'Presupuestos' }, { id: 'commitments', label: 'Cobros y pagos' }, { id: 'savings', label: 'Metas y operaciones de reserva' },
] as const
export interface DataExportRequest { type: typeof exportTypes[number]['id']; from: string; to: string }
export const snapshotExport = (type: DataExportRequest['type']) => type === 'categories' || type === 'accounts'
export function validateExport(value: DataExportRequest, today: string) {
  if (!exportTypes.some(item => item.id === value.type)) return 'Selecciona un conjunto disponible.'
  if (snapshotExport(value.type)) return ''
  if (!isIsoDate(value.from) || !isIsoDate(value.to) || value.from > value.to || value.to > today) return 'Selecciona fechas válidas entre el inicio del período y hoy.'
  return ''
}

export function passwordIssue(current: string, next: string, confirmation: string) {
  if (!current) return 'Ingresa la contraseña de ejemplo actual.'
  if (next.length < 12) return 'Usa una contraseña de ejemplo de al menos 12 caracteres.'
  if (current === next) return 'Elige una contraseña distinta de la actual.'
  if (next !== confirmation) return 'Las contraseñas nuevas deben coincidir.'
  return ''
}
