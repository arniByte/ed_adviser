import { getScenario, scenarios } from '../../../core/knowledge'
import {
  mastery,
  openMistakes,
  zoneLevel,
  type Memory,
  type ZoneLevel,
} from '../../../core/progress'
import { ArrowRight } from '../../components/icons'
import { STAGES } from '../../../core/profile'
import { clearMemory } from '../../lib/memory'
import { useProfile } from '../../lib/profile'
import { plural } from '../../lib/plural'
import { formatDate } from '../report/notes'
import './Progress.css'

const LEVEL_TEXT: Record<ZoneLevel, string> = {
  unknown: 'Не начато',
  weak: 'Плавает',
  growing: 'Проясняется',
  solid: 'Уверенно',
}

export function Progress({ memory }: { memory: Memory }) {
  const open = openMistakes(memory)
  const hasData = memory.sessions.length > 0 || Object.keys(memory.zones).length > 0
  const profile = useProfile()
  const about = [
    profile?.stage && STAGES[profile.stage],
    ...(profile?.goals ?? []).map((id) => getScenario(id)?.title),
  ].filter(Boolean)

  const erase = () => {
    if (window.confirm('Стереть весь прогресс и разборы в этом браузере?')) clearMemory()
  }

  return (
    <main className="page progress">
      <h1 className="display rise">Что уже в фокусе</h1>
      <p className="lead progress__lead rise" style={{ '--i': 1 } as React.CSSProperties}>
        Размытая точка — зона, где ответы пока плавают. Тренируешься — она обретает резкость.
      </p>
      <p className="caption progress__about rise" style={{ '--i': 2 } as React.CSSProperties}>
        {about.length > 0 ? `О тебе: ${about.join(' · ')}` : 'Наставник пока не знает о тебе'} ·{' '}
        <a href="#/hello">{about.length > 0 ? 'изменить' : 'рассказать'}</a>
      </p>

      {scenarios.map((scenario) => (
        <section key={scenario.id} className="map" data-scenario={scenario.id}>
          <header className="map__head">
            <h2 className="map__title">{scenario.title}</h2>
            <a className="btn btn--glass btn--small" href={`#/train/${scenario.id}`}>
              Тренировать <ArrowRight />
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
                  <span className="caption">
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
          <h2 className="caption">Ошибки, к которым вернёмся</h2>
          <div className="rows">
            {open.map(({ mistake, times }) => (
              <a key={mistake.id} className="row" href={`#/train/${mistake.scenario}`}>
                <span>
                  <span className="row__title">{mistake.title}</span>
                  <span className="caption">
                    {getScenario(mistake.scenario)?.title} · встретилась {times}{' '}
                    {plural(times, ['раз', 'раза', 'раз'])}
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
          <h2 className="caption">Разборы тренировок</h2>
          <div className="rows">
            {memory.sessions.map((session) => {
              const total = session.items.reduce((sum, item) => sum + item.score, 0)
              return (
                <a key={session.id} className="row" href={`#/report/${session.id}`}>
                  <span>
                    <span className="row__title">{getScenario(session.scenario)?.title}</span>
                    <span className="caption">
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
          Прогресс и разборы хранятся в этом браузере. Текст вопроса или ответа и профиль передаются
          модели. Не добавляй лишние личные сведения.
        </p>
        {hasData && (
          <button className="btn btn--glass btn--small" onClick={erase}>
            Стереть прогресс и разборы
          </button>
        )}
      </footer>
    </main>
  )
}
