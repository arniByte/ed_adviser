import { useCallback, useMemo, useState } from 'react'
import { cards, getScenario, scenarios, zoneTitle } from '../../../core/knowledge'
import { search } from '../../../core/search'
import { KIND_LABEL, type Card, type ScenarioId, type SourceKind } from '../../../core/types'
import { External } from '../../components/icons'
import { ProofSheet } from '../../components/ProofSheet'
import { ProofBadge } from '../../components/Sources'
import { useProofs } from '../../lib/proofs'
import { plural } from '../../lib/plural'
import './Library.css'

const KINDS = Object.keys(KIND_LABEL) as SourceKind[]
const sourceCount = new Set(cards.map((card) => card.source.url)).size
const allIds = cards.map((card) => card.id)

/** Вся база знаний открыта: любую карточку можно прочитать и проверить по пруфу. */
export function Library() {
  const [query, setQuery] = useState('')
  const [scenario, setScenario] = useState<ScenarioId | null>(null)
  const [kind, setKind] = useState<SourceKind | null>(null)
  const [open, setOpen] = useState<Card | null>(null)
  const close = useCallback(() => setOpen(null), [])
  const proofs = useProofs(allIds)

  const shown = useMemo(() => {
    const found = query.trim()
      ? search(query, { limit: cards.length }).map((hit) => hit.card)
      : cards
    return found.filter(
      (card) => (!scenario || card.scenario === scenario) && (!kind || card.kind === kind),
    )
  }, [query, scenario, kind])

  const verified = allIds.filter((id) => proofs[id] === 'verified').length

  return (
    <main className="page library">
      <h1 className="display rise">База знаний</h1>
      <p className="lead library__lead rise" style={{ '--i': 1 } as React.CSSProperties}>
        {cards.length} {plural(cards.length, ['карточка', 'карточки', 'карточек'])} из {sourceCount}{' '}
        {sourceCount % 10 === 1 && sourceCount % 100 !== 11
          ? 'открытого источника'
          : 'открытых источников'}
        .
      </p>
      <p className="caption rise" style={{ '--i': 2 } as React.CSSProperties}>
        {verified > 0 ? `Пруфы сошлись у ${verified} из ${cards.length}` : 'Проверяю пруфы…'} ·{' '}
        <a href="#/proofs">как это работает</a>
      </p>

      <input
        className="library__search"
        type="search"
        value={query}
        placeholder="Поиск по базе…"
        aria-label="Поиск по базе"
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="library__filters" role="group" aria-label="Тема">
        <button
          className="btn btn--glass btn--small filter"
          aria-pressed={!scenario}
          onClick={() => setScenario(null)}
        >
          Все темы
        </button>
        {scenarios.map((s) => (
          <button
            key={s.id}
            className="btn btn--glass btn--small filter"
            aria-pressed={scenario === s.id}
            onClick={() => setScenario(s.id)}
          >
            {s.title}
          </button>
        ))}
      </div>
      <div className="library__filters" role="group" aria-label="Тип источника">
        <button
          className="btn btn--glass btn--small filter"
          aria-pressed={!kind}
          onClick={() => setKind(null)}
        >
          Все типы
        </button>
        {KINDS.map((k) => (
          <button
            key={k}
            className="btn btn--glass btn--small filter"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <p className="caption library__count" aria-live="polite">
        Показано: {shown.length}
      </p>

      <ul className="library__list">
        {shown.map((card) => (
          <li key={card.id} className="entry">
            <div className="entry__head">
              <p className="caption">
                {getScenario(card.scenario)?.title} · {zoneTitle(card.scenario, card.zone)}
              </p>
              <ProofBadge state={proofs[card.id]} onClick={() => setOpen(card)} />
            </div>
            <h2 className="entry__title">{card.title}</h2>
            <p className="entry__text">{card.text}</p>
            <a className="entry__source" href={card.source.url} target="_blank" rel="noreferrer">
              {KIND_LABEL[card.kind]} · {card.source.publisher}
              {card.source.year ? `, ${card.source.year}` : ''} <External />
            </a>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="library__empty">По такому запросу карточек нет.</p>}
      {open && <ProofSheet card={open} onClose={close} />}
    </main>
  )
}
