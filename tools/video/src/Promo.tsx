import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  AbsoluteFill,
  Audio,
  continueRender,
  delayRender,
  Easing,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

export const FPS = 30
export const DURATION = 64

const PAPER = '#f3f3f0'
const NIGHT = '#0c0c0f'
const INK = '#121214'
const DISPLAY = "'Unbounded Variable', sans-serif"
const TEXT = "'Inter Variable', sans-serif"
const s = (sec: number) => Math.round(sec * FPS)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/* Слова проявляются из размытия по одному — как ответы в приложении. */
function Words({
  text,
  at = 0,
  out,
  size,
  color = INK,
  font = DISPLAY,
  weight = 560,
  stagger = 3,
  style,
}: {
  text: string
  at?: number
  out?: number
  size: number
  color?: string
  font?: string
  weight?: number
  stagger?: number
  style?: CSSProperties
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = text.split(' ')
  const leave = out === undefined ? 0 : interpolate(frame, [s(out), s(out) + 9], [0, 1], clamp)
  return (
    <div
      style={{
        fontFamily: font,
        fontSize: size,
        fontWeight: weight,
        lineHeight: 1.06,
        letterSpacing: font === DISPLAY ? '-0.04em' : '-0.015em',
        color,
        opacity: 1 - leave,
        filter: `blur(${leave * 16}px)`,
        transform: `translateY(${-leave * 20}px)`,
        ...style,
      }}
    >
      {words.map((word, i) => {
        const p = spring({ frame: frame - s(at) - i * stagger, fps, config: { damping: 200, mass: 0.7 } })
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              marginRight: '0.26em',
              opacity: p,
              filter: `blur(${(1 - p) * 14}px)`,
              transform: `translateY(${(1 - p) * 0.35}em)`,
            }}
          >
            {word}
          </span>
        )
      })}
    </div>
  )
}

/* Плывущее тепловое пятно: картинка из приложения, растянутая и размытая. */
function Glow({
  name,
  size = 1500,
  x = 0,
  y = 0,
  opacity = 0.7,
  blur = 70,
  spin = 8,
  grow = [1, 1.15],
}: {
  name: string
  size?: number
  x?: number
  y?: number
  opacity?: number
  blur?: number
  spin?: number
  grow?: [number, number]
}) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const k = frame / durationInFrames
  const scale = interpolate(k, [0, 1], grow)
  const fadeIn = interpolate(frame, [0, 12], [0, 1], clamp)
  return (
    <Img
      src={staticFile(name)}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: size,
        height: size,
        marginLeft: -size / 2 + x,
        marginTop: -size / 2 + y,
        opacity: opacity * fadeIn,
        filter: `blur(${blur}px) saturate(1.15)`,
        transform: `rotate(${k * spin}deg) scale(${scale})`,
      }}
    />
  )
}

function Grain({ dark = false }: { dark?: boolean }) {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        opacity: dark ? 0.12 : 0.5,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${frame % 4}' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.09 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    />
  )
}

