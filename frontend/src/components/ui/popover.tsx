import * as PopoverPrimitive from '@radix-ui/react-popover'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverClose = PopoverPrimitive.Close

export function PopoverContent({ className, sideOffset = 12, ...props }: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn('z-40 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-card p-4 text-foreground shadow-xl', className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
