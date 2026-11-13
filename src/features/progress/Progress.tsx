import { getScenario, scenarios } from '../../../core/knowledge'
import {
  mastery,
  openMistakes,
  zoneLevel,
  type Memory,
  type ZoneLevel,
} from '../../../core/progress'
import { ArrowRight } from '../../components/icons'
import { clearMemory } from '../../lib/memory'
import { formatDate } from '../report/notes'
import './Progress.css'

const LEVEL_TEXT: Record<ZoneLevel, string> = {
  unknown: 'не начато',
  weak: 'плавает',
  growing: 'проясняется',
  solid: 'уверенно',
}

export function Progress({ memory }: { memory: Memory }) {
  const open = openMistakes(memory)
  const hasData = memory.sessions.length > 0 || Object.keys(memory.zones).length > 0

  const erase = () => {
    if (window.confirm('Стереть весь прогресс и разборы в этом браузере?')) clearMemory()
  }

  return (
    <main className="page progress">
      <p className="label">прогресс</p>
      <h1 className="progress__title">Что уже в фокусе</h1>
      <p className="progress__lead">
        Размытая точка — зона, где ответы пока плавают. Чем увереннее ты отвечаешь, тем резче она
        становится.
      </p>

      {scenarios.map((scenario) => (
        <section key={scenario.id} className="map">
          <header className="map__head">
            <h2 className="map__title">{scenario.title}</h2>
            <a className="label map__link" href={`#/train/${scenario.id}`}>
              тренировать <ArrowRight />
            </a>
          </header>
          <ul className="map__zones">
            {scenario.zones.map((zone) => {
              const value = mastery(memory, scenario.id, zone.id)
              const level = zoneLevel(value)
              return (
                <li key={zone.id} className="zone" data-level={level}>
                  <span className="zone__dot" aria-hidden="true" />
                  <span className="zone__title">{zone.title}</span>
                  <span className="label">
                    {LEVEL_TEXT[level]}
                    {value !== null && ` · ${Math.round(value * 100)}%`}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {open.length > 0 && (
        <section className="progress__section">
          <h2 className="label">ошибки, к которым вернёмся</h2>
          <div className="rows">
            {open.map(({ mistake, times }) => (
              <a key={mistake.id} className="row" href={`#/train/${mistake.scenario}`}>
                <span>
                  <span className="progress__item">{mistake.title}</span>
                  <span className="label">
                    {getScenario(mistake.scenario)?.title} · встретилась {times}{' '}
                    {times === 1 ? 'раз' : times < 5 ? 'раза' : 'раз'}
                  </span>
                </span>
                <ArrowRight />
              </a>
            ))}
          </div>
        </section>
      )}

      {memory.sessions.length > 0 && (
        <section className="progress__section">
          <h2 className="label">разборы тренировок</h2>
          <div className="rows">
            {memory.sessions.map((session) => {
              const total = session.items.reduce((sum, item) => sum + item.score, 0)
              return (
                <a key={session.id} className="row" href={`#/report/${session.id}`}>
                  <span>
                    <span className="progress__item">{getScenario(session.scenario)?.title}</span>
                    <span className="label">
                      {formatDate(session.date)} · {total} из {session.items.length * 3}
                    </span>
                  </span>
                  <ArrowRight />
                </a>
              )
            })}
          </div>
        </section>
      )}

      <footer className="progress__foot">
        <p className="disclaimer">
          Прогресс и разборы хранятся только в этом браузере. На сервер уходит текст вопроса или
          ответа — без имени, почты и других личных данных.
        </p>
        {hasData && (
          <button className="chip" onClick={erase}>
            Стереть мои данные
          </button>
        )}
      </footer>
    </main>
  )
}
