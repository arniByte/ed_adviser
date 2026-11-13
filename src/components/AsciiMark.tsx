import { useEffect, useRef } from 'react'
import { AURA_SIZE, paintAura } from '../lib/aura'
import './AsciiMark.css'

export type MarkMood = 'idle' | 'thinking' | 'happy'

interface Props {
  /** Диаметр в CSS-пикселях. */
  size: number
  mood?: MarkMood
  /** Показывать лицо в центре круга. */
  face?: boolean
  /** Улыбается при наведении и нажатии. */
  playful?: boolean
  /** Красить буквы плывущим градиентом вместо цвета текста. */
  tint?: boolean
  className?: string
  label?: string
}

/**
 * Волны собраны из букв названия: каждая буква — отдельный кадр атласа.
 * Точка нужна для самых тихих мест волны, где буква была бы шумом.
 */
const GLYPHS = '·черновик'
const LETTERS = GLYPHS.length - 1

const FACES: Record<MarkMood, string[]> = {
  idle: ['(◕‿◕)'],
  thinking: ['(•_•)', '( •_•)', '(•_• )', '(•‿•)'],
  happy: ['(◕‿◕✿)'],
}
const BLINK = '(–‿–)'

/** Мелкий знак рисуется точками: символы в тридцать пикселей не читаются. */
const DOTS_BELOW = 72

interface Field {
  cols: number
  cell: number
}

function layout(size: number): Field {
  const cols = size < DOTS_BELOW ? 9 : Math.max(13, Math.round(size / 11))
  return { cols, cell: size / cols }
}

/** Значение волны в точке круга, от 0 до 1. Край круга мягко растворяется. */
function wave(x: number, y: number, t: number, energy: number) {
  const r = Math.hypot(x, y)
  const angle = Math.atan2(y, x)
  const ripple = Math.sin(r * 8 - t * (1.4 + energy * 2.6) + 1.1 * Math.sin(angle * 2 + t * 0.35))
  const fade = 1 - Math.max(0, (r - 0.72) / 0.28) ** 2
  return Math.max(0, (0.5 + 0.5 * ripple) * fade)
}

/**
 * Какая буква стоит в клетке. Каждое кольцо — слово «черновик», бегущее по окружности;
 * соседние кольца вращаются в разные стороны, как надписи на печати.
 */
function letterAt(x: number, y: number, t: number, energy: number, cols: number) {
  const ring = Math.round((Math.hypot(x, y) * cols) / 2)
  const along = (Math.atan2(y, x) + Math.PI) * ring
  const direction = ring % 2 === 0 ? 1 : -1
  const position = Math.floor(along + direction * t * (1.2 + energy * 3))
  return 1 + (((position % LETTERS) + LETTERS) % LETTERS)
}

function buildAtlas(cell: number, ratio: number, color: string) {
  const atlas = document.createElement('canvas')
  const side = Math.ceil(cell * ratio)
  atlas.width = side * GLYPHS.length
  atlas.height = side
  const context = atlas.getContext('2d')!
  context.fillStyle = color
  context.font = `500 ${side * 0.86}px ui-monospace, Menlo, Consolas, monospace`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  for (let i = 0; i < GLYPHS.length; i++) {
    context.fillText(GLYPHS[i], side * i + side / 2, side / 2 - side * 0.04)
  }
  return { atlas, side }
}

export function AsciiMark({
  size,
  mood = 'idle',
  face = true,
  playful = false,
  tint = false,
  className = '',
  label,
}: Props) {
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
    const { cols, cell } = layout(size)
    const dots = size < DOTS_BELOW
    const { atlas, side } = dots ? { atlas: null, side: 0 } : buildAtlas(cell, ratio, ink)
    const faceFont = `600 ${size * 0.105 * ratio}px ui-monospace, Menlo, Consolas, monospace`
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fps = dots ? 15 : 30

    // Градиент считается на крошечном холсте и растягивается поверх букв.
    const paint = tint ? document.createElement('canvas') : null
    const paintContext = paint?.getContext('2d')
    const paintImage = paintContext?.createImageData(AURA_SIZE, AURA_SIZE)
    if (paint) paint.width = paint.height = AURA_SIZE

    let energy = 0
    let visible = true
    let frame = 0
    let last = 0
    let start = performance.now()

    const currentFace = (now: number) => {
      const current = hoverRef.current ? 'happy' : moodRef.current
      const faces = FACES[current]
      if (current === 'thinking') return faces[Math.floor(now / 420) % faces.length]
      // Раз в несколько секунд лицо моргает.
      if (current === 'idle' && now % 3800 < 140) return BLINK
      return faces[0]
    }

    const draw = (now: number) => {
      const t = (now - start) / 1000
      const target = moodRef.current === 'thinking' ? 1 : 0
      energy += (target - energy) * 0.08
      context.clearRect(0, 0, canvas.width, canvas.height)

      const showFace = face && !dots
      for (let row = 0; row < cols; row++) {
        for (let col = 0; col < cols; col++) {
          const x = ((col + 0.5) / cols) * 2 - 1
          const y = ((row + 0.5) / cols) * 2 - 1
          if (x * x + y * y > 1) continue
          // Под лицом оставляем чистое поле, чтобы его было видно.
          if (showFace && (x / 0.5) ** 2 + (y / 0.17) ** 2 < 1) continue
          const value = wave(x, y, t, energy)
          if (dots) {
            const radius = value * cell * 0.46 * ratio
            if (radius < 0.35) continue
            context.globalAlpha = 0.35 + 0.65 * value
            context.beginPath()
            context.arc(
              (col + 0.5) * cell * ratio,
              (row + 0.5) * cell * ratio,
              radius,
              0,
              Math.PI * 2,
            )
            context.fillStyle = ink
            context.fill()
          } else {
            if (value < 0.06) continue
            const index = value < 0.32 ? 0 : letterAt(x, y, t, energy, cols)
            context.globalAlpha = (tint ? 0.3 : 0.16) + 0.7 * value
            context.drawImage(
              atlas!,
              index * side,
              0,
              side,
              side,
              col * cell * ratio,
              row * cell * ratio,
              side,
              side,
            )
          }
        }
      }

      if (paint && paintContext && paintImage) {
        paintAura(paintImage, t, { palette: 'ink', bands: 0, energy })
        paintContext.putImageData(paintImage, 0, 0)
        context.globalAlpha = 1
        context.globalCompositeOperation = 'source-in'
        context.drawImage(paint, 0, 0, canvas.width, canvas.height)
        context.globalCompositeOperation = 'source-over'
      }

      if (showFace) {
        context.globalAlpha = 1
        context.fillStyle = ink
        context.font = faceFont
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(currentFace(now), canvas.width / 2, canvas.height / 2)
      }
    }

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop)
      if (now - last < 1000 / fps) return
      last = now
      draw(now)
    }

    const run = () => {
      cancelAnimationFrame(frame)
      if (still) {
        draw(start + 1200)
        return
      }
      if (visible && !document.hidden) frame = requestAnimationFrame(loop)
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      run()
    })
    observer.observe(canvas)
    document.addEventListener('visibilitychange', run)
    start = performance.now()
    run()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', run)
    }
  }, [size, face, tint])

  const hover = (value: boolean) => () => {
    if (playful) hoverRef.current = value
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
      onPointerDown={hover(true)}
      onPointerUp={hover(false)}
    />
  )
}
