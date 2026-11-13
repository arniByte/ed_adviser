import type { Route } from '../lib/route'
import './TopBar.css'

const LINKS: { view: Route['view']; path: string; title: string }[] = [
  { view: 'ask', path: '/ask', title: 'Справка' },
  { view: 'progress', path: '/progress', title: 'Прогресс' },
  { view: 'library', path: '/library', title: 'База' },
]

export function TopBar({ view }: { view: Route['view'] }) {
  return (
    <header className="topbar">
      <a className="wordmark" href="#/" aria-label="Черновик — на главную">
        Черн
        <span className="wordmark__ring" />
        вик
      </a>
      <nav className="topbar__nav" aria-label="Разделы">
        {LINKS.map((link) => (
          <a
            key={link.view}
            className="label topbar__link"
            href={`#${link.path}`}
            aria-current={view === link.view ? 'page' : undefined}
          >
            {link.title}
          </a>
        ))}
      </nav>
    </header>
  )
}
