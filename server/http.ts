import { guard, Rejected } from './guard.js'
import { BadRequest } from './mentor.js'
import { UpstreamError } from './openrouter.js'

export async function readJson<T>(request: Request, maxBytes: number): Promise<T> {
  if (request.method !== 'POST') throw new BadRequest('Нужен POST-запрос')
  guard(request)
  const raw = await request.text()
  if (raw.length > maxBytes) throw new BadRequest('Слишком большой запрос')
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new BadRequest('Запрос должен быть в формате JSON')
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** Превращает любую ошибку в короткий ответ без внутренних подробностей. */
export function errorResponse(error: unknown): Response {
  if (error instanceof BadRequest) return json({ error: error.message }, 400)
  if (error instanceof Rejected) return json({ error: error.message }, error.status)
  console.error(error)
  if (error instanceof UpstreamError && error.status === 429) {
    return json({ error: 'Наставник сейчас перегружен. Попробуй через минуту.' }, 503)
  }
  return json({ error: 'Не получилось связаться с Черновиком. Попробуй ещё раз.' }, 502)
}
