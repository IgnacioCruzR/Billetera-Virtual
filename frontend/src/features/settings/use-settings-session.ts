import { useEffect, useRef, useState } from 'react'
import { setRegionalFormats } from '@/lib/utils'
import type { NotificationPreferences, UserPreferences, UserProfile } from './preferences-model'
import { mergePreference, type SettingsRepository } from './settings-data'

export interface SettingsSnapshot {
  profile: UserProfile
  preferences: UserPreferences
  notifications: NotificationPreferences
}

export function useSettingsSession(repository: SettingsRepository, initial: SettingsSnapshot) {
  const [profile, setProfile] = useState(initial.profile)
  const [preferences, setPreferences] = useState(initial.preferences)
  const [notifications, setNotifications] = useState(initial.notifications)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    let active = true
    void Promise.all([repository.profile(), repository.preferences(), repository.notifications()]).then(([person, prefs, rules]) => {
      if (!active) return
      setRegionalFormats(prefs.regional.money, prefs.regional.dates)
      setProfile(person)
      setPreferences(prefs)
      setNotifications(rules)
      setStatus('ready')
    }, () => { if (active) setStatus('error') })
    return () => { active = false; mounted.current = false }
  }, [repository, attempt])

  async function updateProfile(name: string) {
    const updated = await repository.updateProfile(name)
    if (mounted.current) setProfile(updated)
    return updated.name
  }
  async function updatePreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    const saved = await repository.updatePreference(key, value)
    if (!mounted.current) return
    if (key === 'regional') {
      const region = saved as UserPreferences['regional']
      setRegionalFormats(region.money, region.dates)
    }
    setPreferences(current => mergePreference(current, key, saved))
  }
  async function updateNotifications(value: typeof notifications) {
    const saved = await repository.updateNotifications(value)
    if (mounted.current) setNotifications(saved)
  }
  return {
    profile, preferences, notifications, status, updateProfile, updatePreference, updateNotifications,
    retry() { setStatus('loading'); setAttempt(value => value + 1) },
    preparePasswordChange: repository.preparePasswordChange,
  }
}
export type SettingsSession = ReturnType<typeof useSettingsSession>
