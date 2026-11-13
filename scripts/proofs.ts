/**
 * Сборка и проверка пруфов базы знаний.
 *
 *   npm run proofs            пересобрать отпечатки и дерево, проверки источников сохранить
 *   npm run proofs -- --fetch заново проверить источники: цитаты на страницах и DOI в Crossref
 *   npm run proofs:check      для CI: манифест совпадает с базой, все проверки пройдены
 *
 * Результат — public/proofs.json: его читает интерфейс и любой внешний агент.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { cards } from '../core/knowledge.js'
import {
  buildTree,
  leafHash,
  SCHEME,
  type CardCheck,
  type CardProof,
  type ProofManifest,
} from '../core/proof.js'
import type { Card } from '../core/types.js'
import { containsQuote, fetchPage, htmlToText, normalize } from './lib/page-text.js'

const MANIFEST = new URL('../public/proofs.json', import.meta.url)
const args = new Set(process.argv.slice(2))
const today = new Date().toISOString().slice(0, 10)

function readManifest(): ProofManifest | null {
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf8')) as ProofManifest
  } catch {
    return null
  }
}

/** Карточки в порядке id: так дерево не зависит от того, в каком файле лежит карточка. */
const ordered = [...cards].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

async function build(previous: ProofManifest | null): Promise<ProofManifest> {
  const hashes = await Promise.all(ordered.map(leafHash))
  const tree = await buildTree(hashes)
  const proofs: Record<string, CardProof> = {}
  ordered.forEach((card, index) => {
    proofs[card.id] = {
      hash: hashes[index],
      path: tree.paths[index],
      check: previous?.cards[card.id]?.check,
    }
  })
  return { version: 1, scheme: SCHEME, root: tree.root, builtAt: today, cards: proofs }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Повторяет запрос при лимите (429) и обрыве соединения: оба случая не говорят ничего о цитате. */
async function fetchWithRetry(url: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      const page = await fetchPage(url)
      if (page.status !== 429 || attempt === 4) return page
    } catch (error) {
      if (attempt === 4) throw error
    }
    await sleep(attempt * 6000)
  }
}

const words = (text: string) =>
  normalize(text)
    .toLowerCase()
    .replace(/[^a-zа-яё0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

async function checkDoi(card: Card, hash: string): Promise<CardCheck> {
  const doi = card.source.url.replace('https://doi.org/', '')
  let response: Response
  for (let attempt = 1; ; attempt++) {
    response = await fetch(`https://api.crossref.org/works/${doi}`, {
      headers: { 'user-agent': 'chernovik-proofs/1.0' },
      signal: AbortSignal.timeout(30_000),
    })
    if (response.status !== 429 || attempt === 4) break
    await sleep(attempt * 6000)
  }
  const base = {
    kind: 'doi' as const,
    checkedAt: today,
    checkedHash: hash,
    status: response.status,
  }
  if (!response.ok) return { ...base, ok: false, detail: `Crossref ответил ${response.status}` }

  const work = (await response.json()).message
  const title = words(work.title?.[0] ?? '')
  const ours = words(card.source.title)
  const firstAuthor = work.author?.[0]?.family ?? ''
  // Журнальную статью цитируют по году выпуска: онлайн-версия нередко выходит годом раньше.
  const year = (work['published-print'] ?? work.issued)?.['date-parts']?.[0]?.[0]
  const journal = htmlToText(work['container-title']?.[0] ?? '')
  // Подзаголовок в Crossref бывает опущен или дописан, поэтому достаточно, чтобы одно название содержало другое.
  const titleOk = title.length > 0 && (title.includes(ours) || ours.includes(title))
  const authorOk = firstAuthor !== '' && card.source.publisher.includes(firstAuthor)
  const yearOk = !card.source.year || card.source.year === year
  return {
    ...base,
    ok: titleOk && authorOk && yearOk,
    detail:
      `Crossref: «${work.title?.[0]}», ${firstAuthor}${(work.author?.length ?? 0) > 1 ? ' и др.' : ''}, ${year}, ${journal}`.trim(),
  }
}

async function checkQuote(card: Card, hash: string): Promise<CardCheck> {
  const base = { kind: 'quote' as const, checkedAt: today, checkedHash: hash }
  if (!card.source.quote) return { ...base, ok: false, detail: 'У карточки нет цитаты' }
  try {
    const page = await fetchWithRetry(card.source.url)
    const found = page.status < 400 && containsQuote(page.text, card.source.quote)
    return {
      ...base,
      ok: found,
      status: page.status,
      detail: found ? 'Цитата найдена на странице' : `Цитаты нет на странице (HTTP ${page.status})`,
    }
  } catch (error) {
    return { ...base, ok: false, detail: `Страница не открылась: ${(error as Error).message}` }
  }
}

/** Запросы к одному сайту идут по очереди: так сайты с лимитами не отвечают 429. */
async function refresh(manifest: ProofManifest, onlyStale: boolean) {
  const byHost = new Map<string, Card[]>()
  for (const card of ordered) {
    const proof = manifest.cards[card.id]
    if (onlyStale && proof.check?.ok && proof.check.checkedHash === proof.hash) continue
    const host = new URL(card.source.url).host
    byHost.set(host, [...(byHost.get(host) ?? []), card])
  }
  await Promise.all(
    [...byHost.values()].map(async (queue) => {
      for (const card of queue) {
        const proof = manifest.cards[card.id]
        proof.check = card.source.url.startsWith('https://doi.org/')
          ? await checkDoi(card, proof.hash)
          : await checkQuote(card, proof.hash)
        console.log(`${proof.check.ok ? '✓' : '✗'} ${card.id}: ${proof.check.detail}`)
        await sleep(1200)
      }
    }),
  )
}

function problems(manifest: ProofManifest): string[] {
  return ordered.flatMap((card) => {
    const proof = manifest.cards[card.id]
    if (!proof.check) return [`${card.id}: источник ещё не проверялся`]
    if (proof.check.checkedHash !== proof.hash)
      return [`${card.id}: карточку изменили после проверки`]
    if (!proof.check.ok) return [`${card.id}: ${proof.check.detail}`]
    return []
  })
}

const previous = readManifest()
const manifest = await build(previous)

if (args.has('--check')) {
  const issues = problems(manifest)
  if (!previous || previous.root !== manifest.root) {
    issues.unshift('public/proofs.json устарел: запустите npm run proofs')
  }
  if (issues.length > 0) {
    console.error(issues.map((issue) => `  ✗ ${issue}`).join('\n'))
    process.exit(1)
  }
  console.log(`пруфы в порядке: ${ordered.length} карточек, корень ${manifest.root.slice(0, 16)}…`)
} else {
  if (args.has('--fetch')) await refresh(manifest, args.has('--stale'))
  // Дата сборки меняется только вместе с содержимым, чтобы файл не шумел в истории.
  if (previous && previous.root === manifest.root && !args.has('--fetch'))
    manifest.builtAt = previous.builtAt
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 1)}\n`)
  const issues = problems(manifest)
  console.log(`корень ${manifest.root}`)
  console.log(issues.length === 0 ? 'все источники подтверждены' : issues.join('\n'))
}
