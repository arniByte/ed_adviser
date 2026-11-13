import { useEffect, useRef, useState } from 'react'
import { cases, scenarios } from '../../../core/knowledge'
import { Aura } from '../../components/Aura'
import { ArrowRight } from '../../components/icons'
import { SCENARIO_PALETTE } from '../../lib/aura'
import { CASES, plural } from '../../lib/plural'
import './ScenarioDeck.css'

const count = (id: string) => cases.filter((c) => c.scenario === id).length

/**
 * Сценарии — колода карточек на цилиндре: листаешь свайпом, карточка в центре
 * стоит прямо, соседние поворачиваются и уходят вглубь.
 */
export function ScenarioDeck() {
  const track = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const element = track.current!
    let frame = 0
    const update = () => {
      frame = 0
      const center = element.scrollLeft + element.clientWidth / 2
      let nearest = 0
      let best = Infinity
      Array.from(element.children).forEach((child, index) => {
        const card = child as HTMLElement
        const offset = (card.offsetLeft + card.offsetWidth / 2 - center) / card.offsetWidth
        card.style.setProperty('--d', offset.toFixed(3))
        if (Math.abs(offset) < best) {
          best = Math.abs(offset)
          nearest = index
        }
      })
      setCurrent(nearest)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    // На широком экране начинаем со средней карточки, на телефоне — с первой.
    if (element.scrollWidth > element.clientWidth && element.clientWidth > 600) {
      const middle = element.children[1] as HTMLElement
      element.scrollLeft = middle.offsetLeft + middle.offsetWidth / 2 - element.clientWidth / 2
    }
    update()
    element.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      element.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  const goTo = (index: number) => {
    const card = track.current!.children[index] as HTMLElement
    card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  return (
    <nav className="deck" aria-label="Сценарии тренажёра">
      <div ref={track} className="deck__track">
        {scenarios.map((scenario, index) => (
          <a
            key={scenario.id}
            className="deck__card"
            href={`#/train/${scenario.id}`}
            aria-current={index === current ? 'true' : undefined}
          >
            <Aura
              className="deck__aura"
              palette={SCENARIO_PALETTE[scenario.id]}
              seed={index + 2}
              bands={6}
              fps={18}
            />
            <span className="deck__body">
              <span className="deck__title">{scenario.title}</span>
              <span className="deck__lead">{scenario.lead}</span>
              <span className="deck__foot">
                {count(scenario.id)} {plural(count(scenario.id), CASES)}
                <span className="deck__go" aria-hidden="true">
                  <ArrowRight />
                </span>
              </span>
            </span>
          </a>
        ))}
      </div>
      <div className="deck__dots">
        {scenarios.map((scenario, index) => (
          <button
            key={scenario.id}
            type="button"
            className="deck__dot"
            aria-label={scenario.title}
            aria-current={index === current ? 'true' : undefined}
            onClick={() => goTo(index)}
          />
        ))}
      </div>
    </nav>
  )
}
