/**
 * Живая «аэрография»: несколько плывущих пятен складываются в поле, поле проходит
 * через палитру с полосами, как на тепловой карте. Считается на крошечном холсте,
 * а браузер растягивает его — размытие получается само и почти бесплатно.
 */

type Rgba = [number, number, number, number]
type Stop = [position: number, color: Rgba]

export type Palette = 'thermal' | 'pastel' | 'mint' | 'dusk'

const PALETTES: Record<Palette, Stop[]> = {
  thermal: [
    [0, [255, 255, 255, 0]],
    [0.22, [255, 236, 160, 0.85]],
    [0.4, [255, 176, 205, 1]],
    [0.58, [238, 84, 160, 1]],
    [0.72, [242, 92, 64, 1]],
    [0.86, [40, 168, 160, 1]],
    [1, [36, 52, 120, 1]],
  ],
  pastel: [
    [0, [255, 255, 255, 0]],
    [0.25, [255, 222, 196, 0.9]],
    [0.5, [255, 178, 214, 1]],
    [0.75, [196, 176, 255, 1]],
    [1, [120, 166, 255, 1]],
  ],
  mint: [
    [0, [255, 255, 255, 0]],
    [0.3, [214, 245, 226, 0.9]],
    [0.55, [130, 222, 196, 1]],
    [0.8, [104, 170, 250, 1]],
    [1, [92, 92, 230, 1]],
  ],
  dusk: [
    [0, [16, 30, 40, 1]],
    [0.35, [24, 92, 104, 1]],
    [0.62, [210, 96, 46, 1]],
    [0.82, [246, 160, 92, 1]],
    [1, [255, 226, 180, 1]],
  ],
}

/** Палитра, разложенная в таблицу на 256 значений: поиск цвета — одно чтение массива. */
const tables = new Map<Palette, Uint8ClampedArray>()

function table(name: Palette): Uint8ClampedArray {
  const cached = tables.get(name)
  if (cached) return cached
  const stops = PALETTES[name]
  const out = new Uint8ClampedArray(256 * 4)
  for (let i = 0; i < 256; i++) {
    const v = i / 255
    let k = 0
    while (k < stops.length - 2 && v > stops[k + 1][0]) k++
    const [p0, c0] = stops[k]
    const [p1, c1] = stops[k + 1]
    const f = Math.min(1, Math.max(0, (v - p0) / (p1 - p0)))
    for (let ch = 0; ch < 3; ch++) out[i * 4 + ch] = c0[ch] + (c1[ch] - c0[ch]) * f
    out[i * 4 + 3] = (c0[3] + (c1[3] - c0[3]) * f) * 255
  }
  tables.set(name, out)
  return out
}

export interface AuraOptions {
  palette: Palette
  /** Сдвиг, чтобы соседние ауры не двигались одинаково. */
  seed?: number
  /** Сколько полос у палитры: меньше — резче «тепловая карта». 0 — без полос. */
  bands?: number
  /** Обрезать по кругу с мягким краем. */
  round?: boolean
  /** 0 — спокойно, 1 — возбуждённо: пятна быстрее и ярче. */
  energy?: number
}

const BLOBS = 6

/** Рисует один кадр ауры в ImageData размером size×size. */
export function paintAura(image: ImageData, t: number, options: AuraOptions) {
  const { palette, seed = 0, bands = 7, round = false, energy = 0 } = options
  const lut = table(palette)
  const size = image.width
  const data = image.data
  const speed = 0.18 + energy * 0.5
  // В круге пятна ходят ближе к центру, а под ними лежит ровная подложка — диск всегда полон.
  const orbit = round ? 0.2 : 0.3

  const bx = new Float32Array(BLOBS)
  const by = new Float32Array(BLOBS)
  const br = new Float32Array(BLOBS)
  const bw = new Float32Array(BLOBS)
  for (let b = 0; b < BLOBS; b++) {
    const phase = seed * 1.7 + b * 2.39
    bx[b] = 0.5 + orbit * Math.sin(t * speed * (0.7 + b * 0.13) + phase)
    by[b] = 0.5 + orbit * Math.cos(t * speed * (0.6 + b * 0.11) + phase * 1.3)
    br[b] = 0.16 + 0.07 * Math.sin(t * 0.3 + b)
    bw[b] = b % 3 === 0 ? 1 : 0.62
  }

  for (let y = 0; y < size; y++) {
    const fy = (y + 0.5) / size
    for (let x = 0; x < size; x++) {
      const fx = (x + 0.5) / size
      const r = Math.hypot(fx - 0.5, fy - 0.5) * 2
      let v = round ? 0.55 * (1 - r * r * r) : 0
      for (let b = 0; b < BLOBS; b++) {
        const dx = fx - bx[b]
        const dy = fy - by[b]
        v += bw[b] * Math.exp(-(dx * dx + dy * dy) / (br[b] * br[b]))
      }
      v = Math.min(1, v * (round ? 0.62 : 0.8) * (1 + energy * 0.3))
      if (bands > 0) v = Math.round(v * bands) / bands
      let alpha = 1
      if (round) {
        alpha = r > 1 ? 0 : Math.min(1, (1 - r) * 6)
      }
      const index = Math.round(v * 255) * 4
      const o = (y * size + x) * 4
      data[o] = lut[index]
      data[o + 1] = lut[index + 1]
      data[o + 2] = lut[index + 2]
      data[o + 3] = lut[index + 3] * alpha
    }
  }
}

/** Разрешение поля: больше не нужно — картинку всё равно смягчает растяжение. */
export const AURA_SIZE = 48

/** У каждого сценария своё настроение: по цвету его узнаёшь раньше, чем прочтёшь. */
export const SCENARIO_PALETTE: Record<string, Palette> = {
  admission: 'pastel',
  job: 'thermal',
  onboarding: 'mint',
}
