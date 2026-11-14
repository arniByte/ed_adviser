import { shortHash } from '../../../core/proof'
import type { Card } from '../../../core/types'
import { Aura } from '../../components/Aura'
import { Close } from '../../components/icons'
import { ProofBadge } from '../../components/Sources'
import { removeFromMine, useMine, useMineRoot } from '../../lib/mine'
import { plural } from '../../lib/plural'
import './MyBase.css'

/**
 * Личная база: то, что наставник нашёл в интернете и пользователь сохранил.
 * У неё свой корень Меркла, а сами карточки идут в следующие ответы.
 */
export function MyBase({ onProof }: { onProof: (card: Card) => void }) {
  const mine = useMine()
  const root = useMineRoot()

  return (
    <section className="mybase rise" style={{ '--i': 3 } as React.CSSProperties}>
      <Aura className="mybase__aura" palette="mint" seed={4} bands={6} fps={14} />
      <div className="mybase__body">
        <h2 className="mybase__title">Моя база</h2>
        {mine.length === 0 ? (
          <p className="mybase__hint">
            Подтверждённые находки из интернета сохраняются здесь сами. Открой пруф, чтобы проверить
            источник. Наставник сможет опираться на найденное в следующих ответах.
          </p>
        ) : (
          <>
            <p className="caption">
              {mine.length} {plural(mine.length, ['карточка', 'карточки', 'карточек'])} из интернета
              {root ? ` · корень ${shortHash(root)}` : ''}
            </p>
            <ul className="mybase__list">
              {mine.map(({ card }) => (
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
          </>
        )}
      </div>
    </section>
  )
}
