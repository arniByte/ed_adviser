import { useState } from 'react'
import { KIND_LABEL, type Card } from '../../core/types'
import { useProofs, type ProofState } from '../lib/proofs'
import { Check, Chevron, External } from './icons'
import './Sources.css'

const BADGE: Record<ProofState, string> = {
  verified: 'Пруф',
  pending: 'Пруф…',
  unchecked: 'Не проверен',
  changed: 'Изменён',
  outside: 'Вне базы',
  error: 'Пруф',
}

export function ProofBadge({ state, onClick }: { state: ProofState; onClick: () => void }) {
  return (
    <button
      type="button"
      className="proof-badge"
      data-state={state}
      onClick={onClick}
      aria-label={`${BADGE[state]}: открыть проверку источника`}
    >
      {state === 'verified' && <Check />}
      {BADGE[state]}
    </button>
  )
}

interface Props {
  cards: Card[]
  title?: string
  onProof: (card: Card) => void
}

/**
 * Карточки, на которые сослался наставник. Свёрнуты в одну строку: сам ответ важнее,
 * а пруф каждой сноски открывается и прямо из текста.
 */
export function Sources({ cards, title = 'Источники', onProof }: Props) {
  const states = useProofs(cards.map((card) => card.id))
  const [expanded, setExpanded] = useState(false)

  if (cards.length === 0) return null
  const all = cards.every((card) => states[card.id] === 'verified')

  return (
    <section className="sources" data-expanded={expanded}>
      <button
        type="button"
        className="sources__head"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="caption">
          {title} · {cards.length}
        </span>
        {all && (
          <span className="sources__all caption">
            <Check /> Пруфы сошлись
          </span>
        )}
        <Chevron />
      </button>
      <div className="sources__fold">
        <ol className="sources__list" inert={!expanded}>
          {cards.map((card, index) => (
            <li key={card.id} className="source">
              <span className="source__number">{index + 1}</span>
              <span className="source__body">
                <a
                  className="source__title"
                  href={card.source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {card.title} <External />
                </a>
                <span className="caption">
                  {KIND_LABEL[card.kind]} · {card.source.publisher}
                  {card.source.year ? `, ${card.source.year}` : ''}
                </span>
              </span>
              <ProofBadge state={states[card.id]} onClick={() => onProof(card)} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
