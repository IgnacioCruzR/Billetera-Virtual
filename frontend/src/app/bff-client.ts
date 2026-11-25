import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client'

export const bffPath = '/graphql'

export function createBffClient() {
  return new ApolloClient({
    link: new HttpLink({
      uri: bffPath,
      credentials: 'same-origin',
      fetchOptions: { redirect: 'error' },
    }),
    cache: new InMemoryCache(),
  })
}

export async function closeBffSession(client: ApolloClient) {
  client.stop()
  await client.clearStore()
}
