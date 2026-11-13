import { useEffect, useState } from 'react'
import { getMistake, getScenario, zoneTitle } from '../../../core/knowledge'
import type { Memory } from '../../../core/progress'
import { RichText } from '../../components/RichText'
import { External } from '../../components/icons'
import { ScoreDots } from '../train/ScoreDots'
import { shortHash } from '../../../core/proof'
import { loadManifest } from '../../lib/proofs'
import { DISCLAIMER, exportNotes, formatDate, sessionCards } from './notes'
import './Report.css'

/** Разбор сессии в виде документа: читается с экрана и печатается в PDF. */
export function Report({ memory, sessionId }: { memory: Memory; sessionId: string }) {
  const session = memory.sessions.find((s) => s.id === sessionId)
  const [note, setNote] = useState('')
  const [root, setRoot] = useState('')
  useEffect(() => {
    loadManifest().then(
      (data) => setRoot(data.root),
      () => setRoot(''),
    )
  }, [])

  if (!session) {
    return (
      <main className="page report">
        <p className="report__missing">
          Такого разбора в этом браузере нет. Возможно, данные стёрли.
        </p>
        <a className="btn btn--glass" href="#/progress">
          К прогрессу
        </a>
      </main>
    )
  }

  const scenario = getScenario(session.scenario)
  const cards = sessionCards(session)
  const numbers = new Map(cards.map((card, index) => [card.id, index + 1]))
  const total = session.items.reduce((sum, item) => sum + item.score, 0)

  const saveNotes = async () => {
    const result = await exportNotes(session)
    setNote(result === 'saved' ? 'Файл с разбором скачан — его можно открыть в заметках.' : '')
  }

  return (
    <main className="page report">
      <div className="report__tools">
        <button className="btn btn--primary" onClick={() => window.print()}>
          Сохранить PDF
        </button>
        <button className="btn btn--glass" onClick={saveNotes}>
          В заметки
        </button>
        <a className="btn btn--glass" href="#/progress">
          Все разборы
        </a>
        {note && <p className="report__note">{note}</p>}
      </div>

      <article className="doc">
        <header className="doc__head">
          <p className="caption">Черновик · разбор тренировки</p>
          <h1 className="doc__title">{scenario?.title}</h1>
          <p className="doc__meta">
            {formatDate(session.date)} · {total} из {session.items.length * 3} баллов
          </p>
        </header>

        {session.summary && <RichText text={session.summary} className="doc__summary" />}

        {session.plan.length > 0 && (
          <section className="doc__section">
            <h2 className="caption">Что сделать до настоящего</h2>
            <ul className="doc__plan">
              {session.plan.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </section>
        )}

        {session.items.map((item, index) => (
          <section key={index} className="doc__case">
            <header className="doc__case-head">
              <p className="caption">
                {index + 1} · {zoneTitle(item.scenario, item.zone)}
              </p>
              <ScoreDots score={item.score} withVerdict={false} />
            </header>
            <h2 className="doc__case-title">{item.question}</h2>
            {item.situation && <p className="doc__situation">{item.situation}</p>}

            <div className="doc__part">
              <h3 className="caption">Мой ответ</h3>
              <p className="doc__answer">{item.answer}</p>
            </div>
            {item.right && (
              <div className="doc__part">
                <h3 className="caption">Это верно</h3>
                <RichText text={item.right} numbers={numbers} />
              </div>
            )}
            {item.improve && (
              <div className="doc__part">
                <h3 className="caption">Что улучшить</h3>
                <RichText text={item.improve} numbers={numbers} />
              </div>
            )}
            {item.example && (
              <div className="doc__part doc__part--example">
                <h3 className="caption">Удачный пример ответа</h3>
                <RichText text={item.example} />
              </div>
            )}
            {item.mistakes.map((id) => {
              const mistake = getMistake(id)
              return (
                mistake && (
                  <div key={id} className="doc__part">
                    <h3 className="caption">Типовая ошибка · {mistake.title}</h3>
                    <p className="doc__answer">Как сказать иначе: {mistake.better}</p>
                  </div>
                )
              )
            })}
          </section>
        ))}

        {cards.length > 0 && (
          <section className="doc__section">
            <h2 className="caption">Источники</h2>
            <ol className="doc__sources">
              {cards.map((card, index) => (
                <li key={card.id} id={`source-${index + 1}`}>
                  <span className="doc__source-number">{index + 1}</span>
                  <span>
                    {card.title}. {card.source.publisher}
                    {card.source.year ? `, ${card.source.year}` : ''}.{' '}
                    <a href={card.source.url} target="_blank" rel="noreferrer">
                      {card.source.url.replace(/^https:\/\/(www\.)?/, '')} <External />
                    </a>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <footer className="doc__foot disclaimer">
          {DISCLAIMER}
          {root && <> Пруфы источников сверены с корнем базы знаний {shortHash(root)}.</>}
        </footer>
      </article>
    </main>
  )
}
