import { useEffect, useRef, useState } from 'react'
import { cases, scenarios } from '../../core/knowledge'
import type { Route } from '../lib/route'
import { AsciiMark } from './AsciiMark'
import { CASES, plural } from '../lib/plural'
import { Close, MenuIcon } from './icons'
import './TopBar.css'

const SECTIONS: { view: Route['view']; href: string; title: string; note: string }[] = [
  { view: 'ask', href: '#/ask', title: 'Справка', note: 'Спроси наставника' },
  { view: 'progress', href: '#/progress', title: 'Прогресс', note: 'Где уверенно, а где плаваешь' },
  { view: 'library', href: '#/library', title: 'База знаний', note: 'Карточки с источниками' },
  { view: 'proofs', href: '#/proofs', title: 'Пруфы', note: 'Как проверяются источники' },
]

const countCases = (id: string) => cases.filter((item) => item.scenario === id).length

export function Logo() {
  return (
    <a className="logo" href="#/" aria-label="Черновик — на главную">
      <AsciiMark size={28} face={false} />
      <span className="logo__word">черновик</span>
    </a>
  )
}

export function TopBar({ route }: { route: Route }) {
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  // Любой переход закрывает меню.
  const key = route.view === 'train' ? `train/${route.scenario}` : route.view
  useEffect(() => setOpen(false), [key])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.documentElement.classList.add('menu-open')
    panel.current?.querySelector<HTMLElement>('a')?.focus({ preventScroll: true })
    const button = toggle.current
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.classList.remove('menu-open')
      button?.focus({ preventScroll: true })
    }
  }, [open])

  let index = 0
  const step = () => ({ '--i': index++ }) as React.CSSProperties

  return (
    <>
      <header className="topbar">
        <Logo />
        <button
          ref={toggle}
          className="btn btn--glass btn--small topbar__menu"
          aria-expanded={open}
          aria-controls="menu"
          onClick={() => setOpen(!open)}
        >
          {open ? <Close /> : <MenuIcon />}
          {open ? 'Закрыть' : 'Меню'}
        </button>
      </header>

      {open && (
        <div
          id="menu"
          ref={panel}
          className="menu"
          role="dialog"
          aria-modal="true"
          aria-label="Меню"
        >
          <nav className="menu__body">
            <p className="caption menu__eyebrow rise" style={step()}>
              Тренажёр
            </p>
            <div className="menu__scenarios">
              {scenarios.map((scenario) => (
                <a
                  key={scenario.id}
                  className="menu__scenario surface rise"
                  style={step()}
                  href={`#/train/${scenario.id}`}
                  aria-current={key === `train/${scenario.id}` ? 'page' : undefined}
                >
                  <span className="menu__scenario-title">{scenario.title}</span>
                  <span className="caption">
                    {countCases(scenario.id)} {plural(countCases(scenario.id), CASES)}
                  </span>
                </a>
              ))}
            </div>

            <ul className="menu__list">
              {SECTIONS.map((section) => (
                <li key={section.view} className="rise" style={step()}>
                  <a
                    className="menu__link"
                    href={section.href}
                    aria-current={route.view === section.view ? 'page' : undefined}
                  >
                    <span className="menu__title">{section.title}</span>
                    <span className="caption">{section.note}</span>
                  </a>
                </li>
              ))}
            </ul>

            <p className="disclaimer menu__foot rise" style={step()}>
              Советы носят информационный характер и не заменяют официальные требования вузов и
              работодателей.{' '}
              <a href="https://github.com/arniByte/ed_adviser" target="_blank" rel="noreferrer">
                Код на GitHub
              </a>
            </p>
          </nav>
        </div>
      )}
    </>
  )
}
