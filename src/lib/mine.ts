import { useEffect, useState } from 'react'
import { isScenarioId } from '../../core/knowledge'
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

export const isSaved = (value: unknown): value is Saved => {
  const item = value as Saved | null
  const card = item?.card
  const source = card?.source
  return (
    typeof card?.id === 'string' &&
    /^web-[0-9a-f]{10}$/.test(card.id) &&
    card.kind === 'web' &&
    isScenarioId(card.scenario) &&
    typeof card.zone === 'string' &&
    typeof card.title === 'string' &&
    typeof card.text === 'string' &&
    typeof source?.title === 'string' &&
    typeof source.publisher === 'string' &&
    typeof source.url === 'string' &&
    /^https?:\/\/\S+$/.test(source.url) &&
    (source.quote === undefined || typeof source.quote === 'string') &&
    (source.year === undefined || Number.isFinite(source.year)) &&
    typeof item?.check?.hash === 'string' &&
    /^[0-9a-f]{64}$/.test(item.check.hash) &&
    typeof item.check.checkedAt === 'string' &&
    Number.isFinite(Date.parse(item.check.checkedAt))
  )
}

const store = createStore<Saved[]>('chernovik:mine:v1', [], (value) =>
  Array.isArray(value) ? value.filter(isSaved) : null,
)

export const getMine = store.get
export const useMine = store.use

export const isMine = (id: string) => store.get().some((item) => item.card.id === id)

export function saveToMine(card: Card, check: WebCheck) {
  if (!isSaved({ card, check }) || isMine(card.id)) return
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
