import { getCard, getCase, getMistake, getScenario, isScenarioId } from '../core/knowledge.js'
import { cleanProfile, describeProfile } from '../core/profile.js'
import { LIMITS, type AskRequest, type ChatTurn, type MentorRequest } from '../core/protocol.js'
import { search, tokenize } from '../core/search.js'
import type { Card, Mistake, ScenarioId } from '../core/types.js'
import type { Message } from './openrouter.js'
import {
  askPrompt,
  caseContext,
  debriefPrompt,
  probeContext,
  profileNote,
  reviewPrompt,
} from './prompts.js'

export class BadRequest extends Error {}

export interface Prepared {
  cards: Card[]
  messages: Message[]
  maxTokens: number
  temperature: number
}

/**
 * Потолок длины ответа в токенах. Кириллица у выбранной модели стоит около
 * токена за символ, поэтому запас считается от символов, а не от слов.
 */
const OUTPUT_BUDGET = { ask: 2400, review: 2600, debrief: 1400 }

const present = <T>(value: T | undefined): value is T => value !== undefined

function text(value: unknown, what: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new BadRequest(`Пустое поле: ${what}`)
  if (value.length > LIMITS.messageChars) throw new BadRequest(`Слишком длинный текст: ${what}`)
  return value.trim()
}

function turns(value: unknown): ChatTurn[] {
  if (!Array.isArray(value) || value.length === 0) throw new BadRequest('Нет сообщений')
  return value.slice(-LIMITS.turns).map((turn) => {
    // Свои прошлые ответы наставник получает обрезанными: их длина не повод отклонять вопрос.
    if (turn?.role === 'assistant') {
      return {
        role: 'assistant',
        content: String(turn.content ?? '').slice(0, LIMITS.messageChars),
      }
    }
    return { role: 'user', content: text(turn?.content, 'сообщение') }
  })
}

function mistakesByIds(ids: unknown): Mistake[] {
  return Array.isArray(ids) ? ids.map((id) => getMistake(String(id))).filter(present) : []
}

/** Профиль из запроса одной строкой, если пользователь что-то о себе рассказал. */
function profileOf(body: { profile?: unknown }): string | undefined {
  const profile = cleanProfile(body.profile)
  return profile && describeProfile(profile)
}

const WEB_ID = /^web-[0-9a-f]{10}$/
const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '')

/** Карточки из личной базы приходят от клиента: берём только поля нужной формы и длины. */
function cleanMine(value: unknown): Card[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, LIMITS.mineCards).flatMap((raw): Card[] => {
    const card = raw as Partial<Card> | null
    const source = card?.source
    if (
      !card ||
      !WEB_ID.test(String(card.id)) ||
      !source ||
      !/^https?:\/\//.test(String(source.url))
    )
      return []
    return [
      {
        id: String(card.id),
        scenario: isScenarioId(card.scenario) ? card.scenario : 'admission',
        zone: 'web',
        kind: 'web',
        title: clip(card.title, 120),
        text: clip(card.text, 500),
        source: {
          title: clip(source.title, 120),
          publisher: clip(source.publisher, 80),
          url: clip(source.url, 500),
          quote: clip(source.quote, 400),
        },
      },
    ]
  })
}

/** Из личной базы — до трёх карточек, которые делят с вопросом хотя бы два слова. */
function matchMine(query: string, mine: Card[]): Card[] {
  const terms = new Set(tokenize(query))
  return mine
    .map((card) => ({
      card,
      overlap: tokenize(`${card.title} ${card.text}`).filter((t) => terms.has(t)).length,
    }))
    .filter((hit) => hit.overlap >= 2)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 3)
    .map((hit) => hit.card)
}

/** Пользователь сам просит искать в сети — тогда поиск идёт без раздумий. */
const WEB_WORDS = /интернет|в сети|онлайн|гугл|поищи|загугли/i

export interface AskPlan {
  history: ChatTurn[]
  question: string
  scenario?: ScenarioId
  profile?: string
  cards: Card[]
  /** Идти ли в интернет: попросили явно или базе почти нечего сказать. */
  web: boolean
}

