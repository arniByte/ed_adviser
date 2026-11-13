/**
 * Лексический поиск по карточкам: лёгкий стеммер для русского языка и BM25.
 * База небольшая, поэтому индекс строится при загрузке модуля и живёт в памяти.
 */
import { cards, getScenario, zoneTitle } from './knowledge'
import type { Card, ScenarioId } from './types'

const STOP_WORDS = new Set(
  `и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от
   меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам
   ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего
   раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы
   нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас
   про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им
   более всегда конечно всю между это нужно очень могу могут можешь стоит делать сделать такое`.split(
    /\s+/,
  ),
)

/**
 * Разговорные и сокращённые формы из вопросов подростков. Ключ — начало слова,
 * поэтому «собесе», «собесы» и «собеседовании» попадают в одну строку.
 */
const SYNONYMS: [prefix: string, expansion: string[]][] = [
  ['универ', ['вуз']],
  ['институт', ['вуз']],
  ['собес', ['собеседование', 'интервью']],
  ['интервью', ['собеседование']],
  ['стажир', ['стажер', 'практика']],
  ['джун', ['новичок', 'стажер']],
  ['испыталк', ['испытательный', 'испытание']],
  ['зарплат', ['оплата', 'деньги']],
  ['оффер', ['предложение', 'работа']],
  ['техникум', ['колледж']],
  ['развод', ['мошенники']],
  ['скам', ['мошенники']],
  ['обман', ['мошенники']],
  ['начальник', ['руководитель']],
  ['босс', ['руководитель']],
  ['косяк', ['ошибка']],
  ['накосяч', ['ошибка']],
  ['облажа', ['ошибка']],
  ['фидбек', ['обратная', 'связь']],
  ['увол', ['расторгнуть', 'испытание']],
  ['боюсь', ['страх', 'безопасно']],
  ['страшно', ['страх', 'безопасно']],
  ['бюджет', ['бесплатно']],
  ['егэ', ['баллы', 'экзамен']],
]

const ENDINGS = [
  'иями',
  'ями',
  'ами',
  'ого',
  'его',
  'ому',
  'ему',
  'ыми',
  'ими',
  'ешь',
  'ишь',
  'ете',
  'ите',
  'ться',
  'тся',
  'ая',
  'яя',
  'ое',
  'ее',
  'ые',
  'ие',
  'ый',
  'ий',
  'ой',
  'ей',
  'ом',
  'ем',
  'ам',
  'ям',
  'ах',
  'ях',
  'ов',
  'ев',
  'ую',
  'юю',
  'ия',
  'ию',
  'ии',
  'ть',
  'ет',
  'ит',
  'ут',
  'ют',
  'ат',
  'ят',
  'ал',
  'ил',
  'ел',
  'а',
  'я',
  'о',
  'е',
  'ы',
  'и',
  'у',
  'ю',
  'ь',
]

export function stem(word: string): string {
  for (const ending of ENDINGS) {
    if (word.length - ending.length >= 3 && word.endsWith(ending)) {
      return word.slice(0, -ending.length)
    }
  }
  return word
}

/** Общий корень из четырёх букв связывает «уволить» с «увольнением». */
const rootKey = (word: string) => (word.length >= 6 ? `^${word.slice(0, 4)}` : null)

export function tokenize(text: string): string[] {
  const words =
    text
      .toLowerCase()
      .replace(/ё/g, 'е')
      .match(/[a-zа-я0-9]+/g) ?? []
  const tokens: string[] = []
  const push = (word: string) => {
    tokens.push(stem(word))
    const root = rootKey(word)
    if (root) tokens.push(root)
  }
  for (const word of words) {
    if (word.length < 2 || STOP_WORDS.has(word)) continue
    push(word)
    for (const [prefix, expansion] of SYNONYMS) {
      if (word.startsWith(prefix)) expansion.forEach(push)
    }
  }
  return tokens
}

interface Doc {
  card: Card
  length: number
  frequency: Map<string, number>
}

function toDoc(card: Card): Doc {
  const scenario = getScenario(card.scenario)
  // Заголовок учитывается дважды: совпадение в нём весит больше, чем в тексте.
  const tokens = tokenize(
    [
      card.title,
      card.title,
      card.text,
      card.source.title,
      zoneTitle(card.scenario, card.zone),
      scenario?.title,
    ].join(' '),
  )
  const frequency = new Map<string, number>()
  for (const token of tokens) frequency.set(token, (frequency.get(token) ?? 0) + 1)
  return { card, length: tokens.length, frequency }
}

const docs = cards.map(toDoc)
const averageLength = docs.reduce((sum, doc) => sum + doc.length, 0) / docs.length
const documentFrequency = new Map<string, number>()
for (const doc of docs) {
  for (const token of doc.frequency.keys()) {
    documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1)
  }
}

const K1 = 1.4
const B = 0.7
/** Карточки выбранного сценария поднимаются выше, но чужие не отсекаются. */
const SCENARIO_BOOST = 1.35
/** Ниже этого порога совпадение случайное: вопрос не по теме базы. */
const MIN_SCORE = 3
/** Совпадение по корню слабее точного совпадения по основе. */
const ROOT_WEIGHT = 0.45

export interface SearchHit {
  card: Card
  score: number
}

export function search(
  query: string,
  options: { scenario?: ScenarioId; limit?: number } = {},
): SearchHit[] {
  const { scenario, limit = 6 } = options
  const terms = [...new Set(tokenize(query))]
  if (terms.length === 0) return []

  const hits: SearchHit[] = []
  for (const doc of docs) {
    let score = 0
    for (const term of terms) {
      const tf = doc.frequency.get(term)
      if (!tf) continue
      const df = documentFrequency.get(term) ?? 0
      const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5))
      const weight = term.startsWith('^') ? ROOT_WEIGHT : 1
      score +=
        (weight * idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * doc.length) / averageLength))
    }
    if (score === 0) continue
    if (scenario && doc.card.scenario === scenario) score *= SCENARIO_BOOST
    hits.push({ card: doc.card, score })
  }

  hits.sort((a, b) => b.score - a.score)
  const best = hits[0]?.score ?? 0
  if (best < MIN_SCORE) return []
  // Хвост со слабым совпадением только размывает ответ.
  return hits.filter((hit) => hit.score >= best * 0.35).slice(0, limit)
}
