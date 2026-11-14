import { useEffect, useRef, useState } from 'react'
import { getCard } from '../../../core/knowledge'
import { citedIds, parseSections } from '../../../core/protocol'
import type { Card } from '../../../core/types'
import { Mark } from '../../components/Mark'
import { AuraMark } from '../../components/AuraMark'
import { useMentor } from '../../lib/mentor'
import { ASK_HINTS } from '../../components/BlurCycle'
import { Shuffle } from '../../components/icons'
import { useProfile } from '../../lib/profile'
import { pickStarters } from '../../lib/starters'
import { Composer } from '../../components/Composer'
import { useProofSheet } from '../../components/ProofSheet'
import { RichText } from '../../components/RichText'
import { Sources } from '../../components/Sources'
import { Globe } from '../../components/icons'
import type { Found } from '../../lib/api'
import type { AskHandler, Exchange } from '../../lib/chat'
import { useMine } from '../../lib/mine'
import { plural } from '../../lib/plural'
import { useSmoothText } from '../../lib/useSmoothText'
import { AnswerActions } from './AnswerActions'
import './Ask.css'

interface Props {
  exchanges: Exchange[]
  onAsk: AskHandler
  onReset: () => void
}

const SOURCES: [string, string, string] = ['источник', 'источника', 'источников']
const PAGES: [string, string, string] = ['страницу', 'страницы', 'страниц']

/** Что получилось у поиска в интернете — одной строкой под ответом. */
function webSummary(found: Found): string {
  const n = found.cards.length
  if (n > 0) return `Нашёл в интернете, сверил цитаты и запомнил: ${n} ${plural(n, SOURCES)}`
  if (found.looked > 0)
    return `Открыл ${found.looked} ${plural(found.looked, PAGES)}, но цитаты не подтвердились — на них не опирался`
  return 'В интернете не нашлось страниц с подтверждаемыми фактами'
}

export function Thinking({ text }: { text: string }) {
  return (
    <p className="thinking caption">
      <Mark size={44} mood="thinking" />
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
  const mine = useMine()
  // Сноска может вести в общую базу, в найденное сейчас или в личную базу пользователя.
  const pool = new Map(
    [...(exchange.found?.cards ?? []), ...mine.map((item) => item.card)].map((card) => [
      card.id,
      card,
    ]),
  )
  const cited = citedIds(lead)
    .map((id) => getCard(id) ?? pool.get(id))
    .filter((card): card is Card => !!card)
  const numbers = new Map(cited.map((card, index) => [card.id, index + 1]))
  const followups = (sections.followups ?? '')
    .split('\n')
    .map((line) => line.replace(/^[-•\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 3)
  const done = exchange.status === 'done'
  const [sheet, showProof] = useProofSheet(exchange.found?.checks)
  const usedWeb = cited.some((card) => card.kind === 'web')
  const proveCited = (id: string) => {
    const card = cited.find((item) => item.id === id)
    if (card) showProof(card)
  }

  return (
    <article className="exchange">
      <p className="exchange__question">{exchange.question}</p>

      {exchange.status === 'waiting' && (
        <Thinking key={exchange.progress} text={exchange.progress ?? 'Ищу в базе знаний'} />
      )}
      {exchange.status === 'failed' && (
        <p className="exchange__error" role="alert">
          {exchange.error}
        </p>
      )}
      {lead && <RichText text={lead} numbers={numbers} reveal onCite={proveCited} />}

      {done && (
        <div className="exchange__after">
          <AnswerActions question={exchange.question} lead={lead} sources={cited} />
          <div className="rise">
            <Sources cards={cited} checks={exchange.found?.checks} onProof={showProof} />
          </div>
          {/* Сам ходил в интернет и ничего не нашёл — не шумим; попросил человек — отчитываемся. */}
          {exchange.found && (exchange.found.cards.length > 0 || exchange.web) && (
            <p className="exchange__web caption rise">
              <Globe />
              <span>
                {webSummary(exchange.found)}
                {exchange.found.cards.length > 0 && (
                  <>
                    {' '}
                    · <a href="#/library">моя база</a>
                  </>
                )}
              </span>
            </p>
          )}
          {isLast && !exchange.web && !usedWeb && (
            <button
              className="btn btn--glass btn--small exchange__search rise"
              onClick={() => onAsk(exchange.question, { web: true })}
            >
              <Globe /> Поискать свежее в интернете
            </button>
          )}
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
      {sheet}
    </article>
  )
}

export function Ask({ exchanges, onAsk, onReset }: Props) {
  const mentor = useMentor()
  const profile = useProfile()
  const [starters, setStarters] = useState(() => pickStarters(profile))
  const [round, setRound] = useState(0)
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
            <AuraMark size={112} palette={mentor.color} />
          </div>
          <h1 className="title ask__title rise" style={{ '--i': 1 } as React.CSSProperties}>
            О чём спросить?
          </h1>
          <p className="caption rise" style={{ '--i': 2 } as React.CSSProperties}>
            О поступлении, работе или о чём угодно. У фактов будет пруф
          </p>
          <div key={round} className="ask__starters">
            {starters.map((question, index) => (
              <button
                key={question}
                className="btn btn--glass btn--small chip-question ask__starter"
                style={{ '--i': index } as React.CSSProperties}
                onClick={() => onAsk(question)}
              >
                {question}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ask__shuffle"
            onClick={() => {
              setStarters((list) => pickStarters(profile, list))
              setRound((n) => n + 1)
            }}
          >
            <Shuffle /> Другие вопросы
          </button>
        </section>
      ) : (
        <div className="ask__thread">
          <h1 className="visually-hidden">Общение с Черновиком</h1>
          {exchanges.map((exchange, index) => (
            <div
              key={exchange.id}
              ref={index === count - 1 ? latest : undefined}
              className="ask__anchor"
            >
              <Answer exchange={exchange} onAsk={onAsk} isLast={index === count - 1} />
            </div>
          ))}
          {!busy && (
            <button className="btn btn--glass btn--small ask__reset" onClick={onReset}>
              Новый разговор
            </button>
          )}
        </div>
      )}
      <Composer
        docked
        busy={busy}
        placeholder="Спроси о чём угодно…"
        hints={ASK_HINTS}
        onSubmit={onAsk}
      />
    </main>
  )
}
