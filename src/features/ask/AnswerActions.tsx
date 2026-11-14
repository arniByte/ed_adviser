import { useState } from 'react'
import type { Card } from '../../../core/types'
import { Check, Copy } from '../../components/icons'
import { plainAnswer } from '../../lib/chatLook'

/** Микрокнопка под ответом: скопировать текст вместе со ссылками на источники. */
export function AnswerActions({
  question,
  lead,
  sources,
}: {
  question: string
  lead: string
  sources: Card[]
}) {
  const [done, setDone] = useState(false)

  const copy = async () => {
    const links = sources.map((card, i) => `${i + 1}. ${card.source.publisher}: ${card.source.url}`)
    const text = [
      `— ${question}`,
      '',
      plainAnswer(lead),
      ...(links.length ? ['', 'Источники:', ...links] : []),
    ].join('\n')
    await navigator.clipboard.writeText(text)
    setDone(true)
    window.setTimeout(() => setDone(false), 1800)
  }

  return (
    <div className="answer-actions">
      <button type="button" className="answer-actions__button" onClick={copy}>
        {done ? <Check /> : <Copy />}
        {done ? 'Скопировано' : 'Скопировать'}
      </button>
    </div>
  )
}
