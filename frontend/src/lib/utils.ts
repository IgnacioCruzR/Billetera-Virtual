import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

const pesos = new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
})
const compactPesos = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 })
const pesosCode = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', currencyDisplay: 'code', maximumFractionDigits: 0 })
let displayMoney: 'symbol' | 'code' = 'symbol'
let displayDates: 'localized' | 'numeric' = 'localized'

export function setRegionalFormats(money: typeof displayMoney, dates: typeof displayDates) {
  displayMoney = money
  displayDates = dates
}

export function formatMoney(amount: number, hidden = false) {
  return hidden ? '$••••••' : (displayMoney === 'code' ? pesosCode : pesos).format(amount)
}

export function formatCompactMoney(amount: number) {
  const absolute = Math.abs(amount)
  if (absolute < 1000) return formatMoney(amount)
  const sign = amount < 0 ? '−' : ''
  const prefix = displayMoney === 'code' ? 'CLP ' : '$'
  return absolute >= 1_000_000
    ? `${sign}${prefix}${compactPesos.format(absolute / 1_000_000)} M`
    : `${sign}${prefix}${compactPesos.format(absolute / 1000)} mil`
}

export function formatDate(date: string, options: Intl.DateTimeFormatOptions) {
  if (displayDates === 'numeric' && options.year && options.month && options.day) {
    return [date.slice(8, 10), date.slice(5, 7), date.slice(0, 4)].join('/')
  }
  return new Intl.DateTimeFormat('es-CL', { ...options, timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`))
}
