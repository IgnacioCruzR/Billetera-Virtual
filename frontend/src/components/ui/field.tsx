import { ChevronDown } from 'lucide-react'
import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const control = 'h-10 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground placeholder:text-muted-foreground/80 focus-visible:border-primary focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-primary disabled:opacity-55 aria-invalid:border-danger'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, className)} {...props} />
}

export function MoneyInput({ hidden, type = 'text', inputMode = 'numeric', ...props }: ComponentProps<'input'> & { hidden: boolean }) {
  return <Input {...props} type={hidden ? 'password' : type} inputMode={inputMode} autoComplete={hidden ? 'off' : props.autoComplete} />
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <span className="relative block min-w-0">
      <select className={cn(control, 'appearance-none pr-9', className)} {...props} />
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </span>
  )
}

type ErrorAttributes = { 'aria-invalid'?: true; 'aria-describedby'?: string }

export function Field({ label, error, children }: { label: string; error?: string; children: (id: string, attributes: ErrorAttributes) => ReactNode }) {
  const id = useId()
  return (
    <div className="grid min-w-0 gap-1.5">
      <label className="text-sm font-medium" htmlFor={id}>{label}</label>
      {children(id, error ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {})}
      {error && <p id={`${id}-error`} className="text-xs text-red-300" role="alert">{error}</p>}
    </div>
  )
}
