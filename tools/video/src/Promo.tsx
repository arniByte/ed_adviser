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
export const DURATION = 81

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

/*
 * Окно приложения: плоское и крупное, текст в нём читается с экрана. Въезжает
 * сбоку из лёгкого поворота и размытия, затем стоит ровно и едва покачивается.
 */
function Window({
  clip,
  from = 0,
  rate = 1,
  x = 0,
  y = 0,
  enter = 'right',
}: {
  clip: string
  from?: number
  rate?: number
  x?: number
  y?: number
  enter?: 'right' | 'left' | 'up'
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({ frame, fps, config: { damping: 22, mass: 1, stiffness: 80 } })
  const float = Math.sin(frame / 45) * 5
  const dx = enter === 'right' ? 260 : enter === 'left' ? -260 : 0
  const dy = enter === 'up' ? 260 : 0
  const width = 880
  const height = Math.round(width * (446 / 480))
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width,
        marginLeft: -width / 2 + x,
        marginTop: -(height + 40) / 2 + y,
        perspective: 2200,
      }}
    >
      <div
        style={{
          borderRadius: 30,
          overflow: 'hidden',
          background: '#fff',
          boxShadow: '0 0 0 1px rgba(18,18,20,0.07), 0 4px 10px rgba(18,18,20,0.06), 0 60px 110px -50px rgba(18,18,20,0.55)',
          transform: `translate(${(1 - p) * dx}px, ${(1 - p) * dy + float}px) rotateY(${(1 - p) * (enter === 'left' ? 14 : -14)}deg) scale(${0.94 + 0.06 * p})`,
          filter: `blur(${(1 - p) * 12}px)`,
          opacity: Math.min(1, p * 1.5),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40, padding: '0 18px', background: 'rgba(250,250,248,0.97)', borderBottom: '1px solid rgba(18,18,20,0.06)' }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 13, height: 13, borderRadius: 7, background: 'rgba(18,18,20,0.14)' }} />
          ))}
          <span style={{ flex: 1, marginRight: 60, textAlign: 'center', fontFamily: TEXT, fontSize: 16, color: 'rgba(18,18,20,0.45)' }}>
            chernovik-hellowrld.vercel.app
          </span>
        </div>
        <div style={{ width, height, background: PAPER }}>
          <OffthreadVideo src={staticFile(`wclips/${clip}.mp4`)} startFrom={s(from)} playbackRate={rate} muted style={{ width: '100%', height: '100%' }} />
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

const Left = ({ children, top = 330, width = 720 }: { children: ReactNode; top?: number; width?: number }) => (
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
        <Words text="Поступление." at={0.3} size={70} />
        <Words text="Первая работа." at={0.7} size={70} />
        <Words text="Первый месяц." at={1.1} size={70} />
      </Left>
      <Window clip="home" from={0.8} rate={1.6} x={420} />
    </Scene>
  )
}

/* 16–30 с: кейс и разбор */
function Review() {
  return (
    <Scene>
      <Glow name="aura-thermal.png" size={1500} x={560} y={-200} opacity={0.42} spin={-6} />
      <Window clip="answer" from={1.0} rate={1.12} x={-420} enter="left" />
      <div style={{ position: 'absolute', left: 1080, top: 320, width: 700, display: 'grid', gap: 26 }}>
        <Sequence durationInFrames={s(5)} layout="none">
          <Eyebrow>Тренажёр</Eyebrow>
          <Words text="Кейс с подвохом. Отвечай как вживую." at={0.3} out={4.6} size={76} />
        </Sequence>
        <Sequence from={s(5)} durationInFrames={s(4.6)} layout="none">
          <Eyebrow>Разбор</Eyebrow>
          <Words text="Первые слова — через 0,7 секунды." at={0.2} out={4.2} size={76} />
        </Sequence>
        <Sequence from={s(9.6)} layout="none">
          <Eyebrow>Как у эксперта</Eyebrow>
          <Words text="Что верно. Что улучшить. Как сказать лучше." at={0.2} size={76} />
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
      <span style={{ fontFamily: TEXT, fontSize: 34, fontWeight: 500, color: '#f4f3ef', letterSpacing: '-0.015em' }}>{text}</span>
    </div>
  )
}

