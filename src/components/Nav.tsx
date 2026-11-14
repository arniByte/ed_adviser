import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { go, useRoute, type Route } from '../lib/route'
import { Mark } from './Mark'
import './Nav.css'

const SECTIONS = [
  { path: '/', title: 'Тренажёр', icon: 'train' },
  { path: '/ask', title: 'Справка', icon: 'ask' },
  { path: '/progress', title: 'Прогресс', icon: 'progress' },
  { path: '/library', title: 'База', icon: 'library' },
  { path: '/values', title: 'Ценности', icon: 'values' },
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
    case 'values':
      return 4
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
    values: <path d="M10 17S3 12.7 3 7.8a3.8 3.8 0 0 1 7-2 3.8 3.8 0 0 1 7 2c0 4.9-7 9.2-7 9.2Z" />,
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
  const menuId = useId()

  const dismiss = () => {
    setOpen(false)
    button.current?.focus({ preventScroll: true })
  }

  useEffect(() => setOpen(false), [route])

  useLayoutEffect(() => {
    if (!open) return
    const box = button.current!.getBoundingClientRect()
    setPlace({
      left: Math.max(12, Math.min(box.left, window.innerWidth - 236)),
      bottom: window.innerHeight - box.top + 10,
    })
  }, [open])

  useLayoutEffect(() => {
    if (open && place)
      menu.current
        ?.querySelector<HTMLElement>('[aria-current="page"]')
        ?.focus({ preventScroll: true })
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const close = (event: Event) => {
      if (event instanceof window.KeyboardEvent) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setOpen(false)
          button.current?.focus({ preventScroll: true })
        }
        return
      }
      if (
        event.target instanceof Node &&
        (menu.current?.contains(event.target) || button.current?.contains(event.target))
      )
        return
      setOpen(false)
      button.current?.focus({ preventScroll: true })
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

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...menu.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    let next: number
    switch (event.key) {
      case 'ArrowDown':
        next = (index + 1) % items.length
        break
      case 'ArrowUp':
        next = (index - 1 + items.length) % items.length
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = items.length - 1
        break
      case 'Tab':
        dismiss()
        return
      default:
        return
    }
    event.preventDefault()
    items[next].focus()
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`nav-button ${floating ? 'nav-button--floating glass' : ''}`}
        aria-label="Разделы"
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <Mark size={floating ? 30 : 26} eyes={false} />
      </button>
      {open &&
        place &&
        createPortal(
          <>
            <div className="nav-backdrop" aria-hidden="true" />
            <div
              id={menuId}
              ref={menu}
              className="nav-menu glass"
              role="menu"
              aria-label="Разделы"
              onKeyDown={move}
              style={
                {
                  left: place.left,
                  bottom: place.bottom,
                  '--menu-bottom': `${place.bottom}px`,
                  '--active': active,
                } as React.CSSProperties
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
                  tabIndex={index === active ? 0 : -1}
                  style={{ '--i': index } as React.CSSProperties}
                  onClick={() => {
                    dismiss()
                    go(section.path)
                  }}
                >
                  <Icon name={section.icon} />
                  {section.title}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}

/** На экранах без поля ввода кнопка разделов висит в углу. */
export function FloatingNav() {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    document.documentElement.classList.add('floating-nav')
    // Листаешь вниз — кнопка уходит и не ложится на текст, вверх — возвращается.
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (Math.abs(y - last) < 8) return
      setHidden(y > last && y > 80)
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      document.documentElement.classList.remove('floating-nav')
      window.removeEventListener('scroll', onScroll)
    }
  }, [])
  return (
    <div className="nav-float" data-hidden={hidden}>
      <NavButton floating />
    </div>
  )
}
