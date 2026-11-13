import type { ReactNode } from 'react'
import { cleanCitations } from '../../core/protocol'
import './RichText.css'

interface Props {
  text: string
  /** Номера источников по id карточки. Метки без номера не показываются. */
  numbers?: Map<string, number>
  /** Каждое слово проявляется из размытия, когда появляется впервые. */
  reveal?: boolean
  /** Нажатие на сноску. Без обработчика сноска просто показывает номер. */
  onCite?: (cardId: string, number: number) => void
  className?: string
}

const INLINE = /\*\*(.+?)\*\*|\[((?:adm|job|onb)-[a-z0-9-]+)\]/g
const BULLET = /^\s*[-•*]\s+/
const ORDERED = /^\s*\d+[.)]\s+/

/** Счётчик слов внутри блока: ключ слова не меняется, пока текст дописывается. */
interface Words {
  key: string
  count: number
  reveal: boolean
  onCite?: Props['onCite']
}

/**
 * Делит текст на слова. Ключ слова — его порядковый номер в блоке, поэтому React
 * монтирует только новые слова, и анимация проигрывается у каждого один раз.
 */
function words(text: string, ctx: Words): ReactNode[] {
  if (!ctx.reveal) return [text]
  return text
    .split(/(\s+)/)
    .filter(Boolean)
    .map((part) =>
      /^\s+$/.test(part) ? (
        part
      ) : (
        <span key={`${ctx.key}-${ctx.count++}`} className="w">
          {part}
        </span>
      ),
    )
}

function inline(text: string, numbers: Props['numbers'], ctx: Words): ReactNode[] {
  const nodes: ReactNode[] = []
  let cursor = 0
  for (const match of text.matchAll(INLINE)) {
    let before = text.slice(cursor, match.index)
    cursor = match.index + match[0].length
    const [, bold, cardId] = match
    const number = cardId ? numbers?.get(cardId) : undefined
    // Пробел перед скрытой или надстрочной меткой убираем, чтобы не висел перед точкой.
    if (cardId) before = before.replace(/\s+$/, '')
    if (bold) {
      if (before) nodes.push(...words(before, ctx))
      nodes.push(<strong key={`${ctx.key}-b${match.index}`}>{words(bold, ctx)}</strong>)
      continue
    }
    if (!number) {
      if (before) nodes.push(...words(before, ctx))
      continue
    }
    // Последнее слово, сноска и знак после неё не разрываются переносом строки.
    const [, head, tail] = before.match(/^([\s\S]*?)(\S*)$/)!
    const punctuation = text.slice(cursor).match(/^[.,;:!?»)]+/)?.[0] ?? ''
    cursor += punctuation.length
    if (head) nodes.push(...words(head, ctx))
    const key = `${ctx.key}-c${match.index}`
    const className = ctx.reveal ? 'cite w' : 'cite'
    const onCite = ctx.onCite
    nodes.push(
      <span key={key} className="nobr">
        {tail && words(tail, ctx)}
        {onCite ? (
          <button
            className={className}
            type="button"
            aria-label={`Источник ${number}: открыть пруф`}
            onClick={() => onCite(cardId, number)}
          >
            {number}
          </button>
        ) : (
          <sup className={className}>{number}</sup>
        )}
        {punctuation && words(punctuation, ctx)}
      </span>,
    )
  }
  nodes.push(...words(text.slice(cursor), ctx))
  return nodes
}

type Block = { type: 'p'; text: string } | { type: 'ul' | 'ol'; items: string[] }

function toBlocks(text: string): Block[] {
  const blocks: Block[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const type = BULLET.test(line) ? 'ul' : ORDERED.test(line) ? 'ol' : 'p'
    if (type === 'p') {
      blocks.push({ type, text: trimmed })
      continue
    }
    const item = trimmed.replace(type === 'ul' ? BULLET : ORDERED, '')
    const last = blocks[blocks.length - 1]
    if (last?.type === type) last.items.push(item)
    else blocks.push({ type, items: [item] })
  }
  return blocks
}

export function RichText({ text, numbers, reveal = false, onCite, className = '' }: Props) {
  const blocks = toBlocks(cleanCitations(text))
  return (
    <div className={`rich ${className}`}>
      {blocks.map((block, index) => {
        if (block.type === 'p') {
          return (
            <p key={index}>
              {inline(block.text, numbers, { key: `${index}`, count: 0, reveal, onCite })}
            </p>
          )
        }
        const List = block.type
        return (
          <List key={index}>
            {block.items.map((item, i) => (
              <li key={i}>
                {inline(item, numbers, { key: `${index}-${i}`, count: 0, reveal, onCite })}
              </li>
            ))}
          </List>
        )
      })}
    </div>
  )
}
