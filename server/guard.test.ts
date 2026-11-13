import { describe, expect, it } from 'vitest'
import { allow, guard, Rejected } from './guard.js'

const request = (headers: Record<string, string>) =>
  new Request('https://app.example/api/chat', { headers })

describe('guard', () => {
  it('пропускает запрос со своей страницы', () => {
    expect(() =>
      guard(request({ origin: 'https://app.example', host: 'app.example' })),
    ).not.toThrow()
  })

  it('отклоняет запрос с чужого сайта', () => {
    expect(() => guard(request({ origin: 'https://evil.example', host: 'app.example' }))).toThrow(
      Rejected,
    )
  })
})

describe('allow', () => {
  it('останавливает поток запросов с одного адреса и отпускает после паузы', () => {
    const start = 1_000_000
    for (let i = 0; i < 40; i++) expect(allow('1.1.1.1', start + i)).toBe(true)
    expect(allow('1.1.1.1', start + 50)).toBe(false)
    expect(allow('2.2.2.2', start + 50)).toBe(true)
    expect(allow('1.1.1.1', start + 6 * 60_000)).toBe(true)
  })
})
