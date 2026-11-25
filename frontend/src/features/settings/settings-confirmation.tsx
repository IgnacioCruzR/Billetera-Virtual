import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { mobileDrawer } from '@/features/micro-expenses/detection-settings'

export function ConfirmationDialog({ title, description, action, onClose, onConfirm }: {
  title: string; description: string; action: string; onClose: () => void; onConfirm: () => void;
}) {
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}><DialogContent className={mobileDrawer}>
    <DialogTitle className="pr-8 text-xl font-bold">{title}</DialogTitle>
    <DialogDescription className="mt-1 text-sm text-muted-foreground">{description}</DialogDescription>
    <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={onClose}>Volver</Button><Button className="bg-danger text-background hover:bg-red-400" onClick={onConfirm}>{action}</Button></div>
  </DialogContent></Dialog>
}
