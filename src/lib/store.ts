import { useSyncExternalStore } from 'react'

/**
 * Значение в localStorage с подпиской для React. Если хранилище закрыто или данные
 * повреждены, значение живёт в памяти вкладки и приложение работает дальше.
 */
export function createStore<T>(key: string, initial: T, accept: (value: unknown) => T | null) {
  let current: T = initial
  try {
    current = accept(JSON.parse(localStorage.getItem(key) ?? 'null')) ?? initial
  } catch {
    // Начинаем с начального значения.
  }
  const listeners = new Set<() => void>()
  const subscribe = (notify: () => void) => {
    listeners.add(notify)
    return () => listeners.delete(notify)
  }
  const get = () => current
  const set = (value: T) => {
    current = value
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Приватный режим: значение доживёт до закрытия вкладки.
    }
    listeners.forEach((notify) => notify())
  }
  const use = () => useSyncExternalStore(subscribe, get)
  return { get, set, use }
}
