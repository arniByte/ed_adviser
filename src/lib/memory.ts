import { useSyncExternalStore } from 'react'
import { emptyMemory, type Memory } from '../../core/progress'

/** Всё хранится только в браузере пользователя: на сервер память не уходит. */
const KEY = 'chernovik:memory:v1'

function read(): Memory {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Memory | null
    if (stored?.version === 1) return { ...emptyMemory(), ...stored }
  } catch {
    // Повреждённые данные или закрытое хранилище — начинаем с чистого листа.
  }
  return emptyMemory()
}

let current = read()
const listeners = new Set<() => void>()

export function updateMemory(change: (memory: Memory) => Memory) {
  current = change(current)
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // В приватном режиме запись может быть запрещена: память живёт до закрытия вкладки.
  }
  listeners.forEach((notify) => notify())
}

export const getMemory = () => current

export const clearMemory = () => updateMemory(emptyMemory)

export function useMemory(): Memory {
  return useSyncExternalStore((notify) => {
    listeners.add(notify)
    return () => listeners.delete(notify)
  }, getMemory)
}
