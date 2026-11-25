export type DataMode = 'demo' | 'integration' | 'invalid'

export function resolveDataMode(value: string | undefined): DataMode {
  if (value === undefined || value === 'demo') return 'demo'
  return value === 'integration' ? 'integration' : 'invalid'
}
