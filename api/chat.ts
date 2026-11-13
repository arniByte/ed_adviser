import type { Card } from '../core/types.js'
import { LIMITS, type MentorRequest, type StreamEvent } from '../core/protocol.js'
import { allowWebSearch } from '../server/guard.js'
import { errorResponse, readJson } from '../server/http.js'
import { planAsk, prepare, prepareAsk, type Prepared } from '../server/mentor.js'
import { streamChat } from '../server/openrouter.js'
import { findOnWeb, needsWeb } from '../server/web.js'

const HEADERS = {
  'content-type': 'application/x-ndjson; charset=utf-8',
  'cache-control': 'no-store',
  'x-accel-buffering': 'no',
}

const encoder = new TextEncoder()
const line = (event: StreamEvent) => encoder.encode(`${JSON.stringify(event)}\n`)

type Send = (event: StreamEvent) => void

/** Отдаёт ответ модели в поток: сначала список карточек, потом текст по кускам. */
async function answer(prepared: Prepared, send: Send) {
  send({ type: 'cards', ids: prepared.cards.map((card) => card.id) })
  for await (const value of streamChat(prepared)) send({ type: 'text', value })
}

function respond(start: (send: Send) => Promise<void>): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: Send = (event) => controller.enqueue(line(event))
      try {
        await start(send)
      } catch (error) {
        console.error(error)
        send({ type: 'error', message: 'Связь оборвалась. Попробуй ещё раз.' })
      }
      controller.close()
    },
  })
  return new Response(stream, { headers: HEADERS })
}

/** Отвечает потоком событий, по одному JSON в строке. */
async function handle(request: Request): Promise<Response> {
  try {
    const body = await readJson<MentorRequest>(request, LIMITS.bodyBytes)
    const plan = body?.mode === 'ask' ? planAsk(body) : null
    let web = plan?.web === true && allowWebSearch(request)

    if (!web) {
      const prepared = plan ? prepareAsk(plan) : prepare(body)
      const chunks = streamChat(prepared)
      const pending = chunks.next()
      // Пока модель начинает отвечать, маленькая модель решает, нужен ли интернет.
      const wanted = plan ? await needsWeb(plan.question).catch(() => false) : false
      if (wanted && allowWebSearch(request)) {
        pending.catch(() => {})
        void chunks.return(undefined).catch(() => {})
        web = true
      } else {
        // Первый кусок ждём до отправки заголовков: так сбой модели успевает стать обычной ошибкой.
        const first = await pending
        return respond(async (send) => {
          send({ type: 'cards', ids: prepared.cards.map((card) => card.id) })
          if (!first.done) {
            send({ type: 'text', value: first.value })
            for await (const value of chunks) send({ type: 'text', value })
          }
        })
      }
    }

    // С поиском по интернету поток открывается сразу: пользователь видит, что происходит.
    return respond(async (send) => {
      send({ type: 'status', value: 'Ищу в интернете' })
      let found: Card[] = []
      try {
        const result = await findOnWeb(plan!.question, plan!, (value) =>
          send({ type: 'status', value }),
        )
        found = result.cards
        send({ type: 'found', cards: result.cards, checks: result.checks, looked: result.looked })
      } catch (error) {
        // Поиск не обязателен: без него наставник ответит по базе.
        console.error(error)
      }
      send({ type: 'status', value: 'Пишу ответ' })
      await answer(prepareAsk(plan!, found), send)
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export default { fetch: handle }
