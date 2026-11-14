import { useEffect, useRef } from 'react'

export interface SphereNode {
  id: string
  label: string
  kind: 'group' | 'item' | 'own' | 'back'
  selected?: boolean
  count?: number
}

interface Props {
  nodes: SphereNode[]
  onPick: (node: SphereNode) => void
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

/**
 * Интересы на сфере: точки лежат по спирали Фибоначчи, сфера медленно вращается сама,
 * а пальцем или мышью её можно крутить с инерцией. Задние точки мельче, прозрачнее
 * и размыты, по краям поле уходит в туман — как будто смотришь на глобус интересов.
 */
export function InterestSphere({ nodes, onPick }: Props) {
  const field = useRef<HTMLDivElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])
  const drag = useRef({ active: false, moved: 0, x: 0, y: 0, vx: 0, vy: 0 })
  // Поворот живёт вне эффекта: выбор интереса не должен сбрасывать сферу.
  const angle = useRef({ x: -0.25, y: 0 })
  const count = nodes.length

  useEffect(() => {
    const box = field.current!
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let ax = angle.current.x
    let ay = angle.current.y
    let last = performance.now()
    let frame = 0
    const base = nodes.map((_, i) => {
      const y = 1 - ((i + 0.5) / count) * 2
      const r = Math.sqrt(1 - y * y)
      return { x: Math.cos(i * GOLDEN) * r, y, z: Math.sin(i * GOLDEN) * r }
    })

    const draw = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now
      const d = drag.current
      if (!d.active) {
        // Инерция после броска, затем — спокойное собственное вращение.
        d.vx *= 0.94
        d.vy *= 0.94
        ay += d.vx + (motion.matches ? 0 : 0.22 * dt)
        ax += d.vy
        ax = Math.max(-1.1, Math.min(1.1, ax))
      }
      const width = box.clientWidth
      const height = box.clientHeight
      // Сфера сплющена в эллипс по полю: так подписи не налезают друг на друга.
      const rx = width * 0.4
      const ry = height * 0.4
      const [sy, cy, sx, cx] = [Math.sin(ay), Math.cos(ay), Math.sin(ax), Math.cos(ax)]
      base.forEach((point, i) => {
        const element = items.current[i]
        if (!element) return
        // Поворот вокруг вертикальной оси, затем вокруг горизонтальной.
        const x1 = point.x * cy + point.z * sy
        const z1 = -point.x * sy + point.z * cy
        const y2 = point.y * cx - z1 * sx
        const z2 = point.y * sx + z1 * cx
        const depth = (z2 + 1) / 2
        const scale = 0.58 + 0.5 * depth
        element.style.transform = `translate(-50%, -50%) translate3d(${(width / 2 + x1 * rx).toFixed(1)}px, ${(height / 2 + y2 * ry).toFixed(1)}px, 0) scale(${scale.toFixed(3)})`
        element.style.opacity = (0.2 + 0.8 * depth ** 1.4).toFixed(3)
        element.style.filter = depth < 0.55 ? `blur(${((0.55 - depth) * 7).toFixed(1)}px)` : 'none'
        element.style.zIndex = String(Math.round(depth * 100))
        element.style.pointerEvents = depth > 0.38 ? 'auto' : 'none'
      })
      angle.current = { x: ax, y: ay }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    const down = (event: PointerEvent) => {
      drag.current = { active: true, moved: 0, x: event.clientX, y: event.clientY, vx: 0, vy: 0 }
    }
    const move = (event: PointerEvent) => {
      const d = drag.current
      if (!d.active) return
      const dx = event.clientX - d.x
      const dy = event.clientY - d.y
      d.x = event.clientX
      d.y = event.clientY
      d.moved += Math.abs(dx) + Math.abs(dy)
      d.vx = dx * 0.006
      d.vy = -dy * 0.006
      ay += d.vx
      ax = Math.max(-1.1, Math.min(1.1, ax + d.vy))
      if (d.moved > 6) event.preventDefault()
    }
    const up = () => {
      drag.current.active = false
    }
    box.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      cancelAnimationFrame(frame)
      box.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [count])

  return (
    <div ref={field} className="sphere" role="group" aria-label="Интересы: покрути и выбери">
      {nodes.map((node, i) => (
        <button
          key={node.id}
          ref={(element) => {
            items.current[i] = element
          }}
          type="button"
          className={`sphere__node sphere__node--${node.kind}`}
          aria-pressed={node.kind === 'item' ? !!node.selected : undefined}
          style={{ '--i': i } as React.CSSProperties}
          onClick={(event) => {
            // Бросок сферы не должен считаться выбором. Клавиатура (detail 0) работает всегда.
            if (event.detail !== 0 && drag.current.moved > 6) return
            onPick(node)
          }}
        >
          {node.label}
          {node.count ? <span className="welcome__badge">{node.count}</span> : null}
        </button>
      ))}
    </div>
  )
}
