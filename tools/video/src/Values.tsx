import { useEffect, useState } from 'react'
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

const PAPER = '#f4f3ef'
const TEXT = "'Inter Variable', sans-serif"

function Iris() {
  const frame = useCurrentFrame()
  const time = frame / 30
  const breath = 1 + Math.sin(time * 0.85) * 0.035
  const lines = Array.from({ length: 144 }, (_, index) => {
    const angle = (index * Math.PI * 2) / 144
    const points = Array.from({ length: 30 }, (_, point) => {
      const k = point / 29
      const radius =
        (115 +
          k * 133 +
          Math.sin(angle * 7 + k * Math.PI * 2 - time * 0.6) * 11 * k +
          Math.sin(angle * 19 - k * 4 + time * 0.4) * 5 * k) *
        breath
      const turn =
        angle + Math.sin(k * Math.PI) * 0.16 + Math.sin(angle * 5 + k * 6 + time * 0.3) * 0.035 * k
      return `${300 + Math.cos(turn) * radius},${300 + Math.sin(turn) * radius}`
    }).join(' ')
    return (
      <polyline
        key={index}
        points={points}
        stroke="url(#spectrum)"
        strokeWidth={1 + (index % 3) * 0.25}
        opacity={0.3 + (index % 5) * 0.12}
      />
    )
  })
  return (
    <svg
      viewBox="0 0 600 600"
      fill="none"
      style={{
        position: 'absolute',
        width: 1040,
        height: 1040,
        right: -155,
        top: -255,
        opacity: 0.85,
        transform: `rotate(${time * 1.8}deg)`,
      }}
    >
      <defs>
        <radialGradient id="wash">
          <stop offset="0.3" stopColor="#090f19" />
          <stop offset="0.7" stopColor="#172b3a" />
          <stop offset="1" stopColor="#111419" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id="spectrum"
          x1="80"
          y1="80"
          x2="520"
          y2="520"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#91b9f5" />
          <stop offset="0.44" stopColor="#bde9da" />
          <stop offset="0.72" stopColor="#7ebbb8" />
          <stop offset="1" stopColor="#c596d9" />
        </linearGradient>
      </defs>
      <circle cx="300" cy="300" r="280" fill="url(#wash)" />
      {lines}
      <circle cx="300" cy="300" r="109" stroke="#c4e9dc" strokeOpacity="0.16" />
      <circle cx="300" cy="300" r="88" stroke="#c4e9dc" strokeOpacity="0.06" />
    </svg>
  )
}

const PRINCIPLES = [
  [
    '01 / Самостоятельность',
    'Сначала твой ответ',
    'Обратная связь помогает учиться. Решение остаётся за тобой.',
  ],
  [
    '02 / Проверяемость',
    'Открытые основания',
    'Источник, цитата и границы проверки доступны рядом с ответом.',
  ],
  [
    '03 / Контроль',
    'Понятный путь данных',
    'История — в браузере. Текст запроса — у сервера и модели.',
  ],
]

export function Values() {
  const [fonts] = useState(() => delayRender('Шрифты сцены ценностей'))
  useEffect(() => {
    document.fonts.ready.then(() => continueRender(fonts))
  }, [fonts])
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const show = spring({
    frame: frame - 7,
    fps,
    config: { damping: 200, mass: 0.7 },
  })
  const fade = interpolate(frame, [0, 10, 232, 240], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return (
    <AbsoluteFill
      style={{
        background: '#0f1117',
        color: PAPER,
        fontFamily: TEXT,
        overflow: 'hidden',
      }}
    >
      <AbsoluteFill style={{ opacity: fade }}>
        <Iris />
        <div
          style={{
            position: 'absolute',
            left: 125,
            top: 112,
            color: '#b3b9c4',
            fontSize: 28,
          }}
        >
          Во что мы верим
        </div>
        <div
          style={{
            position: 'absolute',
            left: 125,
            top: 202,
            fontSize: 106,
            lineHeight: 1.01,
            fontWeight: 530,
            letterSpacing: '-0.05em',
            opacity: show,
            transform: `translateY(${(1 - show) * 30}px)`,
            filter: `blur(${(1 - show) * 12}px)`,
          }}
        >
          Больше ясности.
          <br />
          Решение — за тобой.
        </div>
        <div
          style={{
            position: 'absolute',
            left: 125,
            top: 445,
            color: '#b9bdc6',
            fontSize: 35,
            lineHeight: 1.4,
            opacity: show,
          }}
        >
          Твой голос и твой выбор остаются твоими.
        </div>
        <div
          style={{
            position: 'absolute',
            left: 125,
            right: 125,
            top: 632,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 28,
          }}
        >
          {PRINCIPLES.map(([label, title, text], index) => {
            const p = spring({
              frame: frame - 32 - index * 9,
              fps,
              config: { damping: 200, mass: 0.7 },
            })
            return (
              <div
                key={label}
                style={{
                  padding: '32px 36px 38px',
                  minHeight: 250,
                  border: '1px solid rgba(225,238,244,0.2)',
                  borderRadius: 32,
                  background:
                    'linear-gradient(145deg,rgba(223,239,255,0.10),rgba(223,239,255,0.025))',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
                  opacity: p,
                  transform: `translateY(${(1 - p) * 35}px)`,
                }}
              >
                <div style={{ fontSize: 23, color: '#add3cb', marginBottom: 22 }}>{label}</div>
                <div
                  style={{
                    fontSize: 37,
                    fontWeight: 540,
                    letterSpacing: '-0.025em',
                    lineHeight: 1.12,
                  }}
                >
                  {title}
                </div>
                <div
                  style={{
                    fontSize: 28,
                    color: '#b9bdc6',
                    lineHeight: 1.42,
                    marginTop: 18,
                  }}
                >
                  {text}
                </div>
              </div>
            )
          })}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 125,
            bottom: 67,
            fontSize: 23,
            color: '#8e97a6',
          }}
        >
          Совет помогает подготовиться. Официальные требования проверяй у вуза или работодателя.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
