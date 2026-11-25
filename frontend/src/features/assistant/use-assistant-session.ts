import { useEffect, useState } from 'react'
import { mayGenerateAnalysis, type AnalysisFailureCode, type FinancialAnalysisConsent, type FinancialAnalysisHistoryItem, type FinancialAnalysisRequest } from './assistant-model'
import { AnalysisFailure, createRequestGate, requestAnalysis, type AssistantProvider } from './assistant-provider'

type Run =
  | { status: 'idle' }
  | { status: 'processing' | 'finished'; request: FinancialAnalysisRequest }
  | { status: 'error'; request: FinancialAnalysisRequest; code: AnalysisFailureCode }

export function useAssistantSession(provider: AssistantProvider, contextVersion: symbol, enabled = true) {
  const [history, setHistory] = useState<FinancialAnalysisHistoryItem[]>([])
  const [consent, setConsent] = useState<FinancialAnalysisConsent>({ preference: 'unset' })
  const [run, setRun] = useState<Run>({ status: 'idle' })
  const [gate] = useState(createRequestGate)

  useEffect(() => () => { gate.cancel() }, [gate])
  useEffect(() => {
    if (!enabled && run.status === 'processing' && gate.cancel()) setRun({ status: 'error', request: run.request, code: 'cancelled' })
  }, [enabled, gate, run])

  function setPreference(preference: FinancialAnalysisConsent['preference']) {
    if (consent.preference === 'revoked' && preference === 'declined') return
    setConsent({ preference, updatedOn: new Date().toISOString() })
    if (!mayGenerateAnalysis(enabled, preference, provider.origin) && run.status === 'processing' && gate.cancel()) {
      setRun({ status: 'error', request: run.request, code: 'consent' })
    }
  }

  function generate(request: FinancialAnalysisRequest, preference = consent.preference) {
    if (consent.preference === 'revoked' || !mayGenerateAnalysis(enabled, preference, provider.origin)) {
      setRun({ status: 'error', request, code: 'consent' })
      return
    }
    const ticket = gate.start()
    if (!ticket) return
    setRun({ status: 'processing', request })
    void requestAnalysis(provider, request, ticket.signal).then(result => {
      if (!gate.finish(ticket)) return
      setHistory(items => [{ request, result, contextVersion }, ...items.filter(item => item.request.requestId !== request.requestId)].slice(0, 20))
      setRun({ status: 'finished', request })
    }, error => {
      if (!gate.finish(ticket)) return
      setRun({ status: 'error', request, code: error instanceof AnalysisFailure ? error.code : 'communication' })
    })
  }

  function cancel() {
    if (run.status === 'processing' && gate.cancel()) setRun({ status: 'error', request: run.request, code: 'cancelled' })
  }

  function clearHistory() {
    gate.cancel()
    setHistory([])
    setRun({ status: 'idle' })
  }

  return { history, contextVersion, consent, setPreference, run, generate, cancel, clearHistory, enabled,
    blocked: !mayGenerateAnalysis(enabled, consent.preference, provider.origin) && (consent.preference === 'revoked' || !enabled) }
}
export type AssistantSession = ReturnType<typeof useAssistantSession>
