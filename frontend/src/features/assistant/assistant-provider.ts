import type { AnalysisContext, AnalysisFailureCode, FinancialAnalysisRequest, FinancialAnalysisResult } from './assistant-model.ts'

export interface AssistantProvider {
  origin: FinancialAnalysisResult['origin']
  generate(request: FinancialAnalysisRequest, signal: AbortSignal): Promise<unknown>
}

export class AnalysisFailure extends Error {
  readonly code: AnalysisFailureCode

  constructor(code: AnalysisFailureCode) {
    super(code)
    this.code = code
  }
}

function pause(delay: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new AnalysisFailure('cancelled'))
    const cancel = () => { clearTimeout(timer); reject(new AnalysisFailure('cancelled')) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve() }, delay)
    signal.addEventListener('abort', cancel, { once: true })
  })
}

export function createDemoAnalysisProvider(context: AnalysisContext, available: boolean, delay = 450): AssistantProvider {
  return {
    origin: 'demo',
    async generate(request, signal) {
      await pause(delay, signal)
      if (!available) throw new AnalysisFailure('communication')
      const [{ matchesRequestResources }, { buildDemoAnalysis }] = await Promise.all([
        import('./assistant-request.ts'), import('./assistant-analysis.ts'),
      ])
      if (signal.aborted) throw new AnalysisFailure('cancelled')
      if (!matchesRequestResources(request, context)) throw new AnalysisFailure('invalid')
      return buildDemoAnalysis(request, context, new Date().toISOString())
    },
  }
}

export async function requestAnalysis(provider: AssistantProvider, request: FinancialAnalysisRequest, signal: AbortSignal, deadline = 15_000) {
  if (signal.aborted) throw new AnalysisFailure('cancelled')
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout>
  let abort: () => void = () => undefined
  const stop = new Promise<never>((_resolve, reject) => {
    abort = () => { reject(new AnalysisFailure('cancelled')); controller.abort() }
    signal.addEventListener('abort', abort, { once: true })
    timer = setTimeout(() => { reject(new AnalysisFailure('timeout')); controller.abort() }, deadline)
  })
  try {
    const [raw, { normalizeAnalysis }] = await Promise.race([stop, Promise.all([
      provider.generate(request, controller.signal), import('./assistant-response.ts'),
    ])])
    const report = normalizeAnalysis(raw, request, provider.origin)
    if (!report) throw new AnalysisFailure('invalid')
    return report
  } catch (error) {
    throw error instanceof AnalysisFailure ? error : new AnalysisFailure('communication')
  } finally {
    clearTimeout(timer!)
    signal.removeEventListener('abort', abort)
  }
}

export function createRequestGate() {
  let active: AbortController | null = null
  return {
    start() {
      if (active) return null
      active = new AbortController()
      return active
    },
    finish(ticket: AbortController) {
      if (ticket !== active) return false
      active = null
      return true
    },
    cancel() {
      const ticket = active
      active = null
      ticket?.abort()
      return Boolean(ticket)
    },
  }
}
