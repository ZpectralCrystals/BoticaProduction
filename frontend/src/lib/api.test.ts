import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClerkSync, apiUnlinkUsuarioClerk, apiUpdateUsuarioClerkEmail } from './api'

describe('API request headers', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn(() => 'erp-token'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not declare JSON for a DELETE request without body', async () => {
    await apiUnlinkUsuarioClerk('1')

    const [, options] = vi.mocked(fetch).mock.calls[0]
    const headers = new Headers(options?.headers)
    expect(options?.method).toBe('DELETE')
    expect(headers.get('Content-Type')).toBeNull()
    expect(headers.get('Authorization')).toBe('Bearer erp-token')
  })

  it('declares JSON when a request contains a JSON body', async () => {
    await apiUpdateUsuarioClerkEmail('1', 'admin@example.com')

    const [, options] = vi.mocked(fetch).mock.calls[0]
    const headers = new Headers(options?.headers)
    expect(options?.method).toBe('PUT')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('Authorization')).toBe('Bearer erp-token')
  })

  it('preserves the explicit Clerk authorization token', async () => {
    await apiClerkSync('clerk-token')

    const [, options] = vi.mocked(fetch).mock.calls[0]
    const headers = new Headers(options?.headers)
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('Authorization')).toBe('Bearer clerk-token')
  })
})
