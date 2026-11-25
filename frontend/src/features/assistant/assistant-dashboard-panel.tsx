import { ArrowUpRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { analysisCatalog, type FinancialAnalysisHistoryItem } from './assistant-model'
import { generatedLabel, privateText, reportHref, sourceLabel } from './assistant-result-labels'

export function DashboardAnalysis({ item, timeZone, hidden, stale }: { item?: FinancialAnalysisHistoryItem; timeZone: string; hidden: boolean; stale: boolean }) {
  const report = item?.result
  return <section aria-label="Último análisis del asistente" className="panel min-w-0 bg-linear-to-br from-card to-[#163039] p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5"><Sparkles className="size-5 shrink-0 text-emerald-300" aria-hidden="true" /><h2 className="panel-heading">Análisis inteligente</h2></div>
      <Button asChild variant="outline" size="sm"><a href="#asistente">Solicitar nuevo análisis</a></Button>
    </div>
    {report ? <div className="mt-3">
      <p className="text-sm font-semibold">{analysisCatalog[report.type].title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sourceLabel(report)} · {generatedLabel(report.generatedAt, timeZone)}{stale && ' · Datos anteriores'}</p>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed wrap-anywhere">{hidden && report.origin === 'ai' ? privateText : report.summary.text}</p>
      {report.recommendations.length > 0 && (!hidden || report.origin === 'demo') && <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
        {report.recommendations.slice(0, 2).map((item, index) => <li className="wrap-anywhere" key={index}>{item.title}</li>)}
      </ul>}
      <a href={reportHref(report.requestId)} className="mt-2 inline-flex gap-1 text-sm font-semibold text-emerald-200 hover:underline">Abrir informe completo <ArrowUpRight className="size-4" aria-hidden="true" /></a>
    </div> : <p className="mt-2 text-sm text-muted-foreground">Solicita un análisis para consultar sus indicadores y recomendaciones aquí.</p>}
  </section>
}
