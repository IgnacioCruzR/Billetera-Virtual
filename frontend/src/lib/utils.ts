import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

const pesos = new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
})
const compactPesos = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 })

export function formatMoney(amount: number, hidden = false) {
  return hidden ? '$••••••' : pesos.format(amount)
}

export function formatCompactMoney(amount: number) {
  const absolute = Math.abs(amount)
  if (absolute < 1000) return formatMoney(amount)
  const sign = amount < 0 ? '−' : ''
  return absolute >= 1_000_000
    ? `${sign}$${compactPesos.format(absolute / 1_000_000)} M`
    : `${sign}$${compactPesos.format(absolute / 1000)} mil`
}

export function formatDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('es-CL', { ...options, timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`))
}
