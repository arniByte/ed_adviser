import { useEffect } from 'react'
import { makeSpecimens } from '../lib/specimens'
import './Trail.css'

/** Расстояние в пикселях между соседними образцами в следе. */
const STEP = 90
const MIN_GAP_MS = 55
const LIFE_MS = 950
const MAX_ALIVE = 14

/** Фон — это пустое место страницы: сама страница, body или html, а не текст и кнопки. */
function onBackground(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return (
    target === document.body ||
    target === document.documentElement ||
    target.classList.contains('page') ||
    target.id === 'root'
  )
}

/**
 * След за курсором: когда мышь ведут по пустому фону, за ней всплывают и гаснут
 * картинки-организмы. Только для мыши и только без «уменьшить движение».
 */
export function Trail() {
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!fine.matches) return

    const layer = document.createElement('div')
    layer.className = 'trail'
    layer.setAttribute('aria-hidden', 'true')
    document.body.append(layer)

    let images: string[] | null = null
    let next = 0
    let alive = 0
    let lastX = 0
    let lastY = 0
    let lastAt = 0
    let travelled = 0

    const spawn = (x: number, y: number) => {
      images ??= makeSpecimens()
      if (!images.length || alive >= MAX_ALIVE) return
      const img = document.createElement('img')
      img.src = images[next++ % images.length]
      img.alt = ''
      const size = 120 + Math.random() * 70
      const turn = (Math.random() - 0.5) * 40
      img.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px`
      layer.append(img)
      alive++
      const animation = img.animate(
        [
          { opacity: 0, transform: `scale(0.35) rotate(${turn - 12}deg)`, filter: 'blur(6px)' },
          { opacity: 1, transform: `scale(1) rotate(${turn}deg)`, filter: 'blur(0)', offset: 0.18 },
          {
            opacity: 1,
            transform: `scale(1.02) rotate(${turn + 3}deg)`,
            filter: 'blur(0)',
            offset: 0.6,
          },
          { opacity: 0, transform: `scale(0.9) rotate(${turn + 8}deg)`, filter: 'blur(8px)' },
        ],
        { duration: LIFE_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      )
      animation.onfinish = () => {
        img.remove()
        alive--
      }
    }

    const onMove = (event: PointerEvent) => {
      if (still.matches || event.pointerType !== 'mouse') return
      const dx = event.clientX - lastX
      const dy = event.clientY - lastY
      lastX = event.clientX
      lastY = event.clientY
      if (!onBackground(event.target)) {
        travelled = 0
        return
      }
      travelled += Math.hypot(dx, dy)
      const now = performance.now()
      if (travelled < STEP || now - lastAt < MIN_GAP_MS) return
      travelled = 0
      lastAt = now
      spawn(event.clientX, event.clientY)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      layer.remove()
    }
  }, [])

  return null
}
