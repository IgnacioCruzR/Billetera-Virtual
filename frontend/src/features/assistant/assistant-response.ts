import { isIsoDate } from '../../lib/calendar.ts'
import { isObject, parseAction } from './assistant-actions.ts'
import type { AnalysisPriority, FinancialAnalysisEvidence, FinancialAnalysisMetric, FinancialAnalysisRecommendation, FinancialAnalysisRequest, FinancialAnalysisResult, FinancialAnalysisRisk, PurchaseForecast, PurchaseImpactResult } from './assistant-model.ts'

function text(value: unknown, limit = 900) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value)
const date = (value: unknown): value is string => typeof value === 'string' && isIsoDate(value)

function metric(value: unknown): FinancialAnalysisMetric | null {
  if (!isObject(value)) return null
  const id = text(value.id, 64)
  const label = text(value.label, 160)
  const { unit, source } = value
  if (!id || !label || (source !== 'verified' && source !== 'hypothesis')) return null
  const info: Pick<FinancialAnalysisMetric, 'id' | 'label' | 'source'> = { id, label, source }
  const reading = value.value
  switch (unit) {
    case 'date': return date(reading) || reading === null ? { ...info, unit, value: reading } : null
    case 'clp':
    case 'count': return (integer(reading) && (unit === 'clp' || reading >= 0)) || reading === null ? { ...info, unit, value: reading } : null
    case 'score':
    case 'percent':
    case 'points':
      return (typeof reading === 'number' && Number.isFinite(reading) && (unit !== 'score' || (reading >= 0 && reading <= 100))) || reading === null ? { ...info, unit, value: reading } : null
    default: return null
  }
}

function isForecast(value: unknown): value is PurchaseForecast {
  return isObject(value) && integer(value.after) && integer(value.final) && integer(value.minimum) && integer(value.minimumMargin)
    && date(value.minimumDate) && (value.firstDeficit === null || date(value.firstDeficit))
}

function isPurchase(value: unknown): value is PurchaseImpactResult {
  if (!isObject(value) || !integer(value.accountBalance) || !integer(value.reserved) || !integer(value.free)
    || !integer(value.amount) || value.amount <= 0 || !integer(value.minimumFree) || !date(value.date)) return false
  if (!isForecast(value.expected) || !isForecast(value.conservative) || !isForecast(value.total) || !isForecast(value.totalConservative)) return false
  const budget = value.budget
  if (budget !== null && (!isObject(budget) || !text(budget.id, 128) || !integer(budget.limit) || !integer(budget.used)
    || !integer(budget.remainingBefore) || !integer(budget.remainingAfter))) return false
  return Array.isArray(value.trend) && value.trend.length > 0 && value.trend.length <= 91
    && value.trend.every(point => isObject(point) && date(point.date) && integer(point.expected) && integer(point.conservative))
}

export function normalizeAnalysis(value: unknown, request: FinancialAnalysisRequest, origin: FinancialAnalysisResult['origin']): FinancialAnalysisResult | null {
  if (!isObject(value) || value.requestId !== request.requestId || value.type !== request.type) return null
  const generatedAt = text(value.generatedAt)
  const range = value.range
  if (!Number.isFinite(Date.parse(generatedAt)) || !isObject(range) || !date(range.from) || !date(range.to) || range.from > range.to) return null
  let incomplete = false
  function list<T>(input: unknown, read: (item: unknown) => T | null, max = 45): T[] {
    if (!Array.isArray(input)) { incomplete = true; return [] }
    return input.slice(0, max).flatMap(item => {
      const output = read(item)
      if (output === null) { incomplete = true; return [] }
      return [output]
    })
  }
  const strings = (input: unknown) => list(input, item => text(item) || null)
  const metrics = list(value.metrics, metric)
  const metricIds = new Set(metrics.map(item => item.id))
  if (metrics.length !== metricIds.size) incomplete = true
  const uniqueMetrics = [...new Map(metrics.map(item => [item.id, item])).values()]
  function evidence(input: unknown): FinancialAnalysisEvidence | null {
    if (!isObject(input) || !text(input.text)) return null
    const ids = list(input.metricIds, item => typeof item === 'string' && metricIds.has(item) ? item : null)
    return { text: text(input.text), metricIds: ids, sensitive: input.sensitive === true }
  }
  function risk(input: unknown): FinancialAnalysisRisk | null {
    if (!isObject(input)) return null
    const title = text(input.title, 180)
    const priority: AnalysisPriority | null = input.priority === 'Alta' || input.priority === 'Media' || input.priority === 'Normal' ? input.priority : null
    const proof = evidence(input.evidence)
    return title && priority && proof ? { title, priority, evidence: proof } : null
  }
  const strengths = list(value.strengths, evidence)
  const risks = list(value.risks, risk)
  const opportunities = list(value.opportunities, evidence)
  const recommendations = list(value.recommendations, (input): FinancialAnalysisRecommendation | null => {
    if (!isObject(input)) return null
    const base = risk(input)
    const description = text(input.description)
    if (!base || !description) return null
    const action = parseAction(input.action)
    if (input.action != null && !action) incomplete = true
    return { ...base, description, benefit: text(input.benefit) || undefined, action }
  })
  const quality = isObject(value.quality) ? { available: strings(value.quality.available), missing: strings(value.quality.missing) } : { available: [], missing: [] }
  const assumptions = strings(value.assumptions)
  const limitations = strings(value.limitations)
  const summary = isObject(value.summary) ? text(value.summary.text) : ''
  const templateVersion = text(value.templateVersion, 40)
  const purchase = request.type === 'purchase' && isPurchase(value.purchase) ? value.purchase : undefined
  if (!summary || !templateVersion || !isObject(value.quality) || (!metrics.length && value.status === 'available') ||
    (request.type === 'purchase' && value.status === 'available' && !purchase)) incomplete = true
  if (!['available', 'insufficient', 'incomplete'].includes(String(value.status))) incomplete = true
  const priority = { Alta: 0, Media: 1, Normal: 2 }
  risks.sort((a, b) => priority[a.priority] - priority[b.priority])
  recommendations.sort((a, b) => priority[a.priority] - priority[b.priority])
  return {
    requestId: request.requestId, type: request.type, generatedAt, range: { from: range.from, to: range.to }, origin,
    status: incomplete || value.status === 'incomplete' ? 'incomplete' : value.status === 'insufficient' ? 'insufficient' : 'available',
    templateVersion, summary: { text: summary }, metrics: uniqueMetrics, strengths, risks, opportunities, recommendations, quality,
    assumptions, limitations, purchase,
  }
}