/* Телефон в перспективе: рамка, стекло и живая запись экрана. */
function Phone({
  clip,
  from = 0,
  rate = 1,
  x = 0,
  y = 0,
  width = 396,
  turn = [-26, -12],
  enter = 'right',
}: {
  clip: string
  from?: number
  rate?: number
  x?: number
  y?: number
  width?: number
  turn?: [number, number]
  enter?: 'right' | 'left' | 'up'
}) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const p = spring({ frame, fps, config: { damping: 18, mass: 1.1, stiffness: 70 } })
  const drift = interpolate(frame, [0, durationInFrames], turn)
  const float = Math.sin(frame / 38) * 10
  const dx = enter === 'right' ? 900 : enter === 'left' ? -900 : 0
  const dy = enter === 'up' ? 900 : 0
  const height = width * (1688 / 780)
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: width + 28,
        marginLeft: -(width + 28) / 2 + x,
        marginTop: -(height + 28) / 2 + y,
        perspective: 2400,
      }}
    >
      <div
        style={{
          padding: 14,
          borderRadius: 78,
          background: 'linear-gradient(145deg, #45454c, #0b0b0e 38%, #2a2a30 80%, #0b0b0e)',
          boxShadow: '0 4px 8px rgba(0,0,0,0.18), 0 90px 120px -50px rgba(10,10,20,0.7)',
          transform: `translate(${(1 - p) * dx}px, ${(1 - p) * dy + float}px) rotateY(${drift + (1 - p) * (enter === 'left' ? 50 : -50)}deg) rotateX(${6 + (1 - p) * 12}deg) rotateZ(${enter === 'left' ? 2 : -2}deg)`,
          transformStyle: 'preserve-3d',
          opacity: Math.min(1, p * 1.6),
        }}
      >
        <div style={{ position: 'relative', borderRadius: 64, overflow: 'hidden', width, height, background: PAPER }}>
          <OffthreadVideo src={staticFile(`clips/${clip}.mp4`)} startFrom={s(from)} playbackRate={rate} muted style={{ width: '100%', height: '100%' }} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(${115 + drift}deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.08) 100%)`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

function Scene({ dark = false, children }: { dark?: boolean; children: ReactNode }) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  // Каждая сцена слегка «въезжает» и «уезжает» вглубь: склейка не выглядит рубленой.
  const zin = interpolate(frame, [0, 10], [1.04, 1], { ...clamp, easing: Easing.out(Easing.cubic) })
  const zout = interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0.985], clamp)
  return (
    <AbsoluteFill style={{ background: dark ? NIGHT : PAPER, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${zin * zout})` }}>{children}</AbsoluteFill>
      <Grain dark={dark} />
    </AbsoluteFill>
  )
}

const Left = ({ children, top = 330, width = 940 }: { children: ReactNode; top?: number; width?: number }) => (
  <div style={{ position: 'absolute', left: 150, top, width, display: 'grid', gap: 26 }}>{children}</div>
)

const Eyebrow = ({ children, at = 0, dark = false }: { children: string; at?: number; dark?: boolean }) => (
  <Words text={children} at={at} size={30} font={TEXT} weight={520} color={dark ? 'rgba(244,243,239,0.6)' : 'rgba(18,18,20,0.55)'} stagger={1} />
)

/* 0–6 с: хук на тёмном фоне */
function Hook() {
  return (
    <Scene dark>
      <Glow name="aura-dusk.png" size={1700} y={260} opacity={0.9} grow={[0.55, 1.25]} spin={14} />
      <AbsoluteFill style={{ justifyContent: 'center', padding: '0 170px' }}>
        <Words text="Первое собеседование" at={0.4} out={3.1} size={124} color="#f4f3ef" />
        <Words text="бывает один раз." at={1.7} out={3.1} size={124} color="rgba(244,243,239,0.55)" />
      </AbsoluteFill>
      <Sequence from={s(3.3)}>
        <AbsoluteFill style={{ justifyContent: 'center', padding: '0 170px' }}>
          <Words text="Репетиций —" size={124} color="#f4f3ef" />
          <Words text="сколько угодно." at={0.5} size={124} color="#f4f3ef" />
        </AbsoluteFill>
      </Sequence>
    </Scene>
  )
}

/* 6–10 с: знак и название */
function Title() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({ frame, fps, config: { damping: 14, mass: 0.9 } })
  const flash = interpolate(frame, [0, 8], [1, 0], clamp)
  return (
    <Scene>
      <Glow name="aura-thermal.png" size={1300} opacity={0.6} grow={[0.7, 1.05]} spin={-10} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Img
          src={staticFile('mark.png')}
          style={{ width: 380, height: 380, transform: `scale(${0.55 + 0.45 * p}) rotate(${(1 - p) * -30}deg)`, filter: `blur(${(1 - p) * 20}px)` }}
        />
        <Words text="черновик" at={0.35} size={150} weight={600} style={{ marginTop: 24 }} />
        <Words text="AI-тренажёр для абитуриента и стажёра" at={0.9} size={40} font={TEXT} weight={480} color="rgba(18,18,20,0.66)" stagger={2} style={{ marginTop: 26 }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#fff', opacity: flash }} />
    </Scene>
  )
}

