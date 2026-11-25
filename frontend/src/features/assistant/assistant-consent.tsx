import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { FinancialAnalysisConsent } from './assistant-model'

export const assistantDrawer = 'max-w-xl max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[94dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-0 max-sm:rounded-b-none'

export function ConsentOptions({ preference, onChoose }: { preference: FinancialAnalysisConsent['preference']; onChoose: (value: 'allowed' | 'declined') => void }) {
  return <div className="mt-4 space-y-3 text-sm">
    <p>En una integración externa, el proveedor de IA podría procesar la parte de tus datos financieros que sea necesaria para interpretar este análisis.</p>
    <p className="text-muted-foreground">En esta demo la autorización se guarda en esta sesión y el informe se calcula localmente. Ocultar montos solo cambia su visualización. La autorización permite procesar el análisis y el registro de operaciones requiere tu confirmación por separado.</p>
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => onChoose('allowed')} aria-pressed={preference === 'allowed'}><ShieldCheck aria-hidden="true" /> Autorizar en esta sesión</Button>
      {preference !== 'revoked' && <Button variant="outline" onClick={() => onChoose('declined')} aria-pressed={preference === 'declined'}>Continuar solo con demo</Button>}
    </div>
  </div>
}

export function AssistantPreferences({ consent, onChoose, onClose }: {
  consent: FinancialAnalysisConsent; onChoose: (value: 'allowed' | 'declined') => void; onClose: () => void;
}) {
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}><DialogContent className={assistantDrawer}>
    <DialogTitle className="pr-8 text-xl font-bold">Autorización de IA externa</DialogTitle>
    <DialogDescription className="mt-1 text-sm text-muted-foreground">Preferencia de esta sesión.</DialogDescription>
    <ConsentOptions preference={consent.preference} onChoose={onChoose} />
  </DialogContent></Dialog>
}
