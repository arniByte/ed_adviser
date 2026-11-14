import { useEffect, useRef, useState } from 'react'
import { shortHash } from '../../../core/proof'
import type { Card } from '../../../core/types'
import { Aura } from '../../components/Aura'
import { ArrowRight, Close } from '../../components/icons'
import { ProofBadge } from '../../components/Sources'
import { removeFromMine, useMine, useMineRoot } from '../../lib/mine'
import { plural } from '../../lib/plural'
import './MyBase.css'

/**
 * Личная база: то, что наставник нашёл в интернете и пользователь сохранил.
 * У неё свой корень Меркла, а сами карточки идут в следующие ответы.
 */
/** Карточек на одной странице: дальше — свайп или стрелки. */
const PAGE = 5

export function MyBase({ onProof }: { onProof: (card: Card) => void }) {
  const mine = useMine()
  const root = useMineRoot()
  const pages = Math.max(1, Math.ceil(mine.length / PAGE))
  const [page, setPage] = useState(0)
  const [direction, setDirection] = useState<'next' | 'back'>('next')
  const touch = useRef<number | null>(null)
  // Удалили последнюю карточку на странице — возвращаемся на существующую.
  useEffect(() => {
    if (page > pages - 1) setPage(pages - 1)
  }, [page, pages])
  const go = (to: number) => {
    if (to < 0 || to >= pages) return
    setDirection(to > page ? 'next' : 'back')
    setPage(to)
  }
  const shown = mine.slice(page * PAGE, page * PAGE + PAGE)

  return (
    <section className="mybase rise" style={{ '--i': 3 } as React.CSSProperties}>
      <Aura className="mybase__aura" palette="mint" seed={4} bands={6} fps={14} />
      <div className="mybase__body">
        <h2 className="mybase__title">Моя база</h2>
        {mine.length === 0 ? (
          <p className="mybase__hint">
            Подтверждённые находки из интернета сохраняются здесь сами. Открой пруф, чтобы проверить
            источник. Черновик будет опираться на найденное в следующих ответах.
          </p>
        ) : (
          <>
            <p className="caption">
              {mine.length} {plural(mine.length, ['карточка', 'карточки', 'карточек'])} из интернета
              {root ? ` · корень ${shortHash(root)}` : ''}
            </p>
            <ul
              key={page}
              className={`mybase__list mybase__list--${direction}`}
              onTouchStart={(event) => (touch.current = event.touches[0].clientX)}
              onTouchEnd={(event) => {
                if (touch.current === null) return
                const dx = event.changedTouches[0].clientX - touch.current
                touch.current = null
                if (Math.abs(dx) > 50) go(dx < 0 ? page + 1 : page - 1)
              }}
            >
              {shown.map(({ card }) => (
                <li key={card.id} className="mybase__item">
                  <span className="mybase__text">
                    <a href={card.source.url} target="_blank" rel="noreferrer">
                      {card.title}
                    </a>
                    <span className="caption">{card.source.publisher}</span>
                  </span>
                  <ProofBadge state="verified" onClick={() => onProof(card)} />
                  <button
                    className="btn btn--glass btn--icon mybase__remove"
                    aria-label={`Убрать «${card.title}» из моей базы`}
                    onClick={() => removeFromMine(card.id)}
                  >
                    <Close />
                  </button>
                </li>
              ))}
            </ul>
            {pages > 1 && (
              <nav className="mybase__pager" aria-label="Страницы моей базы">
                <button
                  type="button"
                  className="btn btn--glass btn--icon mybase__arrow mybase__arrow--back"
                  aria-label="Предыдущие"
                  disabled={page === 0}
                  onClick={() => go(page - 1)}
                >
                  <ArrowRight />
                </button>
                <span className="mybase__dots">
                  {Array.from({ length: pages }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className="mybase__dot"
                      aria-label={`Страница ${i + 1}`}
                      aria-current={i === page ? 'true' : undefined}
                      onClick={() => go(i)}
                    />
                  ))}
                </span>
                <button
                  type="button"
                  className="btn btn--glass btn--icon mybase__arrow"
                  aria-label="Следующие"
                  disabled={page === pages - 1}
                  onClick={() => go(page + 1)}
                >
                  <ArrowRight />
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  )
}
