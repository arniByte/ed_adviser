import { useEffect, useRef } from 'react'
import { getCard } from '../../../core/knowledge'
import { citedIds, parseSections } from '../../../core/protocol'
import type { Card } from '../../../core/types'
import { Composer } from '../../components/Composer'
import { Disclaimer } from '../../components/Disclaimer'
import { ArrowRight } from '../../components/icons'
import { Orb } from '../../components/Orb'
import { RichText } from '../../components/RichText'
import { Sources } from '../../components/Sources'
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
  'Что писать в резюме, если опыта работы нет?',
  'Меня спросили про слабые стороны. Что отвечать?',
  'Как понять, что вакансия — развод?',
  'Что спросить у руководителя в первый день?',
  'Могут ли уволить на испытательном сроке без объяснений?',
]

interface Props {
  exchanges: Exchange[]
  onAsk: (question: string) => void
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
  const { lead, sections } = parseSections(exchange.raw)
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
      <h2 className="exchange__question">{exchange.question}</h2>

      {exchange.status === 'waiting' && (
        <p className="exchange__waiting label">
          <Orb className="exchange__orb" mood="thinking" /> ищу в базе знаний
        </p>
      )}
      {exchange.status === 'failed' && (
        <p className="exchange__error" role="alert">
          {exchange.error}
        </p>
      )}
      {lead && (
        <RichText text={lead} numbers={numbers} streaming={exchange.status === 'streaming'} />
      )}

      {done && (
        <div className="exchange__after focus-in">
          <Sources cards={cited} />
          {isLast && followups.length > 0 && (
            <section>
              <h3 className="label">спросить дальше</h3>
              <div className="rows exchange__followups">
                {followups.map((question) => (
                  <button key={question} className="row" onClick={() => onAsk(question)}>
                    {question}
                    <ArrowRight />
                  </button>
                ))}
              </div>
            </section>
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
          <p className="label">справка</p>
          <h1 className="ask__title">
            Спроси про поступление, первую работу или первый месяц в компании.
          </h1>
          <p className="ask__lead">Отвечаю по базе знаний и показываю, откуда каждый факт.</p>
          <div className="rows ask__starters">
            {STARTERS.map((question) => (
              <button key={question} className="row" onClick={() => onAsk(question)}>
                {question}
                <ArrowRight />
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
