import { useEffect, useState } from 'react'
import { getCard } from '../../core/knowledge'
import { verifyCard, type CardCheck, type ProofManifest, type Verdict } from '../../core/proof'

let manifest: Promise<ProofManifest> | null = null

/** Манифест пруфов загружается один раз и только когда понадобился. */
export function loadManifest(): Promise<ProofManifest> {
  manifest ??= fetch('/proofs.json').then((response) => {
    if (!response.ok) throw new Error('Не удалось загрузить пруфы')
    return response.json() as Promise<ProofManifest>
  })
  manifest.catch(() => {
    manifest = null
  })
  return manifest
}

export interface ProofResult {
  verdict: Verdict
  hash: string
  steps: number
  root: string
  check?: CardCheck
  /** Время проверки в браузере, мс. */
  ms: number
}

export async function proveCard(id: string): Promise<ProofResult> {
  const data = await loadManifest()
  const started = performance.now()
  const result = await verifyCard(getCard(id), data.cards[id], data.root)
  return {
    ...result,
    root: data.root,
    check: data.cards[id]?.check,
    ms: performance.now() - started,
  }
}

export type ProofState = Verdict | 'pending' | 'error'

/** Проверяет набор карточек в фоне и возвращает вердикт по каждой. */
export function useProofs(ids: string[]): Record<string, ProofState> {
  const key = ids.join(',')
  const [states, setStates] = useState<Record<string, ProofState>>({})

  useEffect(() => {
    if (!key) return
    let alive = true
    const list = key.split(',')
    Promise.all(
      list.map((id) =>
        proveCard(id)
          .then((result) => [id, result.verdict] as const)
          .catch(() => [id, 'error'] as const),
      ),
    ).then((entries) => {
      if (alive) setStates(Object.fromEntries(entries))
    })
    return () => {
      alive = false
    }
  }, [key])

  return Object.fromEntries(ids.map((id) => [id, states[id] ?? 'pending']))
}
