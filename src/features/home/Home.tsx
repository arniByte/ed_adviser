import { scenarios, zoneTitle } from '../../../core/knowledge'
import { mastery, openMistakes, type Memory } from '../../../core/progress'
import { Composer } from '../../components/Composer'
import { Disclaimer } from '../../components/Disclaimer'
import { ArrowRight } from '../../components/icons'
import { Orb } from '../../components/Orb'
import { go } from '../../lib/route'
import './Home.css'

interface Props {
  memory: Memory
  onAsk: (question: string) => void
}

/** Что напомнить вернувшемуся пользователю: незакрытая ошибка важнее слабой зоны. */
function reminder(memory: Memory) {
  const [first] = openMistakes(memory)
  if (first) {
    return {
      scenario: first.mistake.scenario,
      text: `Осталась незакрытая ошибка: ${first.mistake.title.toLowerCase()}. Начнём с неё?`,
    }
  }
  const weakest = scenarios
    .flatMap((s) =>
      s.zones.map((z) => ({ scenario: s.id, zone: z.id, value: mastery(memory, s.id, z.id) })),
    )
    .filter((z) => z.value !== null && z.value < 0.84)
    .sort((a, b) => a.value! - b.value!)[0]
  if (!weakest) return null
  return {
    scenario: weakest.scenario,
    text: `Слабее всего пока зона «${zoneTitle(weakest.scenario, weakest.zone)}». Подтянем?`,
  }
}

export function Home({ memory, onAsk }: Props) {
  const back = reminder(memory)

  return (
    <main className="page home">
      <div className="home__hero">
        <Orb className="home__orb" />
        <p className="label home__tag">// тренажёр перед настоящим</p>
      </div>

      <h1 className="home__title">Сначала — начерно.</h1>
      <p className="home__lead">
        Наставник задаст неудобные вопросы раньше приёмной комиссии и рекрутера, разберёт твой ответ
        и покажет, как сказать лучше.
      </p>

      {back && (
        <button className="home__back glass focus-in" onClick={() => go(`/train/${back.scenario}`)}>
          <span>
            <span className="label">с прошлого раза</span>
            <span className="home__back-text">{back.text}</span>
          </span>
          <ArrowRight />
        </button>
      )}

      <section className="home__section">
        <h2 className="label">тренажёр · выбери сценарий</h2>
        <div className="rows">
          {scenarios.map((scenario) => (
            <a key={scenario.id} className="row" href={`#/train/${scenario.id}`}>
              <span>
                <span className="home__scenario">{scenario.title}</span>
                <span className="home__scenario-lead">{scenario.lead}</span>
              </span>
              <ArrowRight />
            </a>
          ))}
        </div>
      </section>

      <section className="home__section">
        <h2 className="label">справка · спроси что угодно по теме</h2>
        <Composer placeholder="Например: как расставить приоритеты?" onSubmit={onAsk} />
      </section>

      <footer className="home__footer">
        <Disclaimer />
      </footer>
    </main>
  )
}
