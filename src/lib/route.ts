import { useSyncExternalStore } from 'react'
import { isScenarioId } from '../../core/knowledge'
import type { ScenarioId } from '../../core/types'

export type Route =
  | { view: 'home' }
  | { view: 'ask' }
  | { view: 'train'; scenario: ScenarioId }
  | { view: 'progress' }
  | { view: 'library' }
  | { view: 'report'; session: string }

function parse(hash: string): Route {
  const [view, argument] = hash.replace(/^#\/?/, '').split('/')
  if (view === 'ask' || view === 'progress' || view === 'library') return { view }
  if (view === 'train' && isScenarioId(argument)) return { view, scenario: argument }
  if (view === 'report' && argument) return { view, session: argument }
  return { view: 'home' }
}

const subscribe = (notify: () => void) => {
  window.addEventListener('hashchange', notify)
  return () => window.removeEventListener('hashchange', notify)
}

let cached: { hash: string; route: Route } | null = null

/** Адрес хранится в хеше: кнопка «назад» на телефоне работает без сервера. */
export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => {
    const hash = window.location.hash
    if (cached?.hash !== hash) cached = { hash, route: parse(hash) }
    return cached.route
  })
}

export function go(path: string) {
  window.location.hash = path
  window.scrollTo({ top: 0 })
}