/* 10–16 с: сценарии */
function Scenarios() {
  return (
    <Scene>
      <Glow name="aura-pastel.png" size={1500} x={-560} y={240} opacity={0.55} />
      <Left top={300}>
        <Eyebrow>Три сценария</Eyebrow>
        <Words text="Поступление." at={0.3} size={92} />
        <Words text="Первая работа." at={0.7} size={92} />
        <Words text="Первый месяц." at={1.1} size={92} />
      </Left>
      <Phone clip="home" from={0.2} rate={1.25} x={470} y={10} />
    </Scene>
  )
}

/* 16–30 с: кейс и разбор */
function Review() {
  return (
    <Scene>
      <Glow name="aura-thermal.png" size={1500} x={560} y={-200} opacity={0.42} spin={-6} />
      <Phone clip="answer" from={1.2} rate={1.15} x={-430} y={20} turn={[22, 12]} enter="left" />
      <div style={{ position: 'absolute', left: 1010, top: 330, width: 780, display: 'grid', gap: 26 }}>
        <Sequence durationInFrames={s(5)} layout="none">
          <Eyebrow>Тренажёр</Eyebrow>
          <Words text="Кейс с подвохом. Отвечай как вживую." at={0.3} out={4.6} size={84} />
        </Sequence>
        <Sequence from={s(5)} durationInFrames={s(4.6)} layout="none">
          <Eyebrow>Разбор</Eyebrow>
          <Words text="Первые слова — через 0,7 секунды." at={0.2} out={4.2} size={84} />
        </Sequence>
        <Sequence from={s(9.6)} layout="none">
          <Eyebrow>Как у эксперта</Eyebrow>
          <Words text="Что верно. Что улучшить. Как сказать лучше." at={0.2} size={84} />
        </Sequence>
      </div>
    </Scene>
  )
}

function Check({ text, at }: { text: string; at: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({ frame: frame - s(at), fps, config: { damping: 16 } })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, opacity: p, transform: `translateX(${(1 - p) * -40}px)`, filter: `blur(${(1 - p) * 10}px)` }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 52, height: 52, borderRadius: 26, background: 'rgba(130,222,196,0.2)', color: '#82dec4', fontSize: 30, transform: `scale(${0.6 + 0.4 * p})` }}>✓</span>
      <span style={{ fontFamily: TEXT, fontSize: 38, fontWeight: 500, color: '#f4f3ef', letterSpacing: '-0.015em' }}>{text}</span>
    </div>
  )
}

/* 30–38 с: пруфы */
function Proofs() {
  return (
    <Scene dark>
      <Glow name="aura-mint.png" size={1600} x={-520} y={360} opacity={0.5} spin={10} />
      <Phone clip="ask" from={0.6} rate={1.42} x={480} y={10} />
      <Left top={250}>
        <Eyebrow dark>Справка</Eyebrow>
        <Words text="У каждого факта —" at={0.3} size={88} color="#f4f3ef" />
        <Words text="пруф." at={0.8} size={88} color="#82dec4" />
        <div style={{ display: 'grid', gap: 18, marginTop: 40 }}>
          <Check text="Цитата найдена в источнике" at={5.7} />
          <Check text="Отпечаток SHA-256 сошёлся" at={6.0} />
          <Check text="Путь в дереве Меркла до корня" at={6.3} />
        </div>
      </Left>
    </Scene>
  )
}

