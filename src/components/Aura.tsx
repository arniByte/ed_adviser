import { useEffect, useRef } from 'react'
import { AURA_SIZE, paintAura, type AuraOptions } from '../lib/aura'
import './Aura.css'

interface Props extends AuraOptions {
  className?: string
  /** Кадров в секунду: фону хватает немного. */
  fps?: number
}

/** Плывущий градиент. Засыпает вне экрана и на скрытой вкладке. */
export function Aura({ className = '', fps = 24, ...options }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    const canvas = canvasRef.current!
    canvas.width = AURA_SIZE
    canvas.height = AURA_SIZE
    const context = canvas.getContext('2d')!
    const image = context.createImageData(AURA_SIZE, AURA_SIZE)
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now() - (optionsRef.current.seed ?? 0) * 7000
    let frame = 0
    let last = 0
    let visible = true

    const draw = (now: number) => {
      paintAura(image, (now - start) / 1000, optionsRef.current)
      context.putImageData(image, 0, 0)
    }
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop)
      if (now - last < 1000 / fps) return
      last = now
      draw(now)
    }
    const run = () => {
      cancelAnimationFrame(frame)
      if (still) return draw(start + 4000)
      if (visible && !document.hidden) frame = requestAnimationFrame(loop)
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      run()
    })
    observer.observe(canvas)
    document.addEventListener('visibilitychange', run)
    draw(performance.now())
    run()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', run)
    }
  }, [fps])

  return <canvas ref={canvasRef} className={`aura ${className}`} aria-hidden="true" />
}
