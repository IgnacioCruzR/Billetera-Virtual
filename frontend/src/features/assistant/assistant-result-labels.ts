import type { FinancialAnalysisResult } from './assistant-model'

export const privateText = 'Oculto por privacidad'
export const generatedLabel = (timestamp: string, timeZone: string) => new Intl.DateTimeFormat('es-CL', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp))
export const reportHref = (id: string) => '#asistente?' + new URLSearchParams({ informe: id })
export const sourceLabel = (report: FinancialAnalysisResult) => report.origin === 'demo' ? 'Demostración local' : 'Interpretación con IA'
