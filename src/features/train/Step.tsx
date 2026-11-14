import { useEffect, useRef } from 'react'
import { getCard, getMistake, zoneTitle } from '../../../core/knowledge'
import { citedIds, parseMeta, parseSections } from '../../../core/protocol'
import type { SessionItem } from '../../../core/progress'
import type { Card, Mistake } from '../../../core/types'
import { useProofSheet } from '../../components/ProofSheet'
import { RichText } from '../../components/RichText'
import { Sources } from '../../components/Sources'
import { useSmoothText } from '../../lib/useSmoothText'
import { Thinking } from '../ask/Ask'
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
  const top = useRef<HTMLDivElement>(null)
  // Новый разбор подъезжает к верху экрана: читать его удобно сверху вниз, пока он пишется.
  useEffect(() => {
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const streaming = attempt.status === 'streaming'
  const raw = useSmoothText(attempt.raw, streaming)
  const review = readReview(raw, fallbackCards)
  const numbers = new Map(review.cards.map((card, index) => [card.id, index + 1]))
  const [sheet, showProof] = useProofSheet()
  const proveCited = (id: string) => {
    const card = review.cards.find((item) => item.id === id)
    if (card) showProof(card)
  }

  return (
    <div ref={top} className="feedback">
      <p className="feedback__answer">
        <span className="caption">Твой ответ</span>
        {attempt.answer}
      </p>

      {attempt.status === 'waiting' && <Thinking text="Разбираю ответ" />}
      {attempt.status === 'failed' && (
        <p className="feedback__error" role="alert">
          {attempt.error}
        </p>
      )}

      {review.right && (
        <section className="block" data-tone="good">
          <h3 className="block__label">Это верно</h3>
          <RichText text={review.right} numbers={numbers} reveal onCite={proveCited} />
        </section>
      )}
      {review.improve && (
        <section className="block" data-tone="warm">
          <h3 className="block__label">Что улучшить</h3>
          <RichText text={review.improve} numbers={numbers} reveal onCite={proveCited} />
        </section>
      )}
      {review.example && (
        <section className="block block--example surface" data-tone="blue">
          <h3 className="block__label">Удачный пример ответа</h3>
          <RichText text={review.example} reveal />
        </section>
      )}

      {attempt.status === 'done' && (
        <div className="feedback__after rise">
          {review.meta && <ScoreDots score={review.meta.score} />}
          {review.mistakes.map((mistake) => (
            <details key={mistake.id} className="mistake">
              <summary>
                <span className="mistake__kind">Типовая ошибка</span>
                {mistake.title}
              </summary>
              <p>{mistake.why}</p>
              <p className="mistake__better">
                <span className="caption">Как сказать иначе</span>
                {mistake.better}
              </p>
            </details>
          ))}
          <Sources cards={review.cards} title="На что опирается разбор" onProof={showProof} />
        </div>
      )}
      {sheet}
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
    <article className="step">
      <header className="step__head">
        <p className="caption">
          {item.kind === 'probe' ? 'Возврат к ошибке' : `Кейс ${position} из ${total}`} ·{' '}
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

      <div className="rise">
        {facts.situation && <p className="step__situation">{facts.situation}</p>}
        <h1 className="step__question">{facts.question}</h1>
      </div>

      {attempts.map((attempt, index) => (
        <Feedback key={index} attempt={attempt} fallbackCards={facts.fallbackCards} />
      ))}

      {followup && attempts.length === 1 && (
        <section className="step__followup rise">
          <p className="caption">Черновик уточняет</p>
          <p className="step__followup-text">{followup}</p>
        </section>
      )}
    </article>
  )
}
