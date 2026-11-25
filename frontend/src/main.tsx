import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/manrope'
import './index.css'
import { resolveDataMode } from './app/data-mode'

const mode = resolveDataMode(import.meta.env.VITE_DATA_MODE)
const Application = mode === 'integration'
  ? lazy(() => import('./app/integration-root'))
  : lazy(() => import('./features/settings/session-root'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {mode === 'invalid'
      ? <main className="p-6"><h1 className="text-xl font-bold">Modo de datos inválido</h1><p className="mt-1 text-sm text-muted-foreground">Configura el modo como demo o integration.</p></main>
      : <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Cargando Billetera Virtual…</p>}><Application /></Suspense>}
  </StrictMode>,
)
