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
  /** Пока человек говорит: громкость от 0 до 1. Знак слушает и дышит в такт голосу. */
  listen?: () => number
  /** Точки в пастельных цветах по кругу — так знак-кнопку видно на светлом фоне. */
  tint?: boolean
}

/** Самый маленький знак — логотип: точек меньше, иначе они слипаются. */
const SMALL = 72

/** Уровни прозрачности точек: глазу хватает, а рисовать по уровням быстро. */
const LEVELS = 12

/** Поле вокруг живого знака, в долях его размера: туда разлетаются точки. */
const PAD = 0.3

const smoothstep = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

/** Разность углов, приведённая к −π…π. */
const angleGap = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b))

/**
 * Две волны обходят живой контур кольца, а рябь расходится от центра.
 * На маленьком знаке контур шире, чтобы движение читалось без мелких деталей.
 */
function halo(r: number, angle: number, t: number, energy: number, small: boolean) {
  const breath = Math.sin(t * 1.05) * (small ? 0.065 : 0.045)
  const contour =
    0.76 + breath + Math.sin(angle * 3 - t * 0.75) * 0.04 + Math.cos(angle * 5 + t) * 0.02
  const ring = Math.exp(-(((r - contour) / (small ? 0.18 : 0.12)) ** 2))
  const orbit = Math.exp(-((angleGap(angle, t * 0.9) / 0.65) ** 2))
  const returnWave = Math.exp(-((angleGap(angle, -t * 0.6 + Math.PI) / 0.9) ** 2))
  const ripple = (0.5 + 0.5 * Math.cos(r * 14 - t * 2.2 + Math.sin(angle * 2 - t * 0.4))) ** 4
  const rim = smoothstep(0.35, 0.6, r) * (1 - smoothstep(0.9, 1, r))
  const sweep =
    energy *
    Math.exp(-((angleGap(angle, t * 2.4) / 0.7) ** 2)) *
    Math.exp(-(((r - 0.8) / 0.2) ** 2))
  // Внутри круга — едва заметное зерно, чтобы лицо держалось на сетке, а не в пустоте.
  const ground = 0.05 * (1 - smoothstep(0.6, 0.95, r))
  return Math.min(
    1,
    Math.max(
      ground,
      ring * (0.24 + orbit * 0.68 + returnWave * 0.35) + ripple * rim * 0.24 + sweep * 0.65,
    ),
  )
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

interface Face {
  /** Смещение взгляда, от −1 до 1. */
  lookX: number
  lookY: number
  /** Насколько открыты глаза: 1 — открыты, 0 — закрыты. */
  open: number
  happy: boolean
}

/**
 * Глаза — не рисунок поверх, а форма, которую принимают те же точки сетки: внутри
 * овала глаза точка вырастает до полной, в блике — гаснет. Двигаются глаза — точки
 * перетекают за ними; моргают — овал сплющивается, и точки сжимаются.
 */
function eyes(x: number, y: number, face: Face, cell: number) {
  let value = 0
  for (const side of [-1, 1]) {
    const cx = side * 0.29 + face.lookX * 0.12
    const cy = -0.04 + face.lookY * 0.09
    const dx = x - cx
    const dy = y - cy
    if (face.happy) {
      // Улыбка глазами: дуга, выгнутая вверх.
      const arc = Math.abs(Math.hypot(dx, dy - 0.1) - 0.14)
      const upper = dy - 0.1 < 0.01 ? 1 : 0
      value = Math.max(value, upper * (1 - smoothstep(0.03, 0.07, arc)))
      continue
    }
    const a = 0.14
    const b = Math.max(0.035, 0.25 * face.open)
    const d = (dx / a) ** 2 + (dy / b) ** 2
    let eye = 1 - smoothstep(0.7, 1.15, d)
    // Блик — одна погасшая точка у верхнего края.
    const glint = Math.hypot(dx + 0.035 - face.lookX * 0.02, dy + b * 0.42)
    if (face.open > 0.7 && glint < cell * 0.75) eye *= 0.05
    value = Math.max(value, eye)
  }
  return value
}

/**
 * Знак — круг из точек: ореол у края и лицо в середине. Глаза следят за курсором,
 * смотрят в поле, пока ты печатаешь, бегают, пока наставник думает, моргают
 * и улыбаются при наведении.
 */
export function Mark({
  size,
  mood = 'idle',
  eyes: withFace = true,
  className = '',
  label,
  listen,
  tint = false,
}: Props) {
  const listenRef = useRef(listen)
  listenRef.current = listen
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const moodRef = useRef<MarkMood>(mood)
  const hoverRef = useRef(false)
  // Курсор над знаком (в долях радиуса) и последний клик — для разлёта точек.
  const pokeRef = useRef<{ x: number; y: number; inside: boolean; burstAt: number }>({
    x: 0,
    y: 0,
    inside: false,
    burstAt: -1,
  })
  moodRef.current = mood

  useEffect(() => {
    const canvas = canvasRef.current!
    const context = canvas.getContext('2d')!
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const small = size < SMALL
    const withEyes = withFace && !small
    // У живого знака холст шире самого круга: разлетевшимся точкам есть куда лететь.
    const pad = withEyes ? PAD : 0
    const inner = Math.round(size * ratio)
    const margin = Math.round(inner * pad)
    canvas.width = inner + margin * 2
    canvas.height = inner + margin * 2
    let ink: string | CanvasGradient = getComputedStyle(canvas).color
    if (tint && 'createConicGradient' in context) {
      const c = canvas.width / 2
      const gradient = context.createConicGradient(-Math.PI / 2, c, c)
      ;['#8b7cf6', '#ec6fae', '#f59e5b', '#3fbf95', '#5aa7f0', '#8b7cf6'].forEach((color, i, all) =>
        gradient.addColorStop(i / (all.length - 1), color),
      )
      ink = gradient
    }
    // Сетка частая: из неё должны собираться глаза.
    const cols = small ? 9 : Math.max(21, Math.round(size / 6)) | 1
    const cell = inner / cols
    const cellNorm = 2 / cols
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    // Живой знак идёт с частотой экрана, маленькому логотипу хватает 30 кадров.
    const fps = small ? 30 : 120

    // Каждая точка догоняет свою цель с инерцией: формы перетекают, а не прыгают.
    const current = new Float32Array(cols * cols)
    // Смещение и скорость каждой точки: пружина тянет её обратно на место сетки.
    const offsetX = new Float32Array(cols * cols)
    const offsetY = new Float32Array(cols * cols)
    const speedX = new Float32Array(cols * cols)
    const speedY = new Float32Array(cols * cols)
    let lastBurst = -1
    const points: { x: number; y: number; r: number; angle: number; i: number }[] = []
    for (let row = 0; row < cols; row++) {
      for (let col = 0; col < cols; col++) {
        const x = ((col + 0.5) / cols) * 2 - 1
        const y = ((row + 0.5) / cols) * 2 - 1
        if (x * x + y * y <= 1)
          points.push({ x, y, r: Math.hypot(x, y), angle: Math.atan2(y, x), i: row * cols + col })
      }
    }

    if (withEyes && listeners++ === 0) {
      window.addEventListener('pointermove', onPointer, { passive: true })
      document.addEventListener('input', onInput, true)
    }

    let energy = 0
    let visible = true
    let frame = 0
    let last = 0
    const start = performance.now()
    const face: Face = { lookX: 0, lookY: 0, open: 1, happy: false }
    let nextBlink = start + 1800
    let blinkAt = -1

    const updateFace = (now: number) => {
      const mood = hoverRef.current ? 'happy' : moodRef.current
      face.happy = mood === 'happy' || !!listenRef.current
      let tx = 0
      let ty = 0
      if (listenRef.current) {
        // Слушает: смотрит на собеседника и чуть кивает.
        tx = Math.sin(now / 900) * 0.15
        ty = 0.15 + Math.sin(now / 330) * 0.12
      } else if (mood === 'thinking') {
        tx = Math.sin(now / 420) * 0.9
        ty = -0.4
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
      face.lookX += (tx - face.lookX) * ease(0.12)
      face.lookY += (ty - face.lookY) * ease(0.12)

      if (now > nextBlink && blinkAt < 0) blinkAt = now
      face.open = 1
      if (blinkAt >= 0) {
        const k = (now - blinkAt) / 220
        face.open = k < 1 ? Math.abs(1 - 2 * k) : 1
        if (k >= 1) {
          blinkAt = -1
          nextBlink = now + 2600 + Math.random() * 3400
        }
      }
    }

    const buckets: number[][] = Array.from({ length: LEVELS }, () => [])
    let previousNow = 0
    /** Доля пути к цели за кадр — одинаковая на 30, 60 и 120 Гц. */
    let ease = (k: number) => k
    const draw = (now: number, settle = false) => {
      // Метки времени rAF бывают чуть раньше performance.now(): шаг не уходит в минус.
      const step = previousNow ? Math.min(0.05, Math.max(0, (now - previousNow) / 1000)) : 1 / 60
      previousNow = Math.max(previousNow, now)
      ease = (k: number) => 1 - (1 - k) ** (step * 30)
      const t = (now - start) / 1000
      const voice = listenRef.current?.()
      const target =
        voice !== undefined
          ? Math.min(1, 0.25 + voice * 2.5)
          : moodRef.current === 'thinking'
            ? 1
            : 0
      energy += (target - energy) * ease(voice !== undefined ? 0.25 : 0.06)
      if (withEyes && !motion.matches) updateFace(now)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = ink

      const poke = pokeRef.current
      const burst = withEyes && poke.burstAt !== lastBurst
      lastBurst = poke.burstAt
      const dt = step
      for (const point of points) {
        if (!withEyes || settle) continue
        const i = point.i
        let fx = -140 * offsetX[i] - 13 * speedX[i]
        let fy = -140 * offsetY[i] - 13 * speedY[i]
        const dx = point.x + offsetX[i] - poke.x
        const dy = point.y + offsetY[i] - poke.y
        const distance = Math.hypot(dx, dy) || 0.001
        // Курсор расталкивает ближние точки, как палец воду.
        if (poke.inside && distance < 0.5) {
          const push = 340 * (1 - distance / 0.5) ** 2
          fx += (dx / distance) * push
          fy += (dy / distance) * push
        }
        // Клик — взрыв: всем точкам толчок от места клика, ближним сильнее.
        if (burst) {
          const kick = 8 * Math.max(0.3, 1.3 - distance) * (0.7 + Math.random() * 0.6)
          speedX[i] += (dx / distance) * kick + (Math.random() - 0.5) * 1.2
          speedY[i] += (dy / distance) * kick + (Math.random() - 0.5) * 1.2
        }
        speedX[i] += fx * dt
        speedY[i] += fy * dt
        offsetX[i] += speedX[i] * dt
        offsetY[i] += speedY[i] * dt
      }

      // Точки одной прозрачности рисуются одним путём: это в разы быстрее, чем fill на каждую.
      for (const path of buckets) path.length = 0
      const follow = ease(0.38)
      for (const point of points) {
        let value = halo(point.r, point.angle, t, energy, small)
        if (withEyes) value = Math.max(value, eyes(point.x, point.y, face, cellNorm))
        const previous = current[point.i]
        const raw = settle ? value : previous + (value - previous) * follow
        const next = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0
        current[point.i] = next
        const radius = cell * 0.47 * (0.08 + 0.92 * Math.sqrt(next))
        if (radius < 0.35) continue
        buckets[Math.min(LEVELS - 1, Math.round(next * (LEVELS - 1)))].push(
          margin + (point.x + offsetX[point.i] + 1) * 0.5 * inner,
          margin + (point.y + offsetY[point.i] + 1) * 0.5 * inner,
          radius,
        )
      }
      for (let level = 0; level < LEVELS; level++) {
        const dots = buckets[level]
        if (!dots.length) continue
        context.globalAlpha = 0.3 + (0.7 * level) / (LEVELS - 1)
        context.beginPath()
        for (let k = 0; k < dots.length; k += 3) {
          context.moveTo(dots[k] + dots[k + 2], dots[k + 1])
          context.arc(dots[k], dots[k + 1], dots[k + 2], 0, Math.PI * 2)
        }
        context.fill()
      }
      context.globalAlpha = 1
    }

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop)
      if (now - last < 1000 / fps) return
      last = now
      draw(now)
    }
    const run = () => {
      cancelAnimationFrame(frame)
      if (motion.matches) return draw(start + 1200, true)
      if (visible && !document.hidden) frame = requestAnimationFrame(loop)
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      run()
    })
    observer.observe(canvas)
    document.addEventListener('visibilitychange', run)
    motion.addEventListener('change', run)
    draw(start, true)
    run()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', run)
      motion.removeEventListener('change', run)
      if (withEyes && --listeners === 0) {
        window.removeEventListener('pointermove', onPointer)
        document.removeEventListener('input', onInput, true)
      }
    }
  }, [size, withFace, tint])

  const hover = (value: boolean) => () => {
    hoverRef.current = value
    pokeRef.current.inside = value
  }
  // Координаты курсора в долях радиуса круга (центр — 0, край — 1).
  const locate = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    pokeRef.current.x = ((event.clientX - box.left) / box.width - 0.5) * 2 * (1 + 2 * PAD)
    pokeRef.current.y = ((event.clientY - box.top) / box.height - 0.5) * 2 * (1 + 2 * PAD)
  }
  const live = withFace && size >= SMALL

  return (
    <canvas
      ref={canvasRef}
      className={`mark ${className}`}
      style={
        live
          ? { width: size * (1 + 2 * PAD), height: size * (1 + 2 * PAD), margin: -size * PAD }
          : { width: size, height: size }
      }
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      onPointerEnter={hover(true)}
      onPointerLeave={hover(false)}
      onPointerMove={live ? locate : undefined}
      onPointerDown={
        live
          ? (event) => {
              locate(event)
              pokeRef.current.burstAt = performance.now()
            }
          : undefined
      }
    />
  )
}
