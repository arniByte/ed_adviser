export type ScenarioId = 'admission' | 'job' | 'onboarding'

/**
 * Тип источника: закон или официальный ресурс, наука, СМИ, живой опыт —
 * и страница, которую наставник нашёл в интернете во время разговора.
 */
export type SourceKind = 'official' | 'research' | 'media' | 'voice' | 'web'

export interface Zone {
  id: string
  title: string
}

export interface Scenario {
  id: ScenarioId
  title: string
  lead: string
  /** Кем наставник представляется в этом сценарии. */
  role: string
  zones: Zone[]
}

export interface Source {
  title: string
  publisher: string
  url: string
  year?: number
  /** Дословная фраза со страницы источника; проверяется скриптом пруфов. Для DOI не нужна. */
  quote?: string
}

export interface Card {
  id: string
  scenario: ScenarioId
  zone: string
  kind: SourceKind
  title: string
  text: string
  source: Source
}

export interface Mistake {
  id: string
  scenario: ScenarioId
  zone: string
  title: string
  /** Как ошибка звучит в ответе пользователя. */
  sounds: string[]
  why: string
  better: string
  /** Контрольный вопрос для следующей сессии. */
  probe: string
  card: string
}

export interface Case {
  id: string
  scenario: ScenarioId
  zone: string
  title: string
  situation: string
  question: string
  /** Что есть в сильном ответе. */
  criteria: string[]
  mistakes: string[]
  cards: string[]
}

export const KIND_LABEL: Record<SourceKind, string> = {
  official: 'Официальный источник',
  research: 'Исследование',
  media: 'Разбор в СМИ',
  voice: 'Живой опыт',
  web: 'Из интернета',
}
