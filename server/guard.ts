/**
 * Защита ключа от чужих сайтов и перебора: запросы принимаются только
 * со своего адреса и не чаще заданного темпа с одного IP.
 */
export class Rejected extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const WINDOW_MS = 5 * 60_000
const MAX_REQUESTS = 40
const MAX_TRACKED = 5000

/** Счётчик живёт в памяти экземпляра функции: этого хватает, чтобы остановить поток с одного адреса. */
const hits = new Map<string, number[]>()

export function allow(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < WINDOW_MS)
  if (recent.length >= MAX_REQUESTS) {
    hits.set(ip, recent)
    return false
  }
  recent.push(now)
  if (hits.size >= MAX_TRACKED && !hits.has(ip)) hits.clear()
  hits.set(ip, recent)
  return true
}

export function guard(request: Request): void {
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (origin && host && new URL(origin).host !== host) {
    throw new Rejected('Запросы принимаются только со страницы тренажёра.', 403)
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local'
  if (!allow(ip)) {
    throw new Rejected('Слишком много запросов подряд. Сделай паузу на пару минут.', 429)
  }
}
