import { describe, expect, it } from 'vitest'
import { resolveEmailAccessState } from './email-auth-callback-page'

const baseState = {
  clerkEnabled: true,
  clerkLoaded: true,
  clerkSignedIn: true,
  error: null,
  loading: false,
  userAuthenticated: false,
}

describe('resolveEmailAccessState', () => {
  it('redirige cuando ERP ya creó sesión', () => {
    expect(resolveEmailAccessState({ ...baseState, userAuthenticated: true })).toBe('authenticated')
  })

  it('espera mientras carga identidad o sesión ERP', () => {
    expect(resolveEmailAccessState({ ...baseState, clerkLoaded: false })).toBe('loading')
    expect(resolveEmailAccessState({ ...baseState, loading: true })).toBe('loading')
  })

  it('distingue proveedor deshabilitado, sesión ausente y vínculo denegado', () => {
    expect(resolveEmailAccessState({ ...baseState, clerkEnabled: false })).toBe('disabled')
    expect(resolveEmailAccessState({ ...baseState, clerkSignedIn: false })).toBe('signed-out')
    expect(resolveEmailAccessState({ ...baseState, error: 'Usuario no vinculado' })).toBe('denied')
  })
})
