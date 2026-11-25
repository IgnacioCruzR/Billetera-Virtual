import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo'
import { Module } from '@nestjs/common'

export const graphqlOptions = { driver: ApolloDriver, path: '/graphql' } satisfies Pick<ApolloDriverConfig, 'driver' | 'path'>
export const BFF_SETTINGS = Symbol('BFF_SETTINGS')

const grpcVariables = {
  usuarios: 'GRPC_USUARIOS_ADDRESS',
  transacciones: 'GRPC_TRANSACCIONES_ADDRESS',
  notificaciones: 'GRPC_NOTIFICACIONES_ADDRESS',
  agente: 'GRPC_AGENTE_ADDRESS',
} as const

function grpcAddress(env: NodeJS.ProcessEnv, key: string) {
  const address = env[key]?.trim() ?? ''
  const match = /^[a-z\d.-]+:([1-9]\d{0,4})$/i.exec(address)
  if (!match || Number(match[1]) > 65535) throw new Error(`${key} debe tener formato host:puerto`)
  return address
}

export function readBffSettings(env: NodeJS.ProcessEnv) {
  const input = env.BFF_PORT ?? '3000'
  const port = Number(input)
  if (!/^[1-9]\d{0,4}$/.test(input) || port > 65535) throw new Error('BFF_PORT debe ser un puerto válido')
  return {
    port,
    grpc: {
      usuarios: grpcAddress(env, grpcVariables.usuarios),
      transacciones: grpcAddress(env, grpcVariables.transacciones),
      notificaciones: grpcAddress(env, grpcVariables.notificaciones),
      agente: grpcAddress(env, grpcVariables.agente),
    },
  }
}

@Module({
  providers: [{ provide: BFF_SETTINGS, useFactory: () => readBffSettings(process.env) }],
  exports: [BFF_SETTINGS],
})
export class AppModule {}
