/**
 * Поиск по интернету с пруфами. Модель с веб-поиском находит страницы и выписывает
 * с каждой дословную цитату. Сервер сам открывает каждую страницу и ищет на ней эту
 * цитату. В ответ идут только карточки, чья цитата нашлась: остальное отбрасывается,
 * как бы правдоподобно оно ни звучало.
 */
import { isScenarioId } from '../core/knowledge.js'
import { leafHash, sha256, type WebCheck } from '../core/proof.js'
import type { Card, ScenarioId } from '../core/types.js'
import { complete, MODELS } from './openrouter.js'
import { containsQuote, fetchHtml } from './page-text.js'

/** Сколько страниц читает поиск: больше — дороже и дольше, а пруфов не прибавляется. */
const RESULTS = 6
const MAX_CARDS = 4
const PAGE_TIMEOUT_MS = 7000

export interface Found {
  cards: Card[]
  checks: Record<string, WebCheck>
  /** Сколько источников модель предложила до проверки. */
  looked: number
}

interface Candidate {
  url: string
  title: string
  publisher: string
  year?: number
  quote: string
  fact: string
  scenario?: string
}

const QUESTION_FOCUS = `Ориентируйся только на текущий вопрос. Предыдущий вопрос используй лишь для восстановления пропущенных деталей уточнения. Если текущий вопрос самодостаточен, игнорируй предыдущий и не ищи факты по прежней теме.`

const questionText = (question: string, previousQuestion?: string) =>
  `Текущий вопрос пользователя: «${question}»${previousQuestion ? `\nПредыдущий вопрос — только контекст уточнения: «${previousQuestion}»` : ''}`

const PROMPT = `Ты помогаешь наставнику для абитуриентов, студентов и начинающих сотрудников в России.
Найди в интернете свежие факты, которые нужны, чтобы ответить на вопрос пользователя. Предпочитай официальные сайты вузов, ведомств и работодателей, затем крупные СМИ.
${QUESTION_FOCUS}

Верни только JSON-массив до 4 объектов, без пояснений:
[{"url": "...", "title": "...", "publisher": "...", "year": 2026, "quote": "...", "fact": "...", "scenario": "admission"}]

- url — адрес страницы, где есть цитата;
- title — суть факта по-русски, до 8 слов;
- publisher — кто опубликовал: сайт, издание или организация;
- year — год публикации, если виден, иначе не указывай;
- quote — одно предложение со страницы, скопированное дословно, на языке страницы, 8–40 слов. Ничего не сокращай и не переставляй: цитату будут искать на странице;
- fact — что из этого следует для пользователя, одна-две фразы по-русски;
- scenario — admission (поступление), job (поиск работы) или onboarding (первые месяцы на работе).`

