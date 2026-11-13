/** Собирает docs/knowledge-base.md — читаемый список карточек, кейсов и ошибок с источниками. */
import { writeFileSync } from 'node:fs'
import { cards, cases, mistakes, scenarios } from '../core/knowledge.js'
import { KIND_LABEL, type SourceKind } from '../core/types.js'

const lines: string[] = [
  '# База знаний',
  '',
  '> Файл собран командой `npm run docs:knowledge` из JSON в папке `knowledge/`. Правки вносятся там.',
  '',
  `Карточек: ${cards.length} · открытых источников: ${new Set(cards.map((c) => c.source.url)).size} · кейсов: ${cases.length} · типовых ошибок: ${mistakes.length}`,
  '',
  '| Тип источника | Карточек |',
  '| --- | --- |',
  ...(Object.keys(KIND_LABEL) as SourceKind[]).map(
    (kind) => `| ${KIND_LABEL[kind]} | ${cards.filter((c) => c.kind === kind).length} |`,
  ),
  '',
]

for (const scenario of scenarios) {
  lines.push(`## ${scenario.title}`, '', scenario.lead, '')
  for (const zone of scenario.zones) {
    const inZone = <T extends { scenario: string; zone: string }>(items: T[]) =>
      items.filter((item) => item.scenario === scenario.id && item.zone === zone.id)

    lines.push(`### ${zone.title}`, '', '**Карточки**', '')
    for (const card of inZone(cards)) {
      const year = card.source.year ? `, ${card.source.year}` : ''
      lines.push(
        `- **${card.title}** (${KIND_LABEL[card.kind]}). ${card.text}  `,
        `  Источник: [${card.source.title}](${card.source.url}) — ${card.source.publisher}${year}. \`${card.id}\``,
      )
    }
    lines.push('', '**Кейсы тренажёра**', '')
    for (const item of inZone(cases))
      lines.push(`- **${item.title}.** ${item.situation} *${item.question}*`)
    lines.push('', '**Типовые ошибки**', '')
    for (const mistake of inZone(mistakes)) {
      lines.push(`- **${mistake.title}.** ${mistake.why} Как лучше: ${mistake.better}`)
    }
    lines.push('')
  }
}

writeFileSync(new URL('../docs/knowledge-base.md', import.meta.url), lines.join('\n'))
console.log(`docs/knowledge-base.md: ${lines.length} строк`)
