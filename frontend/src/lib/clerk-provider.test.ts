import { describe, expect, it } from 'vitest'
import { resolveClerkProxyUrl } from './clerk-provider'

describe('resolveClerkProxyUrl', () => {
  it('usa el proxy configurado por Clerk para producción', () => {
    expect(resolveClerkProxyUrl('pk_live_example')).toBe('/__clerk')
  })

  it('conserva el endpoint directo durante desarrollo', () => {
    expect(resolveClerkProxyUrl('pk_test_example')).toBeUndefined()
    expect(resolveClerkProxyUrl(undefined)).toBeUndefined()
  })
})
