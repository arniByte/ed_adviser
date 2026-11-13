import { KIND_LABEL, type Card } from '../../core/types'
import { External } from './icons'
import './Sources.css'

/** Нумерованный список карточек, на которые сослался наставник. */
export function Sources({ cards, title = 'Источники' }: { cards: Card[]; title?: string }) {
  if (cards.length === 0) return null
  return (
    <section className="sources">
      <h3 className="label">
        {title} · {cards.length}
      </h3>
      <ol>
        {cards.map((card, index) => (
          <li key={card.id} id={`source-${index + 1}`} className="source">
            <details>
              <summary>
                <span className="source__number">{index + 1}</span>
                <span className="source__title">{card.title}</span>
                <span className="source__meta">
                  {KIND_LABEL[card.kind]} · {card.source.publisher}
                  {card.source.year ? `, ${card.source.year}` : ''}
                </span>
              </summary>
              <p className="source__text">{card.text}</p>
              <a className="source__link" href={card.source.url} target="_blank" rel="noreferrer">
                {card.source.title} <External />
              </a>
            </details>
          </li>
        ))}
      </ol>
    </section>
  )
}
