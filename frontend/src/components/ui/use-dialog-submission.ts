import { useRef, useState } from 'react'

export function useDialogSubmission(onClose: () => void) {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return {
    busy, error,
    async run(action: () => Promise<void>) {
      if (lock.current) return
      lock.current = true
      setBusy(true)
      setError('')
      try { await action(); onClose() }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'La operación falló. Intenta nuevamente.') }
      finally { lock.current = false; setBusy(false) }
    },
    close() { if (!lock.current) onClose() },
  }
}
