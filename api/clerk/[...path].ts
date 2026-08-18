import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleClerkProxy } from '../../backend-fastify/src/lib/clerk-proxy-handler.js'

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  await handleClerkProxy(request, response)
}
