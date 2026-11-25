import { Server } from '@grpc/grpc-js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

function grpcAddress(env: NodeJS.ProcessEnv, key: string) {
  const address = env[key]?.trim() ?? ''
  const match = /^[a-z\d.-]+:([1-9]\d{0,4})$/i.exec(address)
  if (!match || Number(match[1]) > 65535) throw new Error(`${key} debe tener formato host:puerto`)
  return address
}

export function readAgentSettings(env: NodeJS.ProcessEnv) {
  const raw = env.GRPC_PORT ?? '50054'
  const grpcPort = Number(raw)
  if (!/^[1-9]\d{0,4}$/.test(raw) || grpcPort > 65535) throw new Error('GRPC_PORT debe ser un puerto válido')

  const baseUrl = env.LLM_BASE_URL?.trim()
  if (baseUrl) {
    const url = URL.parse(baseUrl)
    if (!url || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
      throw new Error('LLM_BASE_URL debe ser una URL HTTPS sin credenciales, consulta ni fragmento')
    }
  }

  return {
    grpcPort,
    usuariosAddress: grpcAddress(env, 'GRPC_USUARIOS_ADDRESS'),
    transaccionesAddress: grpcAddress(env, 'GRPC_TRANSACCIONES_ADDRESS'),
    llm: { baseUrl, model: env.LLM_MODEL?.trim(), apiKey: env.LLM_API_KEY },
  }
}

export function createAgentTransports() {
  return {
    grpc: new Server(),
    mcp: new McpServer({ name: 'ms-agente-mcp', version: '0.1.0' }),
  }
}

if (require.main === module) {
  try {
    readAgentSettings(process.env)
    console.log('Configuración del Agente MCP válida')
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Configuración del Agente MCP inválida')
    process.exitCode = 1
  }
}
