import { useEffect, useRef, useState } from 'react'
import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setRegionalFormats } from '@/lib/utils'
import { Dashboard } from '@/features/dashboard/dashboard'
import { refreshFinancialDate } from '@/features/dashboard/mock-data'
import { createDemoSources } from '@/app/demo-sources'
import { defaultPreferences, type SecuritySettings } from './preferences-model'

const openDemo = () => ({
  security: { provider: 'demo', signedInAt: new Date().toISOString() } satisfies SecuritySettings,
  sources: createDemoSources(),
})
const signedOutKey = 'billetera-demo-signed-out'

function initialDemo() {
  try { if (window.sessionStorage.getItem(signedOutKey) === 'true') return null } catch { /* sesión en memoria */ }
  return openDemo()
}

export default function SessionRoot() {
  const [session, setSession] = useState(initialDemo)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { if (!session) heading.current?.focus() }, [session])
  function signOut() {
    const region = defaultPreferences.regional
    setRegionalFormats(region.money, region.dates)
    refreshFinancialDate(region.timeZone)
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    document.title = 'Inicio de sesión · Billetera Virtual'
    try { window.sessionStorage.setItem(signedOutKey, 'true') } catch { /* sesión en memoria */ }
    setSession(null)
  }
  return session ? <Dashboard session={session.security} sources={session.sources} onLogout={signOut} /> : <main className="grid min-h-svh place-items-center px-4 py-8" aria-labelledby="sign-in-title">
    <section className="panel w-full max-w-sm space-y-4 p-5 sm:p-6">
      <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground"><Wallet aria-hidden="true" className="size-5" /></span>
      <div><h1 id="sign-in-title" ref={heading} tabIndex={-1} className="text-2xl font-extrabold outline-none">Inicio de sesión</h1><p className="mt-1 text-sm text-muted-foreground">Sesión de demostración finalizada.</p></div>
      <p className="text-sm text-muted-foreground">Puedes iniciar una sesión local nueva con los datos iniciales.</p>
      <Button className="w-full" onClick={() => {
        try { window.sessionStorage.removeItem(signedOutKey) } catch { /* sesión en memoria */ }
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        setSession(openDemo())
      }}>Entrar a la demostración</Button>
    </section>
  </main>
}
