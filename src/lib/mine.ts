import { useEffect, useState } from 'react'
import { buildTree, leafHash, type WebCheck } from '../../core/proof'
import type { Card } from '../../core/types'
import { createStore } from './store'

/**
 * Моя база: карточки из интернета, которые пользователь сохранил. Каждая хранится
 * вместе с пруфом сервера, а вся база сворачивается в свой корень Меркла —
 * так же, как общая.
 */
export interface Saved {
  card: Card
  check: WebCheck
}

const isSaved = (value: unknown): value is Saved => {
  const item = value as Saved | null
  return (
    typeof item?.card?.id === 'string' &&
    item.card.id.startsWith('web-') &&
    typeof item.check?.hash === 'string'
  )
}

const store = createStore<Saved[]>('chernovik:mine:v1', [], (value) =>
  Array.isArray(value) ? value.filter(isSaved) : null,
)

export const getMine = store.get
export const useMine = store.use

export const isMine = (id: string) => store.get().some((item) => item.card.id === id)

export function saveToMine(card: Card, check: WebCheck) {
  if (isMine(card.id)) return
  store.set([{ card, check }, ...store.get()])
}

export function removeFromMine(id: string) {
  store.set(store.get().filter((item) => item.card.id !== id))
}

/** Корень личной базы: отпечатки карточек, упорядоченные по id, свёрнутые в дерево. */
export function useMineRoot(): string | null {
  const mine = useMine()
  const [root, setRoot] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    if (mine.length === 0) {
      setRoot(null)
      return
    }
    const sorted = [...mine].sort((a, b) => a.card.id.localeCompare(b.card.id))
    Promise.all(sorted.map((item) => leafHash(item.card)))
      .then(buildTree)
      .then((tree) => {
        if (alive) setRoot(tree.root)
      })
    return () => {
      alive = false
    }
  }, [mine])
  return root
}
