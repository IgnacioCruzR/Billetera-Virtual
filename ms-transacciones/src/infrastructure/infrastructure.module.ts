import { Module } from '@nestjs/common'
import type { KafkaConfig } from 'kafkajs'
import type { PoolConfig } from 'pg'

export const TRANSACTION_SETTINGS = Symbol('TRANSACTION_SETTINGS')

function required(env: NodeJS.ProcessEnv, key: string) {
  const value = env[key]
  if (!value?.trim()) throw new Error(`Falta ${key}`)
  return value
}

function port(raw: string, key: string) {
  const value = Number(raw)
  if (!/^[1-9]\d{0,4}$/.test(raw) || value > 65535) throw new Error(`${key} debe ser un puerto válido`)
  return value
}

function readSettings(env: NodeJS.ProcessEnv) {
  return {
    grpcPort: port(env.GRPC_PORT ?? '50052', 'GRPC_PORT'),
    usuariosAddress: required(env, 'GRPC_USUARIOS_ADDRESS'),
    postgres: {
      host: required(env, 'POSTGRES_HOST'),
      port: port(env.POSTGRES_PORT ?? '5432', 'POSTGRES_PORT'),
      database: required(env, 'POSTGRES_DB'),
      user: required(env, 'POSTGRES_USER'),
      password: required(env, 'POSTGRES_PASSWORD'),
    } satisfies PoolConfig,
    kafka: {
      clientId: 'ms-transacciones',
      brokers: required(env, 'KAFKA_BROKERS').split(',').map(broker => broker.trim()),
    } satisfies KafkaConfig,
  }
}

@Module({
  providers: [{ provide: TRANSACTION_SETTINGS, useFactory: () => readSettings(process.env) }],
  exports: [TRANSACTION_SETTINGS],
})
export class InfrastructureModule {}
