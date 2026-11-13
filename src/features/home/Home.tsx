import { cases, scenarios, zoneTitle } from '../../../core/knowledge'
import { mastery, openMistakes, type Memory } from '../../../core/progress'
import { AuraMark } from '../../components/AuraMark'
import { Aura } from '../../components/Aura'
import { Composer } from '../../components/Composer'
import { Disclaimer } from '../../components/Disclaimer'
import { ArrowRight } from '../../components/icons'
import { SCENARIO_PALETTE } from '../../lib/aura'
import { CASES, plural } from '../../lib/plural'
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
      text: `Вернёмся к ошибке: ${first.mistake.title.toLowerCase()}`,
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
    text: `Подтянем зону «${zoneTitle(weakest.scenario, weakest.zone)}»`,
  }
}

const count = (id: string) => cases.filter((c) => c.scenario === id).length

export function Home({ memory, onAsk }: Props) {
  const back = reminder(memory)

  return (
    <main className="page home">
      <div className="home__hero rise">
        <AuraMark size={208} />
      </div>

      <h1 className="display home__title rise" style={{ '--i': 1 } as React.CSSProperties}>
        Сначала — начерно
      </h1>
      <p className="lead home__lead rise" style={{ '--i': 2 } as React.CSSProperties}>
        Отрепетируй поступление, собеседование и первый месяц на работе.
      </p>

      {back && (
        <a
          className="home__back btn btn--glass rise"
          style={{ '--i': 3 } as React.CSSProperties}
          href={`#/train/${back.scenario}`}
        >
          <span className="home__back-dot" aria-hidden="true" />
          {back.text}
          <ArrowRight />
        </a>
      )}

      <nav className="home__scenarios" aria-label="Сценарии тренажёра">
        {scenarios.map((scenario, index) => (
          <a
            key={scenario.id}
            className="home__scenario surface rise"
            style={{ '--i': 3 + index } as React.CSSProperties}
            href={`#/train/${scenario.id}`}
          >
            <Aura
              className="home__scenario-aura"
              palette={SCENARIO_PALETTE[scenario.id]}
              seed={index + 1}
              round
              bands={5}
              fps={16}
            />
            <span className="home__scenario-text">
              <span className="home__scenario-title">{scenario.title}</span>
              <span className="caption">
                {count(scenario.id)} {plural(count(scenario.id), CASES)}
              </span>
            </span>
            <ArrowRight />
          </a>
        ))}
      </nav>

      <div className="home__ask rise" style={{ '--i': 6 } as React.CSSProperties}>
        <Composer placeholder="Спроси наставника что угодно…" onSubmit={onAsk} />
      </div>

      <footer className="home__footer">
        <Disclaimer />
      </footer>
    </main>
  )
}
