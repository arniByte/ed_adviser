import { useEffect, useState } from 'react'
import './BlurCycle.css'

interface Props {
  items: string[]
  /** Сколько фраза держится на экране, мс. */
  hold?: number
  className?: string
}

/**
 * Фразы сменяют друг друга: каждая проявляется по словам из размытия, как ответы
 * наставника, держится и уходит обратно в размытие.
 */
export function BlurCycle({ items, hold = 3200, className = '' }: Props) {
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (items.length < 2) return
    const words = items[index].split(' ').length
    const show = window.setTimeout(() => setLeaving(true), hold + words * 70)
    const next = window.setTimeout(
      () => {
        setLeaving(false)
        setIndex((value) => (value + 1) % items.length)
      },
      hold + words * 70 + 420,
    )
    return () => {
      window.clearTimeout(show)
      window.clearTimeout(next)
    }
  }, [index, items, hold])

  return (
    <span className={`blur-cycle ${leaving ? 'blur-cycle--out' : ''} ${className}`} aria-live="off">
      {items[index].split(' ').map((word, i) => (
        <span
          key={`${index}-${i}`}
          className="blur-cycle__word"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          {word}{' '}
        </span>
      ))}
    </span>
  )
}

/** Продолжения для живой подсказки в поле ввода: «Спроси …». */
export const ASK_HINTS = [
  'о поступлении',
  'про резюме',
  'про собеседование',
  'про испыталку',
  'о мошенниках',
  'что угодно',
]
