import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { go, useRoute, type Route } from '../lib/route'
import { Mark } from './Mark'
import './Nav.css'

const SECTIONS = [
  { path: '/', title: 'Тренажёр', icon: 'train' },
  { path: '/ask', title: 'Справка', icon: 'ask' },
  { path: '/progress', title: 'Прогресс', icon: 'progress' },
  { path: '/library', title: 'База', icon: 'library' },
] as const

/** Номер раздела для экрана: вложенные экраны подсвечивают своего «родителя». */
export function sectionOf(route: Route): number {
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

function Icon({ name }: { name: (typeof SECTIONS)[number]['icon'] }) {
  const paths = {
    // Мишень: тренировка.
    train: (
      <>
        <circle cx="10" cy="10" r="6.5" />
        <circle cx="10" cy="10" r="2.5" />
      </>
    ),
    // Облачко реплики: вопрос наставнику.
    ask: <path d="M4 5.5h12v7.5H9l-3.5 3v-3H4z" />,
    // Три точки разной резкости, как на карте прогресса.
    progress: (
      <>
        <circle cx="5" cy="13" r="1.6" />
        <circle cx="10" cy="9.5" r="1.6" />
        <circle cx="15" cy="6" r="1.6" />
        <path d="M5 13l5-3.5L15 6" />
      </>
    ),
    // Стопка карточек: база знаний.
    library: (
      <>
        <rect x="4" y="7" width="12" height="9" rx="2" />
        <path d="M6 4.5h8" />
      </>
    ),
  }
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

/**
 * Вся навигация — одна кнопка со знаком. Меню раскрывается над ней стеклянной
 * карточкой, подложка переезжает к выбранному разделу.
 */
export function NavButton({ floating = false }: { floating?: boolean }) {
  const route = useRoute()
  const active = sectionOf(route)
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState<{ left: number; bottom: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => setOpen(false), [route])

  useLayoutEffect(() => {
    if (!open) return
    const box = button.current!.getBoundingClientRect()
    setPlace({ left: box.left, bottom: window.innerHeight - box.top + 10 })
    menu.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return
      if (
        event.target instanceof Node &&
        (menu.current?.contains(event.target) || button.current?.contains(event.target))
      )
        return
      setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`nav-button ${floating ? 'nav-button--floating glass' : ''}`}
        aria-label="Разделы"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Mark size={floating ? 30 : 26} eyes={false} />
      </button>
      {open &&
        place &&
        createPortal(
          <div
            ref={menu}
            className="nav-menu glass"
            role="menu"
            style={
              { left: place.left, bottom: place.bottom, '--active': active } as React.CSSProperties
            }
          >
            <span className="nav-menu__thumb" aria-hidden="true" />
            {SECTIONS.map((section, index) => (
              <button
                key={section.path}
                type="button"
                role="menuitem"
                className="nav-menu__item"
                aria-current={index === active ? 'page' : undefined}
                style={{ '--i': index } as React.CSSProperties}
                onClick={() => go(section.path)}
              >
                <Icon name={section.icon} />
                {section.title}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}

/** На экранах без поля ввода кнопка разделов висит в углу. */
export function FloatingNav() {
  useEffect(() => {
    document.documentElement.classList.add('floating-nav')
    return () => document.documentElement.classList.remove('floating-nav')
  }, [])
  return (
    <div className="nav-float">
      <NavButton floating />
    </div>
  )
}
