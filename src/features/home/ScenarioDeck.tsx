import { useEffect, useRef, useState } from 'react'
import { cases, scenarios } from '../../../core/knowledge'
import { Aura } from '../../components/Aura'
import { ArrowRight } from '../../components/icons'
import type { ScenarioId } from '../../../core/types'
import { SCENARIO_PALETTE } from '../../lib/aura'
import { CASES, plural } from '../../lib/plural'
import './ScenarioDeck.css'

const count = (id: string) => cases.filter((c) => c.scenario === id).length

/**
 * Сценарии — колода карточек на цилиндре: листаешь свайпом, карточка в центре
 * стоит прямо, соседние поворачиваются и уходят вглубь.
 */
export function ScenarioDeck({ first }: { first?: ScenarioId }) {
  const track = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)
  const currentRef = useRef(0)
  currentRef.current = current
  // Перетаскивание мышью: насколько сдвинули — чтобы отличить жест от клика.
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: 0 })

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
    // Начинаем со сценария из знакомства; без него на широком экране — со средней карточки.
    const index = first
      ? scenarios.findIndex((scenario) => scenario.id === first)
      : element.clientWidth > 600
        ? 1
        : 0
    const start = element.children[Math.max(0, index)] as HTMLElement
    element.scrollLeft = start.offsetLeft + start.offsetWidth / 2 - element.clientWidth / 2
    update()
    element.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)

    // Колесо мыши листает по одной карточке; у края колоды прокрутка достаётся странице.
    let lastWheel = 0
    const onWheel = (event: WheelEvent) => {
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      const step = Math.sign(delta)
      const next = currentRef.current + step
      if (!step || next < 0 || next >= scenarios.length) return
      event.preventDefault()
      const now = performance.now()
      if (now - lastWheel < 420) return
      lastWheel = now
      center(next)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      cancelAnimationFrame(frame)
      element.removeEventListener('scroll', schedule)
      element.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', schedule)
    }
  }, [first])

  const goTo = (index: number) => center(index)

  // Сдвиг только ленты, без прокрутки страницы.
  function center(index: number) {
    const element = track.current
    const card = element?.children[index] as HTMLElement | undefined
    if (!element || !card) return
    element.scrollTo({
      left: card.offsetLeft + card.offsetWidth / 2 - element.clientWidth / 2,
      behavior: 'smooth',
    })
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    const element = track.current!
    drag.current = {
      active: true,
      startX: event.clientX,
      startScroll: element.scrollLeft,
      moved: 0,
    }
  }
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state.active) return
    const element = track.current!
    state.moved = Math.max(state.moved, Math.abs(event.clientX - state.startX))
    if (state.moved > 4) {
      element.classList.add('deck__track--dragging')
      element.scrollLeft = state.startScroll - (event.clientX - state.startX)
    }
  }
  const endDrag = () => {
    const state = drag.current
    if (!state.active) return
    state.active = false
    const element = track.current!
    if (state.moved > 4) {
      element.classList.remove('deck__track--dragging')
      center(currentRef.current)
    }
  }
  // Клик по боковой карточке сначала выводит её в центр; клик после перетаскивания — не клик.
  const onCardClick = (index: number) => (event: React.MouseEvent) => {
    if (drag.current.moved > 4) {
      event.preventDefault()
      drag.current.moved = 0
      return
    }
    if (index !== currentRef.current) {
      event.preventDefault()
      center(index)
    }
  }

  return (
    <nav className="deck" aria-label="Сценарии тренажёра">
      <div
        ref={track}
        className="deck__track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onDragStart={(event) => event.preventDefault()}
      >
        {scenarios.map((scenario, index) => (
          <a
            key={scenario.id}
            className="deck__card"
            href={`#/train/${scenario.id}`}
            aria-current={index === current ? 'true' : undefined}
            onClick={onCardClick(index)}
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
