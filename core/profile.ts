/**
 * Что пользователь рассказал о себе при знакомстве. Хранится только в его браузере
 * и уходит на сервер вместе с вопросом, чтобы наставник подстраивал примеры и тон.
 */
import { LIMITS } from './protocol.js'
import { isScenarioId } from './knowledge.js'
import type { ScenarioId } from './types.js'

export const STAGES = {
  school: 'Школа',
  college: 'Колледж',
  student: 'Студент',
  graduate: 'Выпускник',
  working: 'Уже работаю',
} as const

export type Stage = keyof typeof STAGES

export interface Profile {
  stage?: Stage
  /** Что впереди: сценарии, с которых начать. */
  goals?: ScenarioId[]
  /** Пара слов о себе своими словами: город, интересы, что тревожит. */
  about?: string
}

const GOAL_TEXT: Record<ScenarioId, string> = {
  admission: 'поступление',
  job: 'поиск первой работы',
  onboarding: 'первый месяц на новой работе',
}

/** Приводит присланный профиль к безопасному виду: лишние поля и длинный текст отбрасываются. */
export function cleanProfile(value: unknown): Profile | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const profile: Profile = {}
  if (typeof raw.stage === 'string' && raw.stage in STAGES) profile.stage = raw.stage as Stage
  if (Array.isArray(raw.goals)) profile.goals = raw.goals.filter(isScenarioId).slice(0, 3)
  if (typeof raw.about === 'string' && raw.about.trim())
    profile.about = raw.about.trim().slice(0, LIMITS.aboutChars)
  return profile.stage || profile.goals?.length || profile.about ? profile : undefined
}

/** Профиль одной строкой для системного промпта. */
export function describeProfile(profile: Profile): string {
  const parts: string[] = []
  if (profile.stage) parts.push(`сейчас: ${STAGES[profile.stage].toLowerCase()}`)
  if (profile.goals?.length)
    parts.push(`впереди: ${profile.goals.map((g) => GOAL_TEXT[g]).join(', ')}`)
  if (profile.about) parts.push(`о себе: «${profile.about}»`)
  return parts.join('; ')
}
