import { useMemo, useState } from 'react'
import { cards, getScenario, scenarios, zoneTitle } from '../../../core/knowledge'
import { search } from '../../../core/search'
import { KIND_LABEL, type ScenarioId, type SourceKind } from '../../../core/types'
import { External } from '../../components/icons'
import './Library.css'

const KINDS = Object.keys(KIND_LABEL) as SourceKind[]
const sourceCount = new Set(cards.map((card) => card.source.url)).size

/** Вся база знаний открыта: любую карточку можно прочитать и проверить по источнику. */
export function Library() {
  const [query, setQuery] = useState('')
  const [scenario, setScenario] = useState<ScenarioId | null>(null)
  const [kind, setKind] = useState<SourceKind | null>(null)

  const shown = useMemo(() => {
    const found = query.trim()
      ? search(query, { limit: cards.length }).map((hit) => hit.card)
      : cards
    return found.filter(
      (card) => (!scenario || card.scenario === scenario) && (!kind || card.kind === kind),
    )
  }, [query, scenario, kind])

  return (
    <main className="page library">
      <p className="label">база знаний</p>
      <h1 className="library__title">
        {cards.length} карточек из {sourceCount} открытых источников
      </h1>
      <p className="library__lead">
        На них опирается наставник. Законы, исследования, разборы в СМИ и живой опыт — каждую
        карточку можно проверить по ссылке.
      </p>

      <input
        className="library__search"
        type="search"
        value={query}
        placeholder="Поиск по базе…"
        aria-label="Поиск по базе"
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="library__filters">
        <button className="chip" aria-pressed={!scenario} onClick={() => setScenario(null)}>
          Все темы
        </button>
        {scenarios.map((s) => (
          <button
            key={s.id}
            className="chip"
            aria-pressed={scenario === s.id}
            onClick={() => setScenario(s.id)}
          >
            {s.title}
          </button>
        ))}
      </div>
      <div className="library__filters">
        <button className="chip" aria-pressed={!kind} onClick={() => setKind(null)}>
          Все типы
        </button>
        {KINDS.map((k) => (
          <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <p className="label library__count" aria-live="polite">
        показано: {shown.length}
      </p>

      <ul className="library__list">
        {shown.map((card) => (
          <li key={card.id} className="entry">
            <p className="label">
              {getScenario(card.scenario)?.title} · {zoneTitle(card.scenario, card.zone)} ·{' '}
              {KIND_LABEL[card.kind]}
            </p>
            <h2 className="entry__title">{card.title}</h2>
            <p className="entry__text">{card.text}</p>
            <a className="entry__source" href={card.source.url} target="_blank" rel="noreferrer">
              {card.source.publisher}
              {card.source.year ? `, ${card.source.year}` : ''} — {card.source.title} <External />
            </a>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="library__empty">По такому запросу карточек нет.</p>}
    </main>
  )
}
