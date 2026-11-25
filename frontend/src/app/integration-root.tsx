import { useState } from 'react'
import { ApolloProvider } from '@apollo/client/react'
import { createBffClient } from './bff-client'

export default function IntegrationRoot() {
  const [client] = useState(createBffClient)
  return <ApolloProvider client={client}>
    <main className="grid min-h-svh place-items-center px-4 py-8" aria-labelledby="integration-title">
      <section className="panel w-full max-w-md p-5 sm:p-6">
        <h1 id="integration-title" className="text-xl font-extrabold">Modo integración</h1>
        <p className="mt-2 text-sm text-muted-foreground">El acceso espera los contratos GraphQL y la autenticación del BFF.</p>
      </section>
    </main>
  </ApolloProvider>
}
