import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIMITS } from '../../core/protocol'
import type { Card } from '../../core/types'
import { askMentor } from './api'

const personal = vi.hoisted(() => ({ cards: [] as Card[] }))
vi.mock('./mine', () => ({ getMine: () => personal.cards.map((card) => ({ card })) }))
vi.mock('./profile', () => ({ getProfile: () => null }))

const request = { mode: 'ask' as const, turns: [{ role: 'user' as const, content: 'Вопрос?' }] }
const line = (event: unknown) => `${JSON.stringify(event)}\n`
const response = (body: string) =>
  new Response(body, { headers: { 'content-type': 'application/x-ndjson' } })

beforeEach(() => {
  personal.cards = []
})
afterEach(() => vi.unstubAllGlobals())

describe('поток ответа наставника', () => {
  it('читает разбитые сетевые куски и последнюю строку без перевода строки', async () => {
    const encoder = new TextEncoder()
    const body =
      line({ type: 'text', value: 'Привет, ' }) + JSON.stringify({ type: 'text', value: 'мир.' })
    const stream = new ReadableStream({
      start(controller) {
        const bytes = encoder.encode(body)
        for (let offset = 0; offset < bytes.length; offset += 7)
          controller.enqueue(bytes.slice(offset, offset + 7))
        controller.close()
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream)))
    const onText = vi.fn()
    await expect(askMentor(request, { onText })).resolves.toBe('Привет, мир.')
    expect(onText.mock.calls).toEqual([['Привет, '], ['Привет, мир.']])
  })

  it('передаёт ошибку после частичного ответа и отменяет оставшийся поток', async () => {
    const cancel = vi.fn()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            line({ type: 'text', value: 'Начало.' }) +
              line({ type: 'error', message: 'Связь оборвалась.' }),
          ),
        )
      },
      cancel,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream)))
    await expect(askMentor(request, { onText: vi.fn() })).rejects.toThrow('Связь оборвалась.')
    await vi.waitFor(() => expect(cancel).toHaveBeenCalled())
  })

  it('не начинает запрос, который уже отменён', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    controller.abort()
    await expect(
      askMentor(request, { onText: vi.fn(), signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('снимает обработчик отмены после завершения запроса', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response(line({ type: 'text', value: 'Ответ.' }))),
    )
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    await askMentor(request, { onText: vi.fn(), signal: controller.signal })
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
  })

  it('отправляет только допустимое число последних сохранённых источников', async () => {
    personal.cards = Array.from(
      { length: LIMITS.mineCards + 20 },
      (_, index) => ({ id: `web-${index}` }) as Card,
    )
    const fetch = vi.fn().mockResolvedValue(response(line({ type: 'text', value: 'Ответ.' })))
    vi.stubGlobal('fetch', fetch)
    await askMentor(request, { onText: vi.fn() })
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.mine).toEqual(personal.cards.slice(0, LIMITS.mineCards))
  })

  it('длинная история и полная база не превышают бюджет запроса с кириллицей', async () => {
    const card: Card = {
      id: 'web-0123456789',
      scenario: 'job',
      zone: 'web',
      kind: 'web',
      title: 'а'.repeat(120),
      text: 'а'.repeat(500),
      source: {
        title: 'а'.repeat(120),
        publisher: 'а'.repeat(80),
        url: `https://example.org/${'a'.repeat(480)}`,
        quote: 'а'.repeat(400),
        year: 2026,
      },
    }
    personal.cards = Array.from({ length: LIMITS.mineCards }, () => card)
    const turns = Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 ? ('assistant' as const) : ('user' as const),
      content: 'а'.repeat(index % 2 ? 6000 : LIMITS.messageChars),
    }))
    turns.push({ role: 'user', content: 'а'.repeat(LIMITS.messageChars) })
    const fetch = vi.fn().mockResolvedValue(response(line({ type: 'text', value: 'Ответ.' })))
    vi.stubGlobal('fetch', fetch)
    expect(JSON.stringify({ ...request, turns, mine: personal.cards }).length).toBeGreaterThan(
      LIMITS.bodyBytes,
    )
    await askMentor({ ...request, turns }, { onText: vi.fn() })
    const sent = String(fetch.mock.calls[0][1].body)
    const body = JSON.parse(sent)
    expect(new TextEncoder().encode(sent).byteLength).toBeLessThanOrEqual(LIMITS.bodyBytes)
    expect(body.mine.length).toBeGreaterThan(0)
    expect(body.mine.length).toBeLessThan(LIMITS.mineCards)
    expect(body.turns.at(-1)).toEqual(turns.at(-1))
    expect(body.turns[1].content).toHaveLength(LIMITS.messageChars)
    expect(turns[1].content).toHaveLength(6000)
  })

  it('показывает понятную ошибку для испорченного и пустого потока', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response('not json\n'))
      .mockResolvedValueOnce(response(line({ type: 'cards', ids: [] })))
    vi.stubGlobal('fetch', fetch)
    for (let index = 0; index < 2; index++)
      await expect(askMentor(request, { onText: vi.fn() })).rejects.toThrow(
        'Не получилось связаться с Черновиком.',
      )
  })
})
