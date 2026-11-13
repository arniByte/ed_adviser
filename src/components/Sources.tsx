import { useCallback, useState } from 'react'
import { KIND_LABEL, type Card } from '../../core/types'
import { useProofs, type ProofState } from '../lib/proofs'
import { Check, External } from './icons'
import { ProofSheet } from './ProofSheet'
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

/** Нумерованный список карточек, на которые сослался наставник, с пруфом у каждой. */
export function Sources({ cards, title = 'Источники' }: { cards: Card[]; title?: string }) {
  const states = useProofs(cards.map((card) => card.id))
  const [open, setOpen] = useState<Card | null>(null)
  const close = useCallback(() => setOpen(null), [])

  if (cards.length === 0) return null
  const all = cards.every((card) => states[card.id] === 'verified')

  return (
    <section className="sources">
      <h3 className="sources__head">
        <span className="caption">
          {title} · {cards.length}
        </span>
        {all && (
          <span className="sources__all caption">
            <Check /> Все пруфы сошлись
          </span>
        )}
      </h3>
      <ol className="sources__list">
        {cards.map((card, index) => (
          <li key={card.id} id={`source-${index + 1}`} className="source">
            <span className="source__number">{index + 1}</span>
            <span className="source__body">
              <a className="source__title" href={card.source.url} target="_blank" rel="noreferrer">
                {card.title} <External />
              </a>
              <span className="caption">
                {KIND_LABEL[card.kind]} · {card.source.publisher}
                {card.source.year ? `, ${card.source.year}` : ''}
              </span>
            </span>
            <ProofBadge state={states[card.id]} onClick={() => setOpen(card)} />
          </li>
        ))}
      </ol>
      {open && <ProofSheet card={open} onClose={close} />}
    </section>
  )
}
