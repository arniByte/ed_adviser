import { useState } from 'react'
import { cleanCitations } from '../../../core/protocol'
import type { Card } from '../../../core/types'
import { Check, Copy, Share } from '../../components/icons'
import { useMentor } from '../../lib/mentor'
import { answerCard, shareImage } from '../../lib/shareCard'

/** Текст ответа без служебных меток и разметки — для буфера обмена и карточки. */
function plain(lead: string) {
  return cleanCitations(lead)
    .replace(/\[(?:adm|job|onb|web)-[a-z0-9-]+\]/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .trim()
}

/** Микрокнопки под ответом: скопировать вместе с источниками или поделиться карточкой. */
export function AnswerActions({
  question,
  lead,
  sources,
}: {
  question: string
  lead: string
  sources: Card[]
}) {
  const mentor = useMentor()
  const [done, setDone] = useState<'copy' | 'share' | null>(null)
  const flash = (what: 'copy' | 'share') => {
    setDone(what)
    window.setTimeout(() => setDone(null), 1800)
  }

  const copy = async () => {
    const links = sources.map((card, i) => `${i + 1}. ${card.source.publisher}: ${card.source.url}`)
    const text = [
      `— ${question}`,
      '',
      plain(lead),
      ...(links.length ? ['', 'Источники:', ...links] : []),
    ].join('\n')
    await navigator.clipboard.writeText(text)
    flash('copy')
  }

  const share = async () => {
    const blob = await answerCard(question, plain(lead), mentor.color)
    await shareImage(blob, 'chernovik-otvet.png', 'Ответ наставника')
    flash('share')
  }

  return (
    <div className="answer-actions">
      <button type="button" className="answer-actions__button" onClick={copy}>
        {done === 'copy' ? <Check /> : <Copy />}
        {done === 'copy' ? 'Скопировано' : 'Скопировать'}
      </button>
      <button type="button" className="answer-actions__button" onClick={share}>
        {done === 'share' ? <Check /> : <Share />}
        {done === 'share' ? 'Готово' : 'Карточкой'}
      </button>
    </div>
  )
}
