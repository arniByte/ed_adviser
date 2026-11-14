/**
 * Настройки «своего Черновика». Хранятся в браузере и уходят на сервер вместе
 * с вопросом: цвет меняет знак, а имя, тон, подробность, юмор и манера — сам ответ.
 */
export const COLORS = ['thermal', 'pastel', 'mint', 'dusk'] as const
export type MentorColor = (typeof COLORS)[number]

export const STYLES = {
  warm: 'Тёплый',
  business: 'Деловой',
  playful: 'С юмором',
  bro: 'Свой в доску',
  roast: 'Дерзкий',
  meme: 'Мемный',
} as const
export type MentorStyle = keyof typeof STYLES

export interface MentorSettings {
  name: string
  color: MentorColor
  /** 0 — мягко, 1 — строго. */
  tone: number
  /** 0 — коротко, 1 — подробно. */
  depth: number
  /** 0 — серьёзно, 1 — максимум шуток. */
  humor: number
  style: MentorStyle
}

export const DEFAULT_MENTOR: MentorSettings = {
  name: 'Черновик',
  color: 'thermal',
  tone: 0.5,
  depth: 0.5,
  humor: 0.3,
  style: 'warm',
}

const NAME_CHARS = 24
const clamp01 = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback

/** Приводит присланные настройки к безопасному виду: неизвестное заменяется значениями по умолчанию. */
export function cleanMentor(value: unknown): MentorSettings {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const name =
    typeof raw.name === 'string' && raw.name.trim()
      ? raw.name.trim().replace(/\s+/g, ' ').slice(0, NAME_CHARS)
      : DEFAULT_MENTOR.name
  return {
    name,
    color: COLORS.includes(raw.color as MentorColor)
      ? (raw.color as MentorColor)
      : DEFAULT_MENTOR.color,
    tone: clamp01(raw.tone, DEFAULT_MENTOR.tone),
    depth: clamp01(raw.depth, DEFAULT_MENTOR.depth),
    humor: clamp01(raw.humor, DEFAULT_MENTOR.humor),
    style:
      typeof raw.style === 'string' && raw.style in STYLES ? (raw.style as MentorStyle) : 'warm',
  }
}

/** Отличаются ли настройки от стандартных — иначе в промпт ничего не добавляем. */
export const isDefaultMentor = (m: MentorSettings) =>
  m.name === DEFAULT_MENTOR.name &&
  m.style === DEFAULT_MENTOR.style &&
  Math.abs(m.tone - 0.5) < 0.15 &&
  Math.abs(m.depth - 0.5) < 0.15 &&
  Math.abs(m.humor - DEFAULT_MENTOR.humor) < 0.15

/** Указания для модели по настройкам пользователя. */
export function describeMentor(m: MentorSettings): string {
  const lines: string[] = []
  if (m.name !== DEFAULT_MENTOR.name)
    lines.push(`Пользователь назвал тебя «${m.name}». Если представляешься — этим именем.`)
  if (m.tone < 0.35)
    lines.push('Тон мягкий: сначала отметь, что получилось, ошибки называй бережно.')
  else if (m.tone > 0.65)
    lines.push(
      'Тон строгий и прямой: без смягчений, сразу к ошибкам, как на настоящем собеседовании.',
    )
  if (m.depth < 0.35)
    lines.push('Отвечай короче обычного: самое главное, без примеров сверх необходимого.')
  else if (m.depth > 0.65)
    lines.push('Отвечай подробнее обычного: больше примеров и пошаговых формулировок.')
  if (m.humor < 0.15) lines.push('Без шуток: спокойно и серьёзно.')
  else if (m.humor > 0.8)
    lines.push(
      'Юмор на максимум: две-три смешные фразы, неожиданные сравнения и самоирония в каждом ответе. Смешно, но по делу: факты, цифры и метки остаются точными.',
    )
  else if (m.humor > 0.5)
    lines.push('Шути чаще: одна-две живые шутки или забавные сравнения на ответ.')
  if (m.style === 'business') lines.push('Манера деловая: сдержанно и по пунктам.')
  if (m.style === 'playful')
    lines.push('Манера с юмором: лёгкие шутки, живые сравнения, хорошее настроение.')
  if (m.style === 'bro')
    lines.push(
      'Манера «свой в доску»: говори как друг на пару лет старше, просто и тепло, можно «слушай», «короче», «давай разберём».',
    )
  if (m.style === 'roast')
    lines.push(
      'Манера дерзкая: по-доброму подкалывай и говори в лоб, как старший брат, который за тебя. Например: «Ну камон, ты же не на казнь идёшь», «Давай без этого „я не знаю“». Без грубости, оскорблений и мата.',
    )
  if (m.style === 'meme')
    lines.push(
      'Манера мемная: в каждом абзаце хотя бы одно словечко из молодёжного сленга — база, кринж, вайб, изи, рофл, имба, флексить, скипнуть — и лёгкие отсылки к мемам. Например: «Волнение — это база, его ловят все», «Отрепетируй ответы — и собес будет изи». Смысл и факты остаются точными.',
    )
  lines.push(
    'Шутки никогда не над пользователем, его внешностью или ошибкой. Обычное волнение перед экзаменом или собеседованием — не повод выключать стиль. Без шуток — только если человек пишет, что ему по-настоящему плохо.',
  )
  return lines.join('\n')
}
