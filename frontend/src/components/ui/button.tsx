import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*=size-])]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-emerald-400',
        outline: 'border border-border bg-secondary/70 text-foreground hover:bg-accent',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
        muted: 'bg-primary/10 text-emerald-300 hover:bg-primary/20',
      },
      size: { default: 'h-10 px-3.5', sm: 'h-8 px-2.5 text-xs', icon: 'size-10' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export function Button({ className, variant, size, asChild = false, type, ...props }:
  ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button'
  return <Component type={asChild ? undefined : type ?? 'button'} className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
