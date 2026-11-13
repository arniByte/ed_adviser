import { getCard, getMistake, zoneTitle } from '../../../core/knowledge'
import { citedIds, parseMeta, parseSections } from '../../../core/protocol'
import type { SessionItem } from '../../../core/progress'
import type { Card, Mistake } from '../../../core/types'
import { Orb } from '../../components/Orb'
import { RichText } from '../../components/RichText'
import { Sources } from '../../components/Sources'
import { ScoreDots } from './ScoreDots'

export interface Attempt {
  answer: string
  raw: string
  status: 'waiting' | 'streaming' | 'done' | 'failed'
  error?: string
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

export const itemFacts = (item: SessionItem) =>
  item.kind === 'case'
    ? {
        scenario: item.case.scenario,
        zone: item.case.zone,
        title: item.case.title,
        situation: item.case.situation,
        question: item.case.question,
        fallbackCards: item.case.cards,
      }
    : {
        scenario: item.mistake.scenario,
        zone: item.mistake.zone,
        title: `Возврат к ошибке: ${lowerFirst(item.mistake.title)}`,
        situation: undefined,
        question: item.mistake.probe,
        fallbackCards: [item.mistake.card],
      }

/** Разбирает ответ модели на то, что показывает интерфейс и что сохраняется в память. */
export function readReview(raw: string, fallbackCards: string[]) {
  const { lead, sections } = parseSections(raw)
  const meta = parseMeta(sections.meta)
  const improve = sections.improve ?? lead
  const cited = citedIds(`${sections.right ?? ''}\n${improve}`)
  const cardIds = cited.length > 0 ? cited : fallbackCards.slice(0, 2)
  return {
    right: sections.right ?? '',
    improve,
    example: sections.example ?? '',
    meta,
    cards: cardIds.map(getCard).filter((card): card is Card => !!card),
    mistakes: (meta?.mistakes ?? []).map(getMistake).filter((m): m is Mistake => !!m),
  }
}

function Feedback({ attempt, fallbackCards }: { attempt: Attempt; fallbackCards: string[] }) {
  const review = readReview(attempt.raw, fallbackCards)
  const numbers = new Map(review.cards.map((card, index) => [card.id, index + 1]))
  const streaming = attempt.status === 'streaming'
  const { sections } = parseSections(attempt.raw)
  // Курсор стоит в том блоке, который пишется прямо сейчас.
  const writing = streaming
    ? sections.example !== undefined
      ? 'example'
      : sections.improve !== undefined
        ? 'improve'
        : 'right'
    : null

  return (
    <div className="feedback">
      <p className="feedback__answer">
        <span className="label">твой ответ</span>
        {attempt.answer}
      </p>

      {attempt.status === 'waiting' && (
        <p className="feedback__waiting label">
          <Orb className="feedback__orb" mood="thinking" /> разбираю ответ
        </p>
      )}
      {attempt.status === 'failed' && (
        <p className="feedback__error" role="alert">
          {attempt.error}
        </p>
      )}

      {review.right && (
        <section className="block" data-tone="good">
          <h3 className="label block__label">это верно</h3>
          <RichText text={review.right} numbers={numbers} streaming={writing === 'right'} />
        </section>
      )}
      {review.improve && (
        <section className="block" data-tone="warm">
          <h3 className="label block__label">что улучшить</h3>
          <RichText text={review.improve} numbers={numbers} streaming={writing === 'improve'} />
        </section>
      )}
      {review.example && (
        <section className="block block--example glass" data-tone="blue">
          <h3 className="label block__label">удачный пример ответа</h3>
          <RichText text={review.example} streaming={writing === 'example'} />
        </section>
      )}

      {attempt.status === 'done' && (
        <div className="feedback__after focus-in">
          {review.meta && <ScoreDots score={review.meta.score} />}
          {review.mistakes.map((mistake) => (
            <details key={mistake.id} className="mistake">
              <summary>
                <span className="label">типовая ошибка</span>
                {mistake.title}
              </summary>
              <p>{mistake.why}</p>
              <p className="mistake__better">
                <span className="label">как сказать иначе</span>
                {mistake.better}
              </p>
            </details>
          ))}
          <Sources cards={review.cards} title="на что опирается разбор" />
        </div>
      )}
    </div>
  )
}

interface Props {
  item: SessionItem
  position: number
  total: number
  attempts: Attempt[]
}

export function Step({ item, position, total, attempts }: Props) {
  const facts = itemFacts(item)
  const last = attempts[attempts.length - 1]
  const followup = last?.status === 'done' ? readReview(last.raw, []).meta?.next : ''

  return (
    <article className="step" key={position}>
      <header className="step__head">
        <p className="label">
          {item.kind === 'probe' ? 'возврат к ошибке' : `кейс ${position} из ${total}`} ·{' '}
          {zoneTitle(facts.scenario, facts.zone)}
        </p>
        <div className="step__progress" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              data-state={i + 1 < position ? 'past' : i + 1 === position ? 'now' : 'next'}
            />
          ))}
        </div>
      </header>

      <div className="focus-in">
        {facts.situation && <p className="step__situation">{facts.situation}</p>}
        <h1 className="step__question">{facts.question}</h1>
      </div>

      {attempts.map((attempt, index) => (
        <Feedback key={index} attempt={attempt} fallbackCards={facts.fallbackCards} />
      ))}

      {followup && attempts.length === 1 && (
        <section className="step__followup focus-in">
          <p className="label">наставник уточняет</p>
          <p className="step__followup-text">{followup}</p>
        </section>
      )}
    </article>
  )
}
