import { scenarios, zoneTitle } from '../../../core/knowledge'
import { mastery, openMistakes, type Memory } from '../../../core/progress'
import { AuraMark } from '../../components/AuraMark'
import { Composer } from '../../components/Composer'
import { Disclaimer } from '../../components/Disclaimer'
import { ArrowRight } from '../../components/icons'
import { useProfile } from '../../lib/profile'
import { ScenarioDeck } from './ScenarioDeck'
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

export function Home({ memory, onAsk }: Props) {
  const back = reminder(memory)
  const profile = useProfile()

  return (
    <main className="page home">
      <div className="home__hero rise">
        <AuraMark size={184} />
      </div>

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

      <div className="home__deck rise" style={{ '--i': 3 } as React.CSSProperties}>
        <ScenarioDeck first={profile?.goals?.[0]} />
      </div>

      <footer className="home__footer">
        <Disclaimer />
      </footer>

      <Composer docked placeholder="Спроси наставника…" onSubmit={onAsk} />
    </main>
  )
}
