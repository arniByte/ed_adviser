import { useEffect, useRef } from 'react'
import './Mark.css'

export type MarkMood = 'idle' | 'thinking' | 'happy'

interface Props {
  /** Диаметр в CSS-пикселях. */
  size: number
  mood?: MarkMood
  /** Показывать глаза. */
  eyes?: boolean
  className?: string
  label?: string
}

/** Самый маленький знак — логотип в шапке: точек меньше, иначе они слипаются. */
const SMALL = 72

/** Высота волны в точке круга, от 0 до 1. Край круга мягко растворяется. */
function wave(x: number, y: number, t: number, energy: number) {
  const r = Math.hypot(x, y)
  const angle = Math.atan2(y, x)
  const ripple = Math.sin(r * 8 - t * (1.4 + energy * 2.6) + 1.1 * Math.sin(angle * 2 + t * 0.35))
  const fade = 1 - Math.max(0, (r - 0.72) / 0.28) ** 2
  return Math.max(0, (0.5 + 0.5 * ripple) * fade)
}

/** Куда смотреть: на поле ввода, пока в нём печатают, иначе — на курсор. */
const gaze = { x: 0, y: 0, typedAt: 0, pointer: false }
let listeners = 0
const onPointer = (event: PointerEvent) => {
  gaze.x = event.clientX
  gaze.y = event.clientY
  gaze.pointer = true
}
const onInput = () => {
  gaze.typedAt = performance.now()
}

function lookTarget(): { x: number; y: number } | null {
  const active = document.activeElement
  if (active instanceof HTMLTextAreaElement && performance.now() - gaze.typedAt < 1600) {
    const box = active.getBoundingClientRect()
    return { x: box.left + Math.min(box.width - 24, active.value.length * 7 + 24), y: box.top + 20 }
  }
  return gaze.pointer ? gaze : null
}

/**
 * Знак — круг из точек, по которому бегут волны, и два глаза. Глаза следят за курсором,
 * смотрят в поле, пока ты печатаешь, бегают, пока наставник думает, и улыбаются при наведении.
 */
export function Mark({ size, mood = 'idle', eyes = true, className = '', label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const moodRef = useRef<MarkMood>(mood)
  const hoverRef = useRef(false)
  moodRef.current = mood

  useEffect(() => {
    const canvas = canvasRef.current!
    const context = canvas.getContext('2d')!
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(size * ratio)
    canvas.height = Math.round(size * ratio)
    const ink = getComputedStyle(canvas).color
    const small = size < SMALL
    const cols = small ? 9 : Math.max(15, Math.round(size / 9))
    const cell = (size * ratio) / cols
    const withEyes = eyes && !small
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fps = small ? 15 : 40

    if (withEyes && listeners++ === 0) {
      window.addEventListener('pointermove', onPointer, { passive: true })
      document.addEventListener('input', onInput, true)
    }

    let energy = 0
    let visible = true
    let frame = 0
    let last = 0
    const start = performance.now()
    // Взгляд догоняет цель с инерцией, моргание — по своему таймеру.
    const look = { x: 0, y: 0 }
    let nextBlink = start + 1800
    let blinkAt = -1

    const R = canvas.width / 2
    const eyeGap = R * 0.26
    const eyeW = R * 0.1
    const eyeH = R * 0.2
    const eyeY = -R * 0.04

    const drawEyes = (now: number) => {
      const current = hoverRef.current ? 'happy' : moodRef.current
      let tx = 0
      let ty = 0
      if (current === 'thinking') {
        tx = Math.sin(now / 380) * 0.9
        ty = -0.35
      } else {
        const target = lookTarget()
        if (target) {
          const box = canvas.getBoundingClientRect()
          const dx = target.x - (box.left + box.width / 2)
          const dy = target.y - (box.top + box.height / 2)
          const distance = Math.hypot(dx, dy) || 1
          const reach = Math.min(1, distance / 260)
          tx = (dx / distance) * reach
          ty = (dy / distance) * reach
        }
      }
      look.x += (tx - look.x) * 0.14
      look.y += (ty - look.y) * 0.14

      if (now > nextBlink && blinkAt < 0) blinkAt = now
      let open = 1
      if (blinkAt >= 0) {
        const k = (now - blinkAt) / 160
        open = k < 1 ? Math.abs(1 - 2 * k) * 0.9 + 0.1 : 1
        if (k >= 1) {
          blinkAt = -1
          nextBlink = now + 2600 + Math.random() * 3200
        }
      }

      context.globalAlpha = 1
      context.fillStyle = ink
      context.strokeStyle = ink
      const ox = look.x * R * 0.1
      const oy = look.y * R * 0.08
      for (const side of [-1, 1]) {
        const cx = R + side * eyeGap + ox
        const cy = R + eyeY + oy
        context.beginPath()
        if (current === 'happy') {
          // Улыбающиеся глаза — дуги вверх.
          context.lineWidth = eyeW * 0.8
          context.lineCap = 'round'
          context.arc(cx, cy + eyeH * 0.25, eyeW * 1.15, Math.PI * 1.15, Math.PI * 1.85)
          context.stroke()
        } else {
          context.ellipse(cx, cy, eyeW, eyeH * open, 0, 0, Math.PI * 2)
          context.fill()
          // Блик делает взгляд живым; при моргании прячется.
          if (open > 0.6) {
            context.fillStyle = 'rgba(255, 255, 255, 0.85)'
            context.beginPath()
            context.arc(
              cx - eyeW * 0.3 + look.x * eyeW * 0.25,
              cy - eyeH * 0.42,
              eyeW * 0.32,
              0,
              Math.PI * 2,
            )
            context.fill()
            context.fillStyle = ink
          }
        }
      }
    }

    const draw = (now: number) => {
      const t = (now - start) / 1000
      const target = moodRef.current === 'thinking' ? 1 : 0
      energy += (target - energy) * 0.08
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = ink

      for (let row = 0; row < cols; row++) {
        for (let col = 0; col < cols; col++) {
          const x = ((col + 0.5) / cols) * 2 - 1
          const y = ((row + 0.5) / cols) * 2 - 1
          if (x * x + y * y > 1) continue
          // Вокруг глаз — тихое поле, чтобы взгляд читался.
          if (withEyes && ((Math.abs(x) - 0.26) / 0.2) ** 2 + ((y + 0.04) / 0.3) ** 2 < 1) continue
          const value = wave(x, y, t, energy)
          const radius = (0.12 + 0.88 * value) * cell * 0.44
          if (radius < 0.4) continue
          context.globalAlpha = 0.28 + 0.72 * value
          context.beginPath()
          context.arc((col + 0.5) * cell, (row + 0.5) * cell, radius, 0, Math.PI * 2)
          context.fill()
        }
      }

      if (withEyes) drawEyes(now)
    }

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop)
      if (now - last < 1000 / fps) return
      last = now
      draw(now)
    }
    const run = () => {
      cancelAnimationFrame(frame)
      if (still) return draw(start + 1200)
      if (visible && !document.hidden) frame = requestAnimationFrame(loop)
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      run()
    })
    observer.observe(canvas)
    document.addEventListener('visibilitychange', run)
    draw(start)
    run()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', run)
      if (withEyes && --listeners === 0) {
        window.removeEventListener('pointermove', onPointer)
        document.removeEventListener('input', onInput, true)
      }
    }
  }, [size, eyes])

  const hover = (value: boolean) => () => {
    hoverRef.current = value
  }

  return (
    <canvas
      ref={canvasRef}
      className={`mark ${className}`}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      onPointerEnter={hover(true)}
      onPointerLeave={hover(false)}
    />
  )
}
