import { createMockFinancialRepository, type FinancialRepository } from '@/features/accounts/account-data'
import { createDemoAnalysisProvider, type AssistantProvider } from '@/features/assistant/assistant-provider'
import type { AnalysisContext } from '@/features/assistant/assistant-model'
import { createMockHealthRepository, type FinancialHealthRepository, type HealthDataState } from '@/features/health/health-data'
import { defaultNotifications, defaultPreferences, type NotificationPreferences } from '@/features/settings/preferences-model'
import { createSettingsRepository, demoProfile, readVisualPreferences, type SettingsRepository } from '@/features/settings/settings-data'
import type { SettingsSnapshot } from '@/features/settings/use-settings-session'
import { demoNotifications } from '@/features/dashboard/demo-notifications'
import type { FinancialRecords } from '@/features/dashboard/model'
import type { AppNotification } from '@/features/dashboard/navigation'
import type { DashboardSnapshot } from '@/features/dashboard/use-dashboard'
import type { MicroExpenseDetectionConfig } from '@/features/micro-expenses/micro-expense-model'

export interface DashboardSources {
  financial: FinancialRepository
  settings: SettingsRepository
  settingsSnapshot: SettingsSnapshot
  analysis(context: AnalysisContext, available: boolean): AssistantProvider
  health(records: FinancialRecords, date: string, criteria: MicroExpenseDetectionConfig, timeZone: string): FinancialHealthRepository
  notifications(records: FinancialRecords, snapshot: DashboardSnapshot, health: HealthDataState, date: string, timeZone: string, rules: NotificationPreferences): AppNotification[]
}

function deviceStorage() {
  try { return window.localStorage } catch { return undefined }
}

export function createDemoSources(): DashboardSources {
  const storage = deviceStorage()
  return {
    financial: createMockFinancialRepository(),
    settings: createSettingsRepository(storage),
    settingsSnapshot: {
      profile: demoProfile,
      preferences: { ...defaultPreferences, ...readVisualPreferences(storage) },
      notifications: defaultNotifications,
    },
    analysis: createDemoAnalysisProvider,
    health: createMockHealthRepository,
    notifications: demoNotifications,
  }
}