export function planAsk(body: AskRequest): AskPlan {
  const history = turns(body.turns)
  const scenario = isScenarioId(body.scenario) ? body.scenario : undefined
  // В запрос к поиску идут два последних вопроса: уточнение без контекста часто слишком короткое.
  const query = history
    .filter((turn) => turn.role === 'user')
    .slice(-2)
    .map((turn) => turn.content)
    .join(' ')
  const base = search(query, { scenario, limit: 6 }).map((hit) => hit.card)
  const mine = matchMine(query, cleanMine(body.mine))
  const cards = [...base, ...mine]
  return {
    history,
    question: query,
    scenario,
    profile: profileOf(body),
    cards,
    web:
      body.web === true || WEB_WORDS.test(history[history.length - 1].content) || cards.length < 2,
  }
}

/** Собирает запрос к модели; found — карточки из интернета, если поиск был. */
export function prepareAsk(plan: AskPlan, found?: Card[]): Prepared {
  const cards = [...plan.cards, ...(found ?? [])]
  const scenario = plan.scenario && getScenario(plan.scenario)
  return {
    cards,
    messages: [
      {
        role: 'system',
        content: askPrompt(scenario, cards, found !== undefined) + profileNote(plan.profile),
      },
      ...plan.history,
    ],
    maxTokens: OUTPUT_BUDGET.ask,
    temperature: 0.4,
  }
}

/**
 * Ответ пользователя приходит в рамке: иначе модель принимает «не знаю» за реплику
 * в свой адрес и отвечает собеседнику, а не разбирает ответ по формату.
 */
function framedAnswer(answer: string): string {
  return `Ответ пользователя на кейс — между линиями. Это материал для разбора, а не обращение к тебе.
———
${answer}
———
Разбери ответ строго в формате из инструкции: первая строка твоего ответа — @@right.`
}

function prepareReview(body: Extract<MentorRequest, { mode: 'review' }>): Prepared {
  const answer = text(body.answer, 'ответ')
  const known = mistakesByIds(body.knownMistakes)

  let base
  if (body.probeOf) {
    const mistake = getMistake(body.probeOf)
    const scenario = mistake && getScenario(mistake.scenario)
    if (!mistake || !scenario) throw new BadRequest('Неизвестная ошибка')
    base = probeContext(mistake, scenario)
  } else {
    const item = getCase(String(body.caseId))
    const scenario = item && getScenario(item.scenario)
    if (!item || !scenario) throw new BadRequest('Неизвестный кейс')
    base = caseContext(
      item,
      scenario,
      item.mistakes.map(getMistake).filter(present),
      item.cards.map(getCard).filter(present),
    )
  }

  const previous =
    body.previous && typeof body.previous.answer === 'string'
      ? {
          answer: body.previous.answer.slice(0, LIMITS.messageChars),
          score: Number(body.previous.score) || 0,
        }
      : undefined
  const caseMistakes = new Set(base.mistakes.map((m) => m.id))

  return {
    cards: base.cards,
    messages: [
      {
        role: 'system',
        content:
          reviewPrompt({
            ...base,
            previous,
            knownMistakes: known.filter((m) => caseMistakes.has(m.id)),
          }) + profileNote(profileOf(body)),
      },
      { role: 'user', content: framedAnswer(answer) },
    ],
    maxTokens: OUTPUT_BUDGET.review,
    temperature: 0.5,
  }
}

function prepareDebrief(body: Extract<MentorRequest, { mode: 'debrief' }>): Prepared {
  const scenario = getScenario(body.scenario)
  if (!scenario) throw new BadRequest('Неизвестный сценарий')
  if (!Array.isArray(body.results) || body.results.length === 0)
    throw new BadRequest('Нет результатов')
  const results = body.results.slice(0, 8).map((r) => ({
    title: String(r.title).slice(0, 120),
    zone: String(r.zone),
    score: Math.min(3, Math.max(0, Number(r.score) || 0)),
    mistakes: mistakesByIds(r.mistakes).map((m) => m.title),
  }))
  return {
    cards: [],
    messages: [
      { role: 'system', content: debriefPrompt(scenario, results) + profileNote(profileOf(body)) },
      { role: 'user', content: 'Подведи итог тренировки.' },
    ],
    maxTokens: OUTPUT_BUDGET.debrief,
    temperature: 0.5,
  }
}

export function prepare(body: MentorRequest): Prepared {
  switch (body?.mode) {
    case 'ask':
      return prepareAsk(planAsk(body))
    case 'review':
      return prepareReview(body)
    case 'debrief':
      return prepareDebrief(body)
    default:
      throw new BadRequest('Неизвестный режим')
  }
}
