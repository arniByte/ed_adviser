/**
 * Карточка «своего наставника», которой делятся. Рисуются на холсте
 * в формате 4:5 — так их удобно выложить в сторис или переслать в мессенджер.
 */
import { AURA_SIZE, paintAura, type Palette } from './aura'

const W = 1080
const H = 1350
const PAPER = '#f3f3f0'
const INK = '#121214'
const SOFT = 'rgba(18,18,20,0.62)'
const SITE = 'chernovik-hellowrld.vercel.app'

function canvas() {
  const element = document.createElement('canvas')
  element.width = W
  element.height = H
  const context = element.getContext('2d')!
  context.fillStyle = PAPER
  context.fillRect(0, 0, W, H)
  return { element, context }
}

/** Тепловое пятно из той же функции, что и в приложении, растянутое и размытое. */
function aura(
  context: CanvasRenderingContext2D,
  palette: Palette,
  x: number,
  y: number,
  size: number,
) {
  const small = document.createElement('canvas')
  small.width = small.height = AURA_SIZE
  const smallContext = small.getContext('2d')!
  const image = smallContext.createImageData(AURA_SIZE, AURA_SIZE)
  paintAura(image, 4.2, { palette, seed: 3, bands: 6, round: true })
  smallContext.putImageData(image, 0, 0)
  context.save()
  context.globalAlpha = 0.75
  context.filter = 'blur(40px)'
  context.drawImage(small, x - size / 2, y - size / 2, size, size)
  context.restore()
}

/** Знак: круг из точек с ореолом у края и двумя глазами, собранными из тех же точек. */
function mark(context: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const cols = 25
  const cell = size / cols
  context.fillStyle = INK
  for (let row = 0; row < cols; row++) {
    for (let col = 0; col < cols; col++) {
      const x = ((col + 0.5) / cols) * 2 - 1
      const y = ((row + 0.5) / cols) * 2 - 1
      const r = Math.hypot(x, y)
      if (r > 1) continue
      let value = Math.exp(-(((r - 0.78) / 0.14) ** 2)) * 0.85 + 0.05
      for (const side of [-1, 1]) {
        const d = ((x - side * 0.29) / 0.14) ** 2 + ((y + 0.04) / 0.25) ** 2
        if (d < 1) value = 1
      }
      context.globalAlpha = 0.3 + 0.7 * value
      context.beginPath()
      context.arc(
        cx - size / 2 + (col + 0.5) * cell,
        cy - size / 2 + (row + 0.5) * cell,
        cell * 0.46 * (0.1 + 0.9 * Math.sqrt(value)),
        0,
        Math.PI * 2,
      )
      context.fill()
    }
  }
  context.globalAlpha = 1
}

/** Переносит текст по словам; лишнее обрезает многоточием на последней строке. */
function wrap(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (context.measureText(test).width > width && line) {
      lines.push(line)
      line = word
      if (lines.length === maxLines) break
    } else line = test
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    let last = lines[maxLines - 1]
    while (context.measureText(`${last}…`).width > width) last = last.slice(0, -1)
    lines[maxLines - 1] = `${last.trimEnd()}…`
  }
  lines.forEach((value, i) => context.fillText(value, x, y + i * lineHeight))
  return y + lines.length * lineHeight
}

function footer(context: CanvasRenderingContext2D) {
  context.fillStyle = SOFT
  context.font = '500 30px "Inter Variable", system-ui, sans-serif'
  context.fillText(`черновик · ${SITE}`, 90, H - 90)
}

async function ready() {
  await document.fonts?.ready
}

export async function mentorCard(
  name: string,
  traits: string[],
  sample: string,
  palette: Palette,
): Promise<Blob> {
  await ready()
  const { element, context } = canvas()
  aura(context, palette, W / 2, 470, 1100)
  mark(context, W / 2, 420, 360)
  context.textAlign = 'center'
  context.fillStyle = INK
  context.font = '650 84px "Inter Variable", system-ui, sans-serif'
  context.fillText(name, W / 2, 740)
  context.fillStyle = SOFT
  context.font = '500 34px "Inter Variable", system-ui, sans-serif'
  context.fillText(traits.join(' · '), W / 2, 805)
  context.textAlign = 'left'
  context.fillStyle = 'rgba(18,18,20,0.86)'
  context.font = '400 38px "Inter Variable", system-ui, sans-serif'
  wrap(context, `«${sample}»`, 120, 920, W - 240, 56, 5)
  footer(context)
  return new Promise((resolve) => element.toBlob((blob) => resolve(blob!), 'image/png'))
}

/**
 * Делится картинкой через системное меню, если браузер это умеет; иначе скачивает файл.
 * Возвращает, что произошло, — чтобы кнопка могла подсказать.
 */
export async function shareImage(
  blob: Blob,
  filename: string,
  title: string,
): Promise<'shared' | 'saved'> {
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'shared'
    }
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'saved'
}
