/**
 * Образцы для следа за курсором: радиальные «организмы» — актиния, радужка, коралл,
 * солнце. Рисуются один раз на холсте при первом движении мыши, дальше это просто
 * картинки, которые браузер показывает без перерисовки.
 */

type Rgb = [number, number, number]

const PALETTES: Rgb[][] = [
  [
    [36, 52, 150],
    [130, 90, 230],
    [238, 84, 160],
    [255, 196, 120],
  ],
  [
    [16, 80, 110],
    [40, 168, 160],
    [130, 222, 196],
    [220, 255, 236],
  ],
  [
    [120, 10, 20],
    [230, 40, 30],
    [255, 150, 30],
    [255, 236, 120],
  ],
  [
    [30, 40, 90],
    [104, 170, 250],
    [196, 176, 255],
    [255, 222, 196],
  ],
  [
    [60, 20, 70],
    [200, 70, 160],
    [250, 140, 120],
    [255, 230, 200],
  ],
]

const rgba = ([r, g, b]: Rgb, a: number) => `rgba(${r},${g},${b},${a})`
const mix = (a: Rgb, b: Rgb, k: number): Rgb => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
]

/** Предсказуемый генератор: образцы одинаковые от загрузки к загрузке. */
function random(seed: number) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

type Draw = (c: CanvasRenderingContext2D, size: number, palette: Rgb[], rnd: () => number) => void

/** Актиния: множество щупалец от тёмного центра к светлым кончикам. */
const anemone: Draw = (c, size, p, rnd) => {
  const R = size / 2
  c.translate(R, R)
  const count = 70 + Math.floor(rnd() * 50)
  c.lineCap = 'round'
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rnd() * 0.08
    const length = R * (0.55 + rnd() * 0.4)
    const bend = (rnd() - 0.5) * 0.5
    const gradient = c.createLinearGradient(
      0,
      0,
      Math.cos(angle) * length,
      Math.sin(angle) * length,
    )
    gradient.addColorStop(0, rgba(p[0], 0.9))
    gradient.addColorStop(0.45, rgba(p[1], 0.85))
    gradient.addColorStop(0.8, rgba(p[2], 0.8))
    gradient.addColorStop(1, rgba(p[3], 0.9))
    c.strokeStyle = gradient
    c.lineWidth = R * (0.025 + rnd() * 0.03)
    c.beginPath()
    c.moveTo(0, 0)
    c.quadraticCurveTo(
      Math.cos(angle + bend) * length * 0.6,
      Math.sin(angle + bend) * length * 0.6,
      Math.cos(angle) * length,
      Math.sin(angle) * length,
    )
    c.stroke()
  }
  const core = c.createRadialGradient(0, 0, 0, 0, 0, R * 0.32)
  core.addColorStop(0, 'rgba(8,8,14,0.95)')
  core.addColorStop(0.6, rgba(p[0], 0.85))
  core.addColorStop(1, rgba(p[1], 0))
  c.fillStyle = core
  c.beginPath()
  c.arc(0, 0, R * 0.32, 0, Math.PI * 2)
  c.fill()
}

/** Радужка медузы: светлый диск с тонкими лучами и тёмной половиной. */
const iris: Draw = (c, size, p, rnd) => {
  const R = size / 2
  c.translate(R, R)
  const body = c.createRadialGradient(-R * 0.1, 0, R * 0.05, 0, 0, R * 0.9)
  body.addColorStop(0, rgba(p[0], 0.95))
  body.addColorStop(0.45, rgba(p[1], 0.8))
  body.addColorStop(0.8, rgba(p[2], 0.75))
  body.addColorStop(1, rgba(p[3], 0.9))
  c.fillStyle = body
  c.beginPath()
  c.arc(0, 0, R * 0.9, 0, Math.PI * 2)
  c.fill()
  // Тёмная половина, как зрачок медузы: смещена вбок, край мягкий.
  const pupil = c.createRadialGradient(R * 0.22, 0, 0, R * 0.22, 0, R * 0.6)
  pupil.addColorStop(0, 'rgba(24,10,16,0.92)')
  pupil.addColorStop(0.55, 'rgba(60,24,30,0.55)')
  pupil.addColorStop(1, 'rgba(60,24,30,0)')
  c.fillStyle = pupil
  c.beginPath()
  c.arc(0, 0, R * 0.88, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = 'rgba(255,255,255,0.35)'
  c.lineWidth = 1
  const rays = 48 + Math.floor(rnd() * 40)
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2
    c.beginPath()
    c.moveTo(Math.cos(a) * R * 0.12, Math.sin(a) * R * 0.12)
    c.lineTo(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86)
    c.stroke()
  }
  c.strokeStyle = rgba(p[3], 0.9)
  c.lineWidth = R * 0.03
  c.beginPath()
  c.arc(0, 0, R * 0.88, 0, Math.PI * 2)
  c.stroke()
}