/* 38–46 с: память */
function Memory() {
  return (
    <Scene>
      <Glow name="aura-pastel.png" size={1500} x={560} y={300} opacity={0.5} spin={-8} />
      <Phone clip="memory" from={0.4} rate={1.4} x={-430} y={10} turn={[22, 12]} enter="left" />
      <div style={{ position: 'absolute', left: 1010, top: 340, width: 790, display: 'grid', gap: 26 }}>
        <Eyebrow>Адаптивность</Eyebrow>
        <Words text="Помнит, где ты споткнулся," at={0.3} size={84} />
        <Words text="и начинает с этого." at={1.0} size={84} color="rgba(18,18,20,0.5)" />
      </div>
    </Scene>
  )
}

/* 46–50 с: голос */
function Voice() {
  return (
    <Scene>
      <Glow name="aura-pastel.png" size={1400} x={-500} y={-260} opacity={0.5} spin={12} />
      <Left top={380}>
        <Eyebrow>Голос</Eyebrow>
        <Words text="Отвечай вслух." at={0.2} size={104} />
      </Left>
      <Phone clip="voice" from={1.4} rate={1.2} x={470} y={10} enter="up" />
    </Scene>
  )
}

function Stat({ value, label, at }: { value: string; label: string; at: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({ frame: frame - s(at), fps, config: { damping: 15, mass: 0.8 } })
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 60}px)`, filter: `blur(${(1 - p) * 14}px)` }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 124, fontWeight: 560, letterSpacing: '-0.06em', color: '#f4f3ef', lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: TEXT, fontSize: 34, color: 'rgba(244,243,239,0.6)', marginTop: 18 }}>{label}</div>
    </div>
  )
}

/* 50–56 с: цифры */
function Numbers() {
  return (
    <Scene dark>
      <Glow name="aura-thermal.png" size={1700} y={520} opacity={0.55} grow={[0.9, 1.2]} />
      <AbsoluteFill style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', padding: '0 80px' }}>
        <Stat value="0,7 с" label="до первых слов разбора" at={0.5} />
        <Stat value="60/60" label="пруфов сходятся" at={2.0} />
        <Stat value="$0,003" label="за всю тренировку" at={3.5} />
      </AbsoluteFill>
    </Scene>
  )
}

/* 56–64 с: финал */
function Outro() {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const p = spring({ frame, fps, config: { damping: 16 } })
  const end = interpolate(frame, [durationInFrames - 20, durationInFrames], [0, 1], clamp)
  return (
    <Scene>
      <Glow name="aura-thermal.png" size={1600} opacity={0.62} grow={[0.8, 1.1]} spin={-12} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <Img src={staticFile('mark.png')} style={{ width: 230, height: 230, opacity: p, transform: `scale(${0.7 + 0.3 * p})` }} />
        <Words text="Сначала — начерно" at={0.3} size={132} style={{ marginTop: 30 }} />
        <Words text="github.com/arniByte/ed_adviser" at={1.6} size={36} font={TEXT} weight={500} color="rgba(18,18,20,0.62)" stagger={1} style={{ marginTop: 44 }} />
        <Words text="Цифровое наставничество и AI-менторство · Софтлайн Решения" at={2.1} size={28} font={TEXT} weight={480} color="rgba(18,18,20,0.5)" stagger={1} style={{ marginTop: 16 }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: PAPER, opacity: end }} />
    </Scene>
  )
}

const SCENES: [number, number, () => ReactNode][] = [
  [0, 6, Hook],
  [6, 10, Title],
  [10, 16, Scenarios],
  [16, 30, Review],
  [30, 38, Proofs],
  [38, 46, Memory],
  [46, 50, Voice],
  [50, 56, Numbers],
  [56, 64, Outro],
]

export function Promo() {
  const [handle] = useState(() => delayRender('fonts'))
  useEffect(() => {
    document.fonts.ready.then(() => continueRender(handle))
  }, [handle])
  return (
    <AbsoluteFill style={{ background: NIGHT }}>
      {SCENES.map(([from, to, Component]) => (
        <Sequence key={from} from={s(from)} durationInFrames={s(to - from)}>
          <Component />
        </Sequence>
      ))}
      <Audio src={staticFile('audio/track.wav')} />
    </AbsoluteFill>
  )
}
