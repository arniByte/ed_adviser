import { describe, expect, it } from 'vitest'
import { plural } from './plural'

describe('plural', () => {
  const forms: [string, string, string] = ['цитата', 'цитаты', 'цитат']
  it.each([
    [1, 'цитата'],
    [3, 'цитаты'],
    [5, 'цитат'],
    [11, 'цитат'],
    [12, 'цитат'],
    [21, 'цитата'],
    [44, 'цитаты'],
    [111, 'цитат'],
  ])('%i → %s', (n, word) => {
    expect(plural(n, forms)).toBe(word)
  })
})
