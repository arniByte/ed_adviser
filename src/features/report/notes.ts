import { getCard, getMistake, getScenario, zoneTitle } from '../../../core/knowledge'
import type { SessionRecord } from '../../../core/progress'

export const DISCLAIMER =
  'Советы носят информационный характер и не заменяют официальные требования вузов и работодателей.'

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

/** Карточки, на которые опирались разборы сессии, в порядке первого появления. */
export function sessionCards(session: SessionRecord) {
  const ids = [...new Set(session.items.flatMap((item) => item.cards))]
  return ids.map(getCard).filter((card) => card !== undefined)
}

const plain = (text: string) => text.replace(/\s*\[(?:adm|job|onb)-[a-z0-9-]+\]/g, '').trim()

/** Разбор в формате Markdown: его понимают заметки на телефоне, Notion и Obsidian. */
export function toMarkdown(session: SessionRecord): string {
  const scenario = getScenario(session.scenario)
  const total = session.items.reduce((sum, item) => sum + item.score, 0)
  const lines = [
    `# Черновик — разбор тренировки «${scenario?.title}»`,
    `${formatDate(session.date)} · ${total} из ${session.items.length * 3}`,
    '',
  ]
  if (session.summary) lines.push(session.summary, '')
  if (session.plan.length > 0) {
    lines.push('## Что сделать до настоящего', ...session.plan.map((step) => `- [ ] ${step}`), '')
  }

  session.items.forEach((item, index) => {
    lines.push(
      `## ${index + 1}. ${item.title} — ${item.score} из 3`,
      `Зона: ${zoneTitle(item.scenario, item.zone)}`,
      '',
    )
    if (item.situation) lines.push(item.situation, '')
    lines.push(`**Вопрос.** ${item.question}`, '', `**Мой ответ.** ${item.answer}`, '')
    if (item.right) lines.push(`**Это верно.** ${plain(item.right)}`, '')
    if (item.improve) lines.push(`**Что улучшить.** ${plain(item.improve)}`, '')
    if (item.example) lines.push(`**Удачный пример.** ${plain(item.example)}`, '')
    for (const id of item.mistakes) {
      const mistake = getMistake(id)
      if (mistake)
        lines.push(`**Типовая ошибка: ${mistake.title}.** Как сказать иначе: ${mistake.better}`, '')
    }
  })

  const cards = sessionCards(session)
  if (cards.length > 0) {
    lines.push(
      '## Источники',
      ...cards.map((card) => `- ${card.title} — ${card.source.publisher}: ${card.source.url}`),
      '',
    )
  }
  lines.push(`_${DISCLAIMER}_`)
  return lines.join('\n')
}

/** На телефоне открывает системное «Поделиться», на компьютере скачивает файл. */
export async function exportNotes(session: SessionRecord): Promise<'shared' | 'saved'> {
  const text = toMarkdown(session)
  const title = `Черновик — разбор ${formatDate(session.date)}`
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'shared'
    }
  }
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  link.download = `chernovik-${session.date.slice(0, 10)}.md`
  link.click()
  URL.revokeObjectURL(link.href)
  return 'saved'
}
