export function dateInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone }).format(date)
}

export function isIsoDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000')) return false
  const instant = new Date(`${date}T00:00:00Z`)
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === date
}

export function shiftDays(date: string, days: number) {
  const instant = new Date(`${date}T12:00:00Z`)
  instant.setUTCDate(instant.getUTCDate() + days)
  return instant.toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string) {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000
}
