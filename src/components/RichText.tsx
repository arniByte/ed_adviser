import type { ReactNode } from 'react'
import './RichText.css'

interface Props {
  text: string
  /** Номера источников по id карточки. Метки без номера не показываются. */
  numbers?: Map<string, number>
  /** Курсор в конце, пока ответ ещё пишется. */
  streaming?: boolean
  className?: string
}

const INLINE = /\*\*(.+?)\*\*|\[((?:adm|job|onb)-[a-z0-9-]+)\]/g
/** Модель иногда берёт метку в скобки — «(…[id])»; номеру источника они не нужны. */
const WRAPPED = /\(\s*(\[(?:adm|job|onb)-[a-z0-9-]+\])\s*\)/g
const BULLET = /^\s*[-•*]\s+/
const ORDERED = /^\s*\d+[.)]\s+/

function inline(text: string, numbers: Props['numbers'], key: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let cursor = 0
  for (const match of text.matchAll(INLINE)) {
    let before = text.slice(cursor, match.index)
    cursor = match.index + match[0].length
    const [, bold, cardId] = match
    const number = cardId ? numbers?.get(cardId) : undefined
    // Пробел перед скрытой или надстрочной меткой убираем, чтобы не висел перед точкой.
    if (cardId) before = before.replace(/\s+$/, '')
    if (before) nodes.push(before)
    if (bold) nodes.push(<strong key={`${key}-${match.index}`}>{bold}</strong>)
    else if (number)
      nodes.push(
        <a
          key={`${key}-${match.index}`}
          className="cite"
          href={`#source-${number}`}
          aria-label={`Источник ${number}`}
        >
          {number}
        </a>,
      )
  }
  nodes.push(text.slice(cursor))
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

export function RichText({ text, numbers, streaming, className = '' }: Props) {
  const blocks = toBlocks(text.replace(WRAPPED, '$1'))
  const caret = streaming ? <span className="rich__caret" aria-hidden="true" /> : null
  return (
    <div className={`rich ${className}`}>
      {blocks.map((block, index) => {
        const isLast = index === blocks.length - 1
        if (block.type === 'p') {
          return (
            <p key={index}>
              {inline(block.text, numbers, `${index}`)}
              {isLast && caret}
            </p>
          )
        }
        const List = block.type
        return (
          <List key={index}>
            {block.items.map((item, i) => (
              <li key={i}>
                {inline(item, numbers, `${index}-${i}`)}
                {isLast && i === block.items.length - 1 && caret}
              </li>
            ))}
          </List>
        )
      })}
      {blocks.length === 0 && caret}
    </div>
  )
}
