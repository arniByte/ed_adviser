/**
 * Пруфы базы знаний: отпечаток каждой карточки и дерево Меркла над всеми карточками.
 *
 * Отпечаток листа — SHA-256 от «leaf:» и канонического JSON карточки, узла — от «node:»
 * и двух дочерних отпечатков. Разные префиксы не дают выдать узел за карточку.
 * Корень дерева хранится в репозитории: совпадение пути с корнем доказывает, что
 * карточка входит в опубликованную версию базы и не менялась после проверки.
 */

export type Side = 'l' | 'r'
/** Шаг пути до корня: с какой стороны стоит соседний отпечаток и сам отпечаток. */
export type PathStep = [Side, string]

export interface CardCheck {
  /** quote — цитата найдена на странице, doi — публикация подтверждена в Crossref. */
  kind: 'quote' | 'doi'
  ok: boolean
  checkedAt: string
  /** Отпечаток карточки в момент проверки: если карточку поменяли, проверку надо повторить. */
  checkedHash: string
  status?: number
  detail: string
}

export interface CardProof {
  hash: string
  path: PathStep[]
  check?: CardCheck
}

export interface ProofManifest {
  version: 1
  scheme: string
  root: string
  builtAt: string
  cards: Record<string, CardProof>
}

export const SCHEME = 'sha256; leaf = H("leaf:" + canonical JSON); node = H("node:" + left + right)'

/** JSON с отсортированными ключами: один и тот же объект всегда даёт одну и ту же строку. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const leafHash = (item: unknown) => sha256(`leaf:${canonical(item)}`)
const nodeHash = (left: string, right: string) => sha256(`node:${left}${right}`)

export interface Tree {
  root: string
  paths: PathStep[][]
}

/** Строит дерево над листьями в заданном порядке. Непарный узел поднимается на уровень выше без изменений. */
export async function buildTree(leaves: string[]): Promise<Tree> {
  if (leaves.length === 0) throw new Error('Пустое дерево')
  const paths: PathStep[][] = leaves.map(() => [])
  let level = leaves.map((hash, index) => ({ hash, members: [index] }))

  while (level.length > 1) {
    const next: typeof level = []
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]
      const right = level[i + 1]
      if (!right) {
        next.push(left)
        continue
      }
      for (const member of left.members) paths[member].push(['r', right.hash])
      for (const member of right.members) paths[member].push(['l', left.hash])
      next.push({
        hash: await nodeHash(left.hash, right.hash),
        members: [...left.members, ...right.members],
      })
    }
    level = next
  }
  return { root: level[0].hash, paths }
}

/** Поднимается от листа по пути и сравнивает результат с корнем. */
export async function verifyPath(leaf: string, path: PathStep[], root: string): Promise<boolean> {
  let hash = leaf
  for (const [side, sibling] of path) {
    hash = side === 'l' ? await nodeHash(sibling, hash) : await nodeHash(hash, sibling)
  }
  return hash === root
}

export type Verdict = 'verified' | 'changed' | 'outside' | 'unchecked'

export interface CardVerification {
  verdict: Verdict
  hash: string
  steps: number
}

/**
 * Полная проверка карточки в браузере: отпечаток совпадает с проверенным,
 * путь сходится к корню, а проверка источника пройдена именно для этой версии.
 */
export async function verifyCard(
  item: unknown,
  proof: CardProof | undefined,
  root: string,
): Promise<CardVerification> {
  const hash = await leafHash(item)
  if (!proof) return { verdict: 'outside', hash, steps: 0 }
  if (proof.hash !== hash) return { verdict: 'changed', hash, steps: proof.path.length }
  if (!(await verifyPath(hash, proof.path, root)))
    return { verdict: 'outside', hash, steps: proof.path.length }
  const checked = proof.check?.ok && proof.check.checkedHash === hash
  return { verdict: checked ? 'verified' : 'unchecked', hash, steps: proof.path.length }
}

/** Короткая запись отпечатка для интерфейса: первые и последние символы. */
/**
 * Пруф карточки из интернета. Сервер открыл страницу и нашёл на ней цитату,
 * затем снял отпечаток карточки. Браузер пересчитывает отпечаток сам.
 */
export interface WebCheck {
  hash: string
  /** Когда сервер открыл страницу и нашёл цитату, ISO 8601. */
  checkedAt: string
}

export const shortHash = (hash: string) => `${hash.slice(0, 6)}…${hash.slice(-4)}`
