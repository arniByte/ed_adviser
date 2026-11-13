import { useEffect, useRef, useState } from 'react'

/** За сколько кадров догонять поток: около 100 мс при 60 кадрах в секунду. */
const CATCH_UP_FRAMES = 6

/**
 * Модель присылает текст неровными кусками. Пока ответ пишется, хук выдаёт его
 * равномерно, по нескольку символов за кадр, и догоняет поток без задержки в конце.
 */
export function useSmoothText(target: string, streaming: boolean): string {
  const [shown, setShown] = useState(streaming ? 0 : target.length)
  const shownRef = useRef(shown)
  const targetRef = useRef(target)
  targetRef.current = target

  useEffect(() => {
    if (!streaming) return
    let frame = 0
    const tick = () => {
      const goal = targetRef.current.length
      // Новый ответ короче показанного — начинаем заново.
      if (shownRef.current > goal) shownRef.current = 0
      if (shownRef.current < goal) {
        const step = Math.max(2, Math.ceil((goal - shownRef.current) / CATCH_UP_FRAMES))
        shownRef.current = Math.min(goal, shownRef.current + step)
        setShown(shownRef.current)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [streaming])

  if (!streaming) return target
  return target.slice(0, shown)
}
