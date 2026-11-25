import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function checkConfiguration() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false, abortOnError: false })
  await app.close()
  console.log('Configuración del BFF válida')
}

void checkConfiguration().catch(error => {
  console.error(error instanceof Error ? error.message : 'Configuración del BFF inválida')
  process.exitCode = 1
})
