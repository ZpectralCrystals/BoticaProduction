import { describe, expect, it } from 'vitest'
import { normalizeSearchText } from '../lib/text.js'

describe('normalizeSearchText', () => {
  it('ignora tildes y mayúsculas', () => {
    expect(normalizeSearchText('  ÁCIDO FÓLICO  ')).toBe('acido folico')
  })

  it('normaliza diéresis y eñe', () => {
    expect(normalizeSearchText('Pingüino Ñandú')).toBe('pinguino nandu')
  })
})
