import { cleanCitations, parseSections } from '../../core/protocol'
import type { Exchange } from './chat'
import { AURA_SIZE, paintAura, type Palette } from './aura'
import { plural } from './plural'

const PALETTES: Palette[] = ['pastel', 'thermal', 'mint', 'dusk']
const stills = new Map<string, string>()

function hash(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/**
 * Обложка разговора: один кадр ауры, цвет и рисунок выводятся из id.
 * Рисуется один раз, дальше это обычная картинка.
 */
export function chatCover(id: string): string {
  const cached = stills.get(id)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = AURA_SIZE
  const context = canvas.getContext('2d')
  if (!context) return ''
  const h = hash(id)
  const image = context.createImageData(AURA_SIZE, AURA_SIZE)
  paintAura(image, (h % 997) / 10, {
    palette: PALETTES[(h >>> 3) % PALETTES.length],
    seed: (h >>> 7) % 13,
    bands: 0,
    energy: 0.7,
  })
  context.putImageData(image, 0, 0)
  const url = canvas.toDataURL('image/png')
  stills.set(id, url)
  return url
}

const QUESTIONS: [string, string, string] = ['вопрос', 'вопроса', 'вопросов']

/** «Сегодня, 14:05», «вчера», «12 ноября». */
export function chatWhen(time: number, now = Date.now()): string {
  const date = new Date(time)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const day = 86_400_000
  if (time >= today.getTime())
    return `сегодня, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
  if (time >= today.getTime() - day) return 'вчера'
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  })
}

export const chatSize = (count: number) => `${count} ${plural(count, QUESTIONS)}`

/** Текст ответа без служебных меток и разметки — для буфера обмена и превью. */
export function plainAnswer(lead: string) {
  return cleanCitations(lead)
    .replace(/\[(?:adm|job|onb|web)-[a-z0-9-]+\]/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .trim()
}

/** Начало последнего ответа: по нему разговор узнаётся в списке. */
export function chatPreview(exchanges: Exchange[]): string {
  const last = exchanges[exchanges.length - 1]
  if (!last) return ''
  const text = plainAnswer(parseSections(last.raw).lead).replace(/\s+/g, ' ')
  return text.length > 160 ? `${text.slice(0, 158).trimEnd()}…` : text
}
