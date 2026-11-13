import { useLayoutEffect, useRef, useState } from 'react'
import type { Route } from '../lib/route'
import { Mark } from './Mark'
import './TopBar.css'

export const TABS = [
  { href: '#/', title: 'Тренажёр' },
  { href: '#/ask', title: 'Справка' },
  { href: '#/progress', title: 'Прогресс' },
  { href: '#/library', title: 'База' },
] as const

/** Номер вкладки для экрана: вложенные экраны подсвечивают своего «родителя». */
export function tabOf(route: Route): number {
  switch (route.view) {
    case 'ask':
      return 1
    case 'progress':
    case 'report':
      return 2
    case 'library':
    case 'proofs':
      return 3
    default:
      return 0
  }
}

export function TopBar({ route }: { route: Route }) {
  const active = tabOf(route)
  const list = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<{ x: number; width: number } | null>(null)

  // Подложка едет под активную вкладку. Меряем после раскладки и при смене шрифта или ширины.
  useLayoutEffect(() => {
    const measure = () => {
      const link = list.current?.children[active + 1] as HTMLElement | undefined
      if (link) setThumb({ x: link.offsetLeft, width: link.offsetWidth })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list.current!)
    document.fonts?.ready.then(measure)
    return () => observer.disconnect()
  }, [active])

  return (
    <header className="topbar">
      <a className="logo" href="#/" aria-label="Черновик — на главную">
        <Mark size={28} eyes={false} />
        <span className="logo__word">черновик</span>
      </a>
      <nav className="tabs glass" aria-label="Разделы">
        <div ref={list} className="tabs__list">
          <span
            className="tabs__thumb"
            aria-hidden="true"
            style={
              thumb ? { transform: `translateX(${thumb.x}px)`, width: thumb.width } : { opacity: 0 }
            }
          />
          {TABS.map((tab, index) => (
            <a
              key={tab.href}
              className="tabs__tab"
              href={tab.href}
              aria-current={index === active ? 'page' : undefined}
            >
              {tab.title}
            </a>
          ))}
        </div>
      </nav>
    </header>
  )
}
