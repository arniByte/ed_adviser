import { LIMITS, type MentorRequest, type StreamEvent } from '../core/protocol'
import { errorResponse, readJson } from '../server/http'
import { prepare } from '../server/mentor'
import { streamChat } from '../server/openrouter'

export const config = { runtime: 'edge' }

/** Отвечает потоком событий, по одному JSON в строке. */
export default async function handler(request: Request): Promise<Response> {
  try {
    const body = await readJson<MentorRequest>(request, LIMITS.bodyBytes)
    const { cards, messages, maxTokens, temperature } = prepare(body)
    const chunks = streamChat({ messages, maxTokens, temperature })
    // Первый кусок ждём до отправки заголовков: так сбой модели успевает стать обычной ошибкой.
    const first = await chunks.next()

    const encoder = new TextEncoder()
    const line = (event: StreamEvent) => encoder.encode(`${JSON.stringify(event)}\n`)
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(line({ type: 'cards', ids: cards.map((card) => card.id) }))
        try {
          if (!first.done) controller.enqueue(line({ type: 'text', value: first.value }))
          for await (const value of chunks) controller.enqueue(line({ type: 'text', value }))
        } catch (error) {
          console.error(error)
          controller.enqueue(
            line({ type: 'error', message: 'Связь оборвалась. Попробуй ещё раз.' }),
          )
        }
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'cache-control': 'no-store',
        'x-accel-buffering': 'no',
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
