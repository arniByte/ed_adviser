import scenariosData from '../knowledge/scenarios.json'
import admissionCards from '../knowledge/admission/cards.json'
import admissionMistakes from '../knowledge/admission/mistakes.json'
import admissionCases from '../knowledge/admission/cases.json'
import jobCards from '../knowledge/job/cards.json'
import jobMistakes from '../knowledge/job/mistakes.json'
import jobCases from '../knowledge/job/cases.json'
import onboardingCards from '../knowledge/onboarding/cards.json'
import onboardingMistakes from '../knowledge/onboarding/mistakes.json'
import onboardingCases from '../knowledge/onboarding/cases.json'
import type { Card, Case, Mistake, Scenario, ScenarioId } from './types'

function tag<T>(scenario: ScenarioId, items: unknown): T[] {
  return (items as Omit<T, 'scenario'>[]).map((item) => ({ ...item, scenario }) as T)
}

export const scenarios = scenariosData as Scenario[]

export const cards: Card[] = [
  ...tag<Card>('admission', admissionCards),
  ...tag<Card>('job', jobCards),
  ...tag<Card>('onboarding', onboardingCards),
]

export const mistakes: Mistake[] = [
  ...tag<Mistake>('admission', admissionMistakes),
  ...tag<Mistake>('job', jobMistakes),
  ...tag<Mistake>('onboarding', onboardingMistakes),
]

export const cases: Case[] = [
  ...tag<Case>('admission', admissionCases),
  ...tag<Case>('job', jobCases),
  ...tag<Case>('onboarding', onboardingCases),
]

const index = <T extends { id: string }>(items: T[]) =>
  new Map(items.map((item) => [item.id, item]))

const cardById = index(cards)
const mistakeById = index(mistakes)
const caseById = index(cases)
const scenarioById = index(scenarios)

export const getCard = (id: string) => cardById.get(id)
export const getMistake = (id: string) => mistakeById.get(id)
export const getCase = (id: string) => caseById.get(id)
export const getScenario = (id: string) => scenarioById.get(id as ScenarioId)

export function zoneTitle(scenario: ScenarioId, zone: string): string {
  return getScenario(scenario)?.zones.find((z) => z.id === zone)?.title ?? zone
}

export const isScenarioId = (value: unknown): value is ScenarioId =>
  typeof value === 'string' && scenarioById.has(value as ScenarioId)
