import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'

const CLERK_FRONTEND_API = 'https://frontend-api.clerk.dev'
const REQUEST_HEADERS_TO_DROP = new Set([
  'connection',
  'content-length',
  'host',
  'transfer-encoding',
  'clerk-proxy-url',
  'clerk-secret-key',
])
const RESPONSE_HEADERS_TO_DROP = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
])

export function extractClerkProxyPath(rawUrl: string | undefined) {
  const url = new URL(rawUrl ?? '/', 'http://internal')

  if (url.pathname === '/api/clerk-proxy') {
    const rewrittenPath = url.searchParams.get('clerk_path')
    if (!rewrittenPath) throw new Error('Ruta de proxy Clerk vacía')
    url.searchParams.delete('clerk_path')
    const query = url.searchParams.toString()
    return `/${rewrittenPath.replace(/^\/+/, '')}${query ? `?${query}` : ''}`
  }

  const prefixes = ['/api/clerk', '/__clerk']
  const prefix = prefixes.find((candidate) =>
    url.pathname === candidate || url.pathname.startsWith(`${candidate}/`),
  )

  if (!prefix) {
    throw new Error('Ruta de proxy Clerk inválida')
  }

  const pathname = url.pathname.slice(prefix.length) || '/'
  return `${pathname}${url.search}`
}

export function resolveClerkProxyUrl(authorizedParties: string | undefined) {
  const origin = authorizedParties
    ?.split(',')
    .map((value) => value.trim())
    .find(Boolean)
    ?.replace(/\/$/, '')

  if (!origin) {
    throw new Error('CLERK_AUTHORIZED_PARTIES es obligatoria para el proxy')
  }

  return `${origin}/__clerk`
}

export function buildClerkProxyHeaders(
  incoming: IncomingHttpHeaders,
  secretKey: string,
  proxyUrl: string,
  remoteAddress?: string,
) {
  const headers = new Headers()

  for (const [name, value] of Object.entries(incoming)) {
    if (REQUEST_HEADERS_TO_DROP.has(name.toLowerCase()) || value === undefined) continue
    headers.set(name, Array.isArray(value) ? value.join(', ') : value)
  }

  const forwardedFor = incoming['x-forwarded-for']
  const realIp = incoming['x-real-ip']
  const clientIp = Array.isArray(forwardedFor)
    ? forwardedFor.join(', ')
    : forwardedFor || (Array.isArray(realIp) ? realIp[0] : realIp) || remoteAddress

  if (!clientIp) {
    throw new Error('No se pudo determinar IP del cliente para Clerk')
  }

  headers.set('Clerk-Proxy-Url', proxyUrl)
  headers.set('Clerk-Secret-Key', secretKey)
  headers.set('X-Forwarded-For', clientIp)
  return headers
}

async function readRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined
}

export async function handleClerkProxy(
  request: IncomingMessage,
  response: ServerResponse,
) {
  try {
    const secretKey = process.env.CLERK_SECRET_KEY
    if (!secretKey) {
      throw new Error('CLERK_SECRET_KEY no configurada')
    }

    const proxyUrl = resolveClerkProxyUrl(process.env.CLERK_AUTHORIZED_PARTIES)
    const targetPath = extractClerkProxyPath(request.url)
    const targetUrl = new URL(targetPath, CLERK_FRONTEND_API)
    const method = request.method ?? 'GET'
    const body = method === 'GET' || method === 'HEAD'
      ? undefined
      : await readRequestBody(request)
    const headers = buildClerkProxyHeaders(
      request.headers,
      secretKey,
      proxyUrl,
      request.socket.remoteAddress,
    )

    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: 'manual',
    })

    response.statusCode = upstream.status
    response.statusMessage = upstream.statusText
    for (const [name, value] of upstream.headers.entries()) {
      if (name === 'set-cookie' || RESPONSE_HEADERS_TO_DROP.has(name)) continue
      response.setHeader(name, value)
    }

    const setCookies = upstream.headers.getSetCookie()
    if (setCookies.length > 0) response.setHeader('set-cookie', setCookies)

    const payload = Buffer.from(await upstream.arrayBuffer())
    response.setHeader('content-length', String(payload.length))
    response.end(payload)
  } catch (error) {
    console.error('Clerk proxy failed', error)
    if (!response.headersSent) {
      response.statusCode = 503
      response.setHeader('content-type', 'application/json; charset=utf-8')
      response.end(JSON.stringify({
        error: 'CLERK_PROXY_UNAVAILABLE',
        message: 'Autenticación por correo no disponible temporalmente.',
      }))
    }
  }
}
