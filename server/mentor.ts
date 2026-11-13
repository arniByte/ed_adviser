import { getCard, getCase, getMistake, getScenario, isScenarioId } from '../core/knowledge'
import { LIMITS, type ChatTurn, type MentorRequest } from '../core/protocol'
import { search } from '../core/search'
import type { Card, Mistake } from '../core/types'
import type { Message } from './openrouter'
import { askPrompt, caseContext, debriefPrompt, probeContext, reviewPrompt } from './prompts'

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
    const role = turn?.role === 'assistant' ? 'assistant' : 'user'
    return { role, content: text(turn?.content, 'сообщение') }
  })
}

function mistakesByIds(ids: unknown): Mistake[] {
  return Array.isArray(ids) ? ids.map((id) => getMistake(String(id))).filter(present) : []
}

function prepareAsk(body: Extract<MentorRequest, { mode: 'ask' }>): Prepared {
  const history = turns(body.turns)
  const scenario = isScenarioId(body.scenario) ? body.scenario : undefined
  // В запрос к поиску идут два последних вопроса: уточнение без контекста часто слишком короткое.
  const query = history
    .filter((turn) => turn.role === 'user')
    .slice(-2)
    .map((turn) => turn.content)
    .join(' ')
  const cards = search(query, { scenario, limit: 6 }).map((hit) => hit.card)
  return {
    cards,
    messages: [
      { role: 'system', content: askPrompt(scenario && getScenario(scenario), cards) },
      ...history,
    ],
    maxTokens: OUTPUT_BUDGET.ask,
    temperature: 0.4,
  }
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
        content: reviewPrompt({
          ...base,
          previous,
          knownMistakes: known.filter((m) => caseMistakes.has(m.id)),
        }),
      },
      { role: 'user', content: answer },
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
      { role: 'system', content: debriefPrompt(scenario, results) },
      { role: 'user', content: 'Подведи итог тренировки.' },
    ],
    maxTokens: OUTPUT_BUDGET.debrief,
    temperature: 0.5,
  }
}

export function prepare(body: MentorRequest): Prepared {
  switch (body?.mode) {
    case 'ask':
      return prepareAsk(body)
    case 'review':
      return prepareReview(body)
    case 'debrief':
      return prepareDebrief(body)
    default:
      throw new BadRequest('Неизвестный режим')
  }
}