/** Достаёт объекты из ответа модели, даже если массив оборвался или обёрнут в текст. */
export function parseCandidates(text: string): Candidate[] {
  const objects = text.match(/\{[^{}]*\}/g) ?? []
  const out: Candidate[] = []
  for (const raw of objects) {
    try {
      const item = JSON.parse(raw) as Partial<Candidate>
      if (typeof item.url !== 'string' || !/^https?:\/\//.test(item.url)) continue
      if (typeof item.quote !== 'string' || item.quote.trim().split(/\s+/).length < 5) continue
      if (typeof item.fact !== 'string' || typeof item.title !== 'string') continue
      out.push({
        url: item.url,
        title: item.title.trim().slice(0, 120),
        publisher: String(item.publisher ?? new URL(item.url).hostname).slice(0, 80),
        year: Number.isInteger(item.year) ? item.year : undefined,
        quote: item.quote.trim().slice(0, 400),
        fact: item.fact.trim().slice(0, 500),
        scenario: item.scenario,
      })
    } catch {
      // Оборванный объект в конце ответа просто пропускаем.
    }
  }
  return out
}

async function toCard(item: Candidate, fallback: ScenarioId): Promise<Card> {
  const id = `web-${(await sha256(`${item.url}\n${item.quote}`)).slice(0, 10)}`
  return {
    id,
    scenario: isScenarioId(item.scenario) ? item.scenario : fallback,
    zone: 'web',
    kind: 'web',
    title: item.title,
    text: item.fact,
    source: {
      title: item.title,
      publisher: item.publisher,
      url: item.url,
      ...(item.year ? { year: item.year } : {}),
      quote: item.quote,
    },
  }
}

const ROUTER = `Реши, нужен ли поиск в интернете, чтобы ответить на вопрос абитуриента или начинающего специалиста.
${QUESTION_FOCUS}
Нужен, если для ответа нужен любой конкретный факт: вуз, колледж, компания, программа, город, специальность, перечень, сроки, даты, баллы, цены, контакты, правила этого года. Уточнение к прошлому вопросу о конкретном месте тоже требует поиска.
Не нужен, если вопрос про навыки и поведение (как готовиться, как себя вести, что сказать, что писать в резюме), бытовой или общеизвестный (как вскипятить или закипятить чайник, что приготовить, что взять в общагу, как устроена ипотека), даже если он написан со сленгом или обращением («вась», «бро»), а также если это болтовня, шутка или приветствие.
Сомневаешься — отвечай yes.
Ответь одним словом: yes или no.`

/** Быстрое решение маленькой модели: идти ли за фактами в интернет. */
export async function needsWeb(question: string, previousQuestion?: string): Promise<boolean> {
  const verdict = await complete({
    messages: [
      { role: 'system', content: ROUTER },
      { role: 'user', content: questionText(question, previousQuestion) },
    ],
    // Меньше 16 токенов эта модель иногда отвечает пустой строкой.
    maxTokens: 16,
    temperature: 0,
    model: MODELS.fallback,
  })
  return verdict.toLowerCase().startsWith('y')
}

/** Один заход поиска: модель находит страницы и цитаты, сервер проверяет каждую. */
async function searchOnce(
  query: string,
  pages: Map<string, Promise<string | null>>,
): Promise<{ confirmed: Candidate[]; looked: number }> {
  const text = await complete({
    messages: [
      { role: 'system', content: PROMPT },
      // Вопрос подаётся как материал для поиска: иначе модель отвечает на него сама, текстом.
      {
        role: 'user',
        content: `${query}\n\nНайди факты для ответа и верни только JSON-массив, как описано.`,
      },
    ],
    maxTokens: 1800,
    temperature: 0.2,
    webResults: RESULTS,
  })
  const candidates = parseCandidates(text)
  const open = (url: string) => fetchHtml(url, PAGE_TIMEOUT_MS)
  // Каждую страницу открываем один раз; сетевой сбой — повод для одного повтора.
  const page = (url: string) => {
    if (!pages.has(url))
      pages.set(
        url,
        open(url).catch(() => open(url).catch(() => null)),
      )
    return pages.get(url)!
  }
  const checked = await Promise.all(
    candidates.map(async (item) => {
      const body = await page(item.url)
      return body && containsQuote(body, item.quote) ? item : null
    }),
  )
  return {
    confirmed: checked.filter((item): item is Candidate => item !== null),
    looked: candidates.length,
  }
}

export async function findOnWeb(
  question: string,
  context: { scenario?: ScenarioId; profile?: string; previousQuestion?: string },
  onProgress?: (status: string) => void,
): Promise<Found> {
  const about = context.profile ? `\nО пользователе: ${context.profile}` : ''
  const pages = new Map<string, Promise<string | null>>()
  let { confirmed, looked } = await searchOnce(
    questionText(question, context.previousQuestion) + about,
    pages,
  )
  if (looked > 0) onProgress?.(`Сверяю цитаты на страницах: ${looked}`)

  // Ничего не подтвердилось — второй заход: шире, с опорой на официальные сайты.
  if (confirmed.length === 0) {
    onProgress?.('Ищу ещё, на официальных сайтах')
    const retry = await searchOnce(
      `${questionText(question, context.previousQuestion)}${about}
Первый поиск не дал страниц с дословно подтверждаемыми фразами. Ищи шире: официальные сайты вузов, колледжей и ведомств, страницы приёмных комиссий, правила приёма, разделы «Абитуриентам» и «Сведения об образовательной организации». Цитату копируй только из основного текста страницы, не из меню.`,
      pages,
    )
    confirmed = retry.confirmed
    looked += retry.looked
  }

  const checkedAt = new Date().toISOString()
  const cards: Card[] = []
  const checks: Record<string, WebCheck> = {}
  for (const item of confirmed) {
    if (cards.length >= MAX_CARDS) break
    const card = await toCard(item, context.scenario ?? 'admission')
    if (checks[card.id]) continue
    cards.push(card)
    checks[card.id] = { hash: await leafHash(card), checkedAt }
  }
  return { cards, checks, looked }
}
