import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'

export const Dialog = DialogPrimitive.Root
export const DialogTitle = DialogPrimitive.Title
export const DialogDescription = DialogPrimitive.Description
export const DialogTrigger = DialogPrimitive.Trigger

export function DialogContent({ className, children, closeDisabled, ...props }:
  ComponentProps<typeof DialogPrimitive.Content> & { closeDisabled?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#060b14]/75 backdrop-blur-xs" />
      <DialogPrimitive.Content
        className={cn('fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-1/2 overflow-auto rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl sm:p-6', className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close asChild>
          <Button size="icon" variant="ghost" className="absolute top-3 right-3 size-8" aria-label="Cerrar" disabled={closeDisabled}>
            <X />
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
