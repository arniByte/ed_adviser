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
/** Поиск в интернете в десятки раз дороже обычного ответа, поэтому у него свой, строже, лимит. */
const MAX_WEB_SEARCHES = 10
const MAX_TRACKED = 5000

/** Счётчики живут в памяти экземпляра функции: этого хватает, чтобы остановить поток с одного адреса. */
const hits = new Map<string, number[]>()
const searches = new Map<string, number[]>()

export function allow(ip: string, now = Date.now(), limit = MAX_REQUESTS, store = hits): boolean {
  const recent = (store.get(ip) ?? []).filter((time) => now - time < WINDOW_MS)
  if (recent.length >= limit) {
    store.set(ip, recent)
    return false
  }
  recent.push(now)
  if (store.size >= MAX_TRACKED && !store.has(ip)) store.clear()
  store.set(ip, recent)
  return true
}

export const clientIp = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local'

/** Можно ли этому адресу ещё раз искать в интернете в текущем окне. */
export const allowWebSearch = (request: Request) =>
  allow(clientIp(request), Date.now(), MAX_WEB_SEARCHES, searches)

export function guard(request: Request): void {
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (origin && host && new URL(origin).host !== host) {
    throw new Rejected('Запросы принимаются только со страницы тренажёра.', 403)
  }

  if (!allow(clientIp(request))) {
    throw new Rejected('Слишком много запросов подряд. Сделай паузу на пару минут.', 429)
  }
}