/* 30–38 с: пруфы */
function Proofs() {
  return (
    <Scene dark>
      <Glow name="aura-mint.png" size={1600} x={-520} y={360} opacity={0.5} spin={10} />
      <Window clip="ask" from={0.6} rate={1.2} x={420} />
      <Left top={250}>
        <Eyebrow dark>Справка</Eyebrow>
        <Words text="У каждого факта —" at={0.3} size={78} color="#f4f3ef" />
        <Words text="пруф." at={0.8} size={78} color="#82dec4" />
        <div style={{ display: 'grid', gap: 18, marginTop: 40 }}>
          <Check text="Цитата найдена в источнике" at={5.7} />
          <Check text="Отпечаток SHA-256 сошёлся" at={6.0} />
          <Check text="Путь в дереве Меркла до корня" at={6.3} />
        </div>
      </Left>
    </Scene>
  )
}

/* 38–48 с: интернет с пруфами */
function Web() {
  return (
    <Scene>
      <Glow name="aura-thermal.png" size={1600} x={-520} y={300} opacity={0.5} spin={10} />
      <Left top={250}>
        <Eyebrow>Интернет с пруфами</Eyebrow>
        <Words text="Нет в базе —" at={0.3} size={78} />
        <Words text="найдёт и докажет." at={0.8} size={78} />
        <div style={{ display: 'grid', gap: 18, marginTop: 40 }}>
          <Step text="Ищет в интернете" at={2.0} />
          <Step text="Сам открывает каждую страницу" at={4.0} />
          <Step text="Оставляет только найденные цитаты" at={6.6} />
        </div>
      </Left>
      <Window clip="web" from={1.0} rate={1.8} x={420} />
    </Scene>
  )
}

function Step({ text, at }: { text: string; at: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({ frame: frame - s(at), fps, config: { damping: 16 } })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, opacity: p, transform: `translateX(${(1 - p) * -40}px)`, filter: `blur(${(1 - p) * 10}px)` }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 52, height: 52, borderRadius: 26, background: INK, color: '#fff', fontSize: 28, transform: `scale(${0.6 + 0.4 * p})` }}>✓</span>
      <span style={{ fontFamily: TEXT, fontSize: 34, fontWeight: 500, color: INK, letterSpacing: '-0.015em' }}>{text}</span>
    </div>
  )
}

/* 48–56 с: память */
function Memory() {
  return (
    <Scene>
      <Glow name="aura-pastel.png" size={1500} x={560} y={300} opacity={0.5} spin={-8} />
      <Window clip="memory" from={0.6} rate={1.7} x={-420} enter="left" />
      <div style={{ position: 'absolute', left: 1080, top: 340, width: 700, display: 'grid', gap: 26 }}>
        <Eyebrow>Адаптивность</Eyebrow>
        <Words text="Помнит, где ты споткнулся," at={0.3} size={64} />
        <Words text="и начинает с этого." at={1.0} size={64} color="rgba(18,18,20,0.5)" />
      </div>
    </Scene>
  )
}

/* 56–60 с: голос */
function Voice() {
  return (
    <Scene>
      <Glow name="aura-pastel.png" size={1400} x={-500} y={-260} opacity={0.5} spin={12} />
      <Left top={380}>
        <Eyebrow>Голос</Eyebrow>
        <Words text="Отвечай вслух." at={0.2} size={104} />
      </Left>
      <Window clip="voice" from={3.0} rate={1.0} x={420} enter="up" />
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

/* 60–67 с: ценности — новый экран приложения */
function ValuesScene() {
  return (
    <Scene>
      <Glow name="aura-pastel.png" size={1500} x={-560} y={260} opacity={0.55} spin={-10} />
      <Left top={300}>
        <Eyebrow>Ценности</Eyebrow>
        <Words text="ИИ помогает." at={0.3} size={76} />
        <Words text="Решение — твоё." at={0.8} size={76} color="rgba(18,18,20,0.5)" />
      </Left>
      <Window clip="values" from={0.6} rate={1.5} x={420} />
    </Scene>
  )
}

/* 67–73 с: цифры */
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

/* 73–81 с: финал */
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
  [10, 17, Scenarios],
  [17, 31, Review],
  [31, 39, Proofs],
  [39, 49, Web],
  [49, 56, Memory],
  [56, 60, Voice],
  [60, 67, ValuesScene],
  [67, 73, Numbers],
  [73, 81, Outro],
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
