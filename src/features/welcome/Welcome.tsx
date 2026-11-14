import { useState } from 'react'
import { scenarios } from '../../../core/knowledge'
import { STAGES, type Profile, type Stage } from '../../../core/profile'
import type { ScenarioId } from '../../../core/types'
import { AuraMark } from '../../components/AuraMark'
import { ArrowRight } from '../../components/icons'
import { LIMITS } from '../../../core/protocol'
import { getProfile, saveProfile } from '../../lib/profile'
import { go } from '../../lib/route'
import './Welcome.css'

const STAGE_IDS = Object.keys(STAGES) as Stage[]

/**
 * Знакомство: три коротких вопроса, каждый появляется после ответа на предыдущий.
 * Ответы остаются в браузере и уходят на сервер только вместе с вопросом наставнику.
 */
export function Welcome() {
  const initial = getProfile() ?? {}
  const [stage, setStage] = useState<Stage | undefined>(initial.stage)
  const [goals, setGoals] = useState<ScenarioId[]>(initial.goals ?? [])
  const [about, setAbout] = useState(initial.about ?? '')

  const toggle = (id: ScenarioId) =>
    setGoals((list) => (list.includes(id) ? list.filter((g) => g !== id) : [...list, id]))

  const finish = (profile: Profile) => {
    saveProfile(profile)
    go('/')
  }

  return (
    <main className="page welcome">
      <div className="rise">
        <AuraMark size={150} palette="pastel" />
      </div>
      <h1 className="title welcome__title rise" style={{ '--i': 1 } as React.CSSProperties}>
        Привет! Я Черновик
      </h1>
      <p className="lead welcome__lead rise" style={{ '--i': 2 } as React.CSSProperties}>
        Расскажи пару слов о себе — подстрою советы под тебя.
      </p>

      <section className="welcome__step rise" style={{ '--i': 3 } as React.CSSProperties}>
        <h2 className="welcome__question">Кто ты сейчас?</h2>
        <div className="welcome__chips">
          {STAGE_IDS.map((id) => (
            <button
              key={id}
              className="btn btn--glass btn--small welcome__chip"
              aria-pressed={stage === id}
              onClick={() => setStage(id)}
            >
              {STAGES[id]}
            </button>
          ))}
        </div>
      </section>

      {stage && (
        <section className="welcome__step rise">
          <h2 className="welcome__question">Что впереди?</h2>
          <div className="welcome__chips">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                className="btn btn--glass btn--small welcome__chip"
                aria-pressed={goals.includes(scenario.id)}
                onClick={() => toggle(scenario.id)}
              >
                {scenario.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {stage && goals.length > 0 && (
        <section className="welcome__step rise">
          <h2 className="welcome__question" id="welcome-about">
            Пара слов о себе <span className="caption">— по желанию</span>
          </h2>
          <textarea
            aria-labelledby="welcome-about"
            className="welcome__about"
            rows={3}
            maxLength={LIMITS.aboutChars}
            value={about}
            placeholder="Например: 11 класс, Ставрополь, люблю биологию, боюсь собеседований"
            onChange={(event) => setAbout(event.target.value)}
          />
          <p className="caption">Без имени и контактов: ответы хранятся только в этом браузере.</p>
        </section>
      )}

      <div className="welcome__actions rise" style={{ '--i': 4 } as React.CSSProperties}>
        <button
          className="btn btn--primary"
          disabled={!stage}
          onClick={() => finish({ stage, goals, about })}
        >
          Готово <ArrowRight />
        </button>
        <button className="btn btn--glass" onClick={() => finish({})}>
          Пропустить
        </button>
      </div>
    </main>
  )
}
