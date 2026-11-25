import { defaultNotifications, defaultPreferences, validateDetection, validateFinancial, validatePresentation, validateProfile, validateRegional, notificationCatalog, type NotificationPreferences, type UserPreferences, type UserProfile } from './preferences-model.ts'

export interface SettingsRepository {
  profile(): Promise<UserProfile>
  preferences(): Promise<UserPreferences>
  notifications(): Promise<NotificationPreferences>
  updateProfile(name: string): Promise<UserProfile>
  updatePreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): Promise<UserPreferences[K]>
  updateNotifications(value: NotificationPreferences): Promise<NotificationPreferences>
  preparePasswordChange(): Promise<never>
}

export function mergePreference<K extends keyof UserPreferences>(previous: UserPreferences, key: K, value: UserPreferences[K]): UserPreferences {
  return { ...previous, [key]: value }
}

const visualKey = 'billetera-visual-preferences'
type VisualPreferences = Pick<UserPreferences, 'appearance' | 'privacy'>
export function readVisualPreferences(storage?: Pick<Storage, 'getItem'>): VisualPreferences {
  const initial = { appearance: defaultPreferences.appearance, privacy: defaultPreferences.privacy }
  try {
    const parsed = JSON.parse(storage?.getItem(visualKey) ?? '{}')
    const appearance = parsed?.appearance
    return {
      appearance: {
        density: appearance?.density === 'compact' ? 'compact' : 'comfortable',
        textSize: appearance?.textSize === 'large' ? 'large' : 'standard',
        reducedMotion: appearance?.reducedMotion === true,
        charts: appearance?.charts !== false,
        compactSidebar: appearance?.compactSidebar === true,
      },
      privacy: { hideOnStart: parsed?.privacy?.hideOnStart === true },
    }
  } catch { return initial }
}

const wait = () => new Promise<void>(resolve => setTimeout(resolve, 140))
export const demoProfile: UserProfile = { id: 'camila-demo', name: 'Camila Rojas', email: 'camila.rojas@example.test' }

export function createSettingsRepository(storage?: Pick<Storage, 'getItem' | 'setItem'>): SettingsRepository {
  let profile = demoProfile
  let prefs = { ...defaultPreferences, ...readVisualPreferences(storage) }
  let notifications = defaultNotifications
  return {
    async profile() { return profile },
    async preferences() { return prefs },
    async notifications() { return notifications },
    async updateProfile(name) {
      await wait()
      const error = validateProfile(name)
      if (error) throw new Error(error)
      profile = { ...profile, name: name.trim().replace(/\s+/g, ' ') }
      return profile
    },
    async updatePreference(key, value) {
      await wait()
      const candidate = mergePreference(prefs, key, value)
      const error = validateRegional(candidate.regional) || Object.values(validateFinancial(candidate.financial))[0] || validateDetection(candidate.detection) || validatePresentation(candidate)
      if (error) throw new Error(error)
      if (key === 'appearance' || key === 'privacy') {
        try { storage?.setItem(visualKey, JSON.stringify({ appearance: candidate.appearance, privacy: candidate.privacy })) } catch { /* la preferencia sigue activa en la sesión */ }
      }
      prefs = candidate
      return value
    },
    async updateNotifications(value) {
      await wait()
      if (typeof value.enabled !== 'boolean' || ![1, 3, 7].includes(value.daysAhead) ||
        notificationCatalog.some(item => typeof value.rules[item.id] !== 'boolean' || (!item.active && value.rules[item.id]))) {
        throw new Error('Revisa los tipos de aviso y los días de anticipación.')
      }
      notifications = value
      return notifications
    },
    async preparePasswordChange() {
      await wait()
      throw new Error('El cambio de contraseña estará disponible al integrar la cuenta real.')
    },
  }
}