/** Коралл: лепестки по кругу, каждый со своим тепловым пятном. */
const coral: Draw = (c, size, p, rnd) => {
  const R = size / 2
  c.translate(R, R)
  const heart = c.createRadialGradient(0, 0, 0, 0, 0, R * 0.3)
  heart.addColorStop(0, rgba(p[3], 0.95))
  heart.addColorStop(1, rgba(p[2], 0.2))
  c.fillStyle = heart
  c.beginPath()
  c.arc(0, 0, R * 0.3, 0, Math.PI * 2)
  c.fill()
  const lobes = 12 + Math.floor(rnd() * 8)
  for (let ring = 0; ring < 2; ring++) {
    for (let i = 0; i < lobes; i++) {
      const a = (i / lobes) * Math.PI * 2 + ring * (Math.PI / lobes)
      const d = R * (ring ? 0.32 : 0.6)
      const r = R * (ring ? 0.2 : 0.28)
      const x = Math.cos(a) * d
      const y = Math.sin(a) * d
      const g = c.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, rgba(p[3], 0.95))
      g.addColorStop(0.35, rgba(p[2], 0.85))
      g.addColorStop(0.75, rgba(p[1], 0.7))
      g.addColorStop(1, rgba(p[0], 0))
      c.fillStyle = g
      c.beginPath()
      c.ellipse(x, y, r, r * 0.8, a, 0, Math.PI * 2)
      c.fill()
    }
  }
}

/** Солнце: огненные язычки вокруг тёмной середины. */
const sun: Draw = (c, size, p, rnd) => {
  const R = size / 2
  c.translate(R, R)
  const flames = 26 + Math.floor(rnd() * 14)
  for (let i = 0; i < flames; i++) {
    const a = (i / flames) * Math.PI * 2 + rnd() * 0.1
    const length = R * (0.7 + rnd() * 0.25)
    const width = R * (0.12 + rnd() * 0.06)
    c.save()
    c.rotate(a)
    const g = c.createLinearGradient(R * 0.25, 0, length, 0)
    g.addColorStop(0, rgba(p[1], 0.95))
    g.addColorStop(0.6, rgba(p[2], 0.9))
    g.addColorStop(1, rgba(p[3], 0))
    c.fillStyle = g
    c.beginPath()
    c.moveTo(R * 0.25, -width / 2)
    c.quadraticCurveTo(length * 0.7, -width * 0.6, length, 0)
    c.quadraticCurveTo(length * 0.7, width * 0.6, R * 0.25, width / 2)
    c.fill()
    c.restore()
  }
  const core = c.createRadialGradient(0, 0, 0, 0, 0, R * 0.32)
  core.addColorStop(0, 'rgba(10,8,10,0.95)')
  core.addColorStop(0.62, 'rgba(10,8,10,0.9)')
  core.addColorStop(1, rgba(p[1], 0))
  c.fillStyle = core
  c.beginPath()
  c.arc(0, 0, R * 0.32, 0, Math.PI * 2)
  c.fill()
}

const SHAPES = [anemone, iris, coral, sun]

/** Набор картинок-образцов: каждая форма в нескольких палитрах. */
export function makeSpecimens(size = 200): string[] {
  const out: string[] = []
  let seed = 1
  for (const shape of SHAPES) {
    for (let k = 0; k < 3; k++) {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      const context = canvas.getContext('2d')
      if (!context) return out
      const palette = PALETTES[(seed + k * 2) % PALETTES.length]
      // Лёгкое смешение соседних цветов, чтобы образцы одной формы не были близнецами.
      const shifted = palette.map((color, i) =>
        mix(color, palette[(i + 1) % palette.length], 0.12 * k),
      )
      context.filter = 'blur(0.6px)'
      shape(context, size, shifted, random(seed++))
      out.push(canvas.toDataURL('image/png'))
    }
  }
  return out
}
