import { useEffect, useRef } from 'react'
import { getCard } from '../../../core/knowledge'
import { citedIds, parseSections } from '../../../core/protocol'
import type { Card } from '../../../core/types'
import { AsciiMark } from '../../components/AsciiMark'
import { Composer } from '../../components/Composer'
import { Disclaimer } from '../../components/Disclaimer'
import { RichText } from '../../components/RichText'
import { Sources } from '../../components/Sources'
import { useSmoothText } from '../../lib/useSmoothText'
import './Ask.css'

export interface Exchange {
  id: number
  question: string
  /** Сырой ответ модели вместе с разметкой. */
  raw: string
  status: 'waiting' | 'streaming' | 'done' | 'failed'
  error?: string
}

const STARTERS = [
  'Как расставить приоритеты, если боюсь не пройти на мечту?',
  'Что писать в резюме без опыта?',
  'Меня спросят про слабые стороны. Что отвечать?',
  'Как понять, что вакансия — развод?',
  'Что спросить у руководителя в первый день?',
  'Могут ли уволить на испытательном сроке?',
]

interface Props {
  exchanges: Exchange[]
  onAsk: (question: string) => void
}

export function Thinking({ text }: { text: string }) {
  return (
    <p className="thinking caption">
      <AsciiMark size={44} mood="thinking" />
      {text}
    </p>
  )
}

function Answer({
  exchange,
  onAsk,
  isLast,
}: {
  exchange: Exchange
  onAsk: Props['onAsk']
  isLast: boolean
}) {
  const streaming = exchange.status === 'streaming'
  const raw = useSmoothText(exchange.raw, streaming)
  const { lead, sections } = parseSections(raw)
  const cited = citedIds(lead)
    .map(getCard)
    .filter((card): card is Card => !!card)
  const numbers = new Map(cited.map((card, index) => [card.id, index + 1]))
  const followups = (sections.followups ?? '')
    .split('\n')
    .map((line) => line.replace(/^[-•\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 3)
  const done = exchange.status === 'done'

  return (
    <article className="exchange">
      <p className="exchange__question">{exchange.question}</p>

      {exchange.status === 'waiting' && <Thinking text="Ищу в базе знаний" />}
      {exchange.status === 'failed' && (
        <p className="exchange__error" role="alert">
          {exchange.error}
        </p>
      )}
      {lead && <RichText text={lead} numbers={numbers} streaming={streaming} />}

      {done && (
        <div className="exchange__after">
          <div className="rise">
            <Sources cards={cited} />
          </div>
          {isLast && followups.length > 0 && (
            <div className="exchange__followups rise" style={{ '--i': 1 } as React.CSSProperties}>
              {followups.map((question) => (
                <button
                  key={question}
                  className="btn btn--glass btn--small chip-question"
                  onClick={() => onAsk(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

export function Ask({ exchanges, onAsk }: Props) {
  const busy = exchanges.some((e) => e.status === 'waiting' || e.status === 'streaming')
  const latest = useRef<HTMLDivElement>(null)
  const count = exchanges.length

  useEffect(() => {
    latest.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [count])

  return (
    <main className="page ask">
      {count === 0 ? (
        <section className="ask__empty">
          <div className="rise">
            <AsciiMark size={96} playful />
          </div>
          <h1 className="title ask__title rise" style={{ '--i': 1 } as React.CSSProperties}>
            О чём спросить?
          </h1>
          <p className="caption rise" style={{ '--i': 2 } as React.CSSProperties}>
            Отвечаю по базе знаний, у каждого факта есть пруф
          </p>
          <div className="ask__starters">
            {STARTERS.map((question, index) => (
              <button
                key={question}
                className="btn btn--glass btn--small chip-question rise"
                style={{ '--i': 3 + index } as React.CSSProperties}
                onClick={() => onAsk(question)}
              >
                {question}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="ask__thread">
          {exchanges.map((exchange, index) => (
            <div
              key={exchange.id}
              ref={index === count - 1 ? latest : undefined}
              className="ask__anchor"
            >
              <Answer exchange={exchange} onAsk={onAsk} isLast={index === count - 1} />
            </div>
          ))}
          <Disclaimer />
        </div>
      )}
      <Composer docked busy={busy} placeholder="Спроси наставника…" onSubmit={onAsk} />
    </main>
  )
}
