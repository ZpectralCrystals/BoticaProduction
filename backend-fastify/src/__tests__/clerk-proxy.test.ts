import { describe, expect, it } from 'vitest'
import {
  buildClerkProxyHeaders,
  extractClerkProxyPath,
  resolveClerkProxyUrl,
  serializeFormBody,
  stripProxyBodyFields,
} from '../lib/clerk-proxy-handler.js'

describe('proxy Clerk', () => {
  it('conserva ruta y query al reenviar desde Vercel', () => {
    expect(extractClerkProxyPath('/api/clerk/npm/package.js?v=1')).toBe('/npm/package.js?v=1')
    expect(extractClerkProxyPath('/__clerk/v1/client')).toBe('/v1/client')
    expect(
      extractClerkProxyPath('/api/clerk-proxy?clerk_path=npm/package.js&v=1'),
    ).toBe('/npm/package.js?v=1')
  })

  it('deriva URL pública desde authorized parties', () => {
    expect(resolveClerkProxyUrl('https://botica-production.vercel.app/')).toBe(
      'https://botica-production.vercel.app/__clerk',
    )
  })

  it('protege headers internos y conserva IP original', () => {
    const headers = buildClerkProxyHeaders(
      {
        host: 'botica-production.vercel.app',
        'x-forwarded-for': '203.0.113.8, 10.0.0.1',
        'clerk-secret-key': 'inyectada-por-cliente',
      },
      'secreto-servidor',
      'https://botica-production.vercel.app/__clerk',
    )

    expect(headers.get('host')).toBeNull()
    expect(headers.get('clerk-secret-key')).toBe('secreto-servidor')
    expect(headers.get('clerk-proxy-url')).toBe('https://botica-production.vercel.app/__clerk')
    expect(headers.get('x-forwarded-for')).toBe('203.0.113.8, 10.0.0.1')
  })

  it('serializa cuerpos parseados por Vercel para Clerk', () => {
    expect(serializeFormBody({
      identifier: 'admin@botica.pe',
      strategy: 'password',
      clerk_path: 'v1/client/sign_ins',
      path: 'v1/client/sign_ins',
      optional: null,
    })).toBe('identifier=admin%40botica.pe&strategy=password')

    expect(stripProxyBodyFields({ identifier: 'admin@botica.pe', path: 'interno' })).toEqual({
      identifier: 'admin@botica.pe',
    })
  })
})
