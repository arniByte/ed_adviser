import { afterEach, expect, it, vi } from 'vitest'
import api from './chat.js'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it('обрабатывает ранний сбой наставника, пока маршрутизатор ещё отвечает', async () => {
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  let finishRouter!: (response: Response) => void
  const router = new Promise<Response>((resolve) => {
    finishRouter = resolve
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body))
      if (body.stream) throw new Error('Наставник недоступен')
      return router
    }),
  )
  const response = api.fetch(
    new Request('https://app.example/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': 'chat-test' },
      body: JSON.stringify({
        mode: 'ask',
        turns: [{ role: 'user', content: 'Что писать в резюме без опыта?' }],
      }),
    }),
  )

  // Даём раннему отклонению пройти цикл событий до завершения маршрутизатора.
  await new Promise((resolve) => setTimeout(resolve, 10))
  finishRouter(new Response(JSON.stringify({ choices: [{ message: { content: 'no' } }] })))
  const result = await response
  expect(result.status).toBe(502)
  await expect(result.json()).resolves.toEqual({
    error: 'Не получилось связаться с Черновиком. Попробуй ещё раз.',
  })
})
