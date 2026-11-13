import { useState } from 'react'
import { getMistake, getScenario, zoneTitle } from '../../../core/knowledge'
import type { Memory } from '../../../core/progress'
import { RichText } from '../../components/RichText'
import { External } from '../../components/icons'
import { ScoreDots } from '../train/ScoreDots'
import { DISCLAIMER, exportNotes, formatDate, sessionCards } from './notes'
import './Report.css'

/** Разбор сессии в виде документа: читается с экрана и печатается в PDF. */
export function Report({ memory, sessionId }: { memory: Memory; sessionId: string }) {
  const session = memory.sessions.find((s) => s.id === sessionId)
  const [note, setNote] = useState('')

  if (!session) {
    return (
      <main className="page report">
        <p className="report__missing">
          Такого разбора в этом браузере нет. Возможно, данные стёрли.
        </p>
        <a className="chip" href="#/progress">
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
        <button className="chip chip--solid" onClick={() => window.print()}>
          Сохранить PDF
        </button>
        <button className="chip" onClick={saveNotes}>
          В заметки
        </button>
        <a className="chip" href="#/progress">
          Все разборы
        </a>
        {note && <p className="report__note">{note}</p>}
      </div>

      <article className="sheet">
        <header className="sheet__head">
          <p className="label">Черновик · разбор тренировки</p>
          <h1 className="sheet__title">{scenario?.title}</h1>
          <p className="sheet__meta">
            {formatDate(session.date)} · {total} из {session.items.length * 3} баллов
          </p>
        </header>

        {session.summary && <RichText text={session.summary} className="sheet__summary" />}

        {session.plan.length > 0 && (
          <section className="sheet__section">
            <h2 className="label">что сделать до настоящего</h2>
            <ul className="sheet__plan">
              {session.plan.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </section>
        )}

        {session.items.map((item, index) => (
          <section key={index} className="sheet__case">
            <header className="sheet__case-head">
              <p className="label">
                {index + 1} · {zoneTitle(item.scenario, item.zone)}
              </p>
              <ScoreDots score={item.score} withVerdict={false} />
            </header>
            <h2 className="sheet__case-title">{item.question}</h2>
            {item.situation && <p className="sheet__situation">{item.situation}</p>}

            <div className="sheet__part">
              <h3 className="label">мой ответ</h3>
              <p className="sheet__answer">{item.answer}</p>
            </div>
            {item.right && (
              <div className="sheet__part">
                <h3 className="label">это верно</h3>
                <RichText text={item.right} numbers={numbers} />
              </div>
            )}
            {item.improve && (
              <div className="sheet__part">
                <h3 className="label">что улучшить</h3>
                <RichText text={item.improve} numbers={numbers} />
              </div>
            )}
            {item.example && (
              <div className="sheet__part sheet__part--example">
                <h3 className="label">удачный пример ответа</h3>
                <RichText text={item.example} />
              </div>
            )}
            {item.mistakes.map((id) => {
              const mistake = getMistake(id)
              return (
                mistake && (
                  <div key={id} className="sheet__part">
                    <h3 className="label">типовая ошибка · {mistake.title}</h3>
                    <p className="sheet__answer">Как сказать иначе: {mistake.better}</p>
                  </div>
                )
              )
            })}
          </section>
        ))}

        {cards.length > 0 && (
          <section className="sheet__section">
            <h2 className="label">источники</h2>
            <ol className="sheet__sources">
              {cards.map((card, index) => (
                <li key={card.id} id={`source-${index + 1}`}>
                  <span className="sheet__source-number">{index + 1}</span>
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

        <footer className="sheet__foot disclaimer">{DISCLAIMER}</footer>
      </article>
    </main>
  )
}
