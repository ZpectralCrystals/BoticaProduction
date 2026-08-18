import type { IncomingMessage, ServerResponse } from 'node:http'
import { buildApp } from '../backend-fastify/src/server.js'

let appPromise: ReturnType<typeof buildApp> | null = null

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  try {
    appPromise ??= buildApp()
    const app = await appPromise

    await new Promise<void>((resolve) => {
      response.once('finish', resolve)
      response.once('close', resolve)
      app.server.emit('request', request, response)
    })
  } catch (error) {
    console.error('API startup failed', error)
    if (!response.headersSent) {
      response.statusCode = 503
      response.setHeader('content-type', 'application/json; charset=utf-8')
      response.end(JSON.stringify({
        error: 'SERVICE_UNAVAILABLE',
        message: 'API no disponible. Revise configuración de producción.',
      }))
    }
  }
}
