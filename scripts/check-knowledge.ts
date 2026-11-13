/**
 * Проверяет целостность базы знаний: уникальность id, ссылки между карточками,
 * кейсами и ошибками. С флагом --links дополнительно запрашивает каждый источник.
 */
import { cards, cases, mistakes, scenarios, getCard, getMistake } from '../core/knowledge'

const problems: string[] = []
const fail = (message: string) => problems.push(message)

const seen = new Set<string>()
for (const item of [...cards, ...cases, ...mistakes]) {
  if (seen.has(item.id)) fail(`повторяется id ${item.id}`)
  seen.add(item.id)
}

const zonesOf = new Map(scenarios.map((s) => [s.id, new Set(s.zones.map((z) => z.id))]))
for (const item of [...cards, ...cases, ...mistakes]) {
  if (!zonesOf.get(item.scenario)?.has(item.zone)) fail(`${item.id}: неизвестная зона ${item.zone}`)
}

for (const card of cards) {
  if (!/^https:\/\//.test(card.source.url)) fail(`${card.id}: источник без https-ссылки`)
  if (card.text.length < 120) fail(`${card.id}: слишком короткий текст`)
}

for (const mistake of mistakes) {
  if (!getCard(mistake.card)) fail(`${mistake.id}: нет карточки ${mistake.card}`)
  if (mistake.sounds.length === 0) fail(`${mistake.id}: нет примеров формулировок`)
}

for (const item of cases) {
  for (const id of item.cards) if (!getCard(id)) fail(`${item.id}: нет карточки ${id}`)
  for (const id of item.mistakes) if (!getMistake(id)) fail(`${item.id}: нет ошибки ${id}`)
  if (item.criteria.length < 3) fail(`${item.id}: меньше трёх критериев`)
}

for (const scenario of scenarios) {
  for (const zone of scenario.zones) {
    const has = (list: { scenario: string; zone: string }[]) =>
      list.some((x) => x.scenario === scenario.id && x.zone === zone.id)
    if (!has(cards)) fail(`${scenario.id}/${zone.id}: нет карточек`)
    if (!has(cases)) fail(`${scenario.id}/${zone.id}: нет кейсов`)
    if (!has(mistakes)) fail(`${scenario.id}/${zone.id}: нет типовых ошибок`)
  }
}

async function checkLinks() {
  const urls = [...new Set(cards.map((c) => c.source.url))]
  const headers = { 'user-agent': 'Mozilla/5.0 (knowledge-check)' }
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, {
          headers,
          redirect: 'follow',
          signal: AbortSignal.timeout(30_000),
        })
        // Издательства отдают 403 роботам на страницах DOI — это не битая ссылка.
        if (response.status >= 400 && response.status !== 403)
          fail(`${url}: HTTP ${response.status}`)
      } catch (error) {
        fail(`${url}: ${(error as Error).message}`)
      }
    }),
  )
  console.log(`проверено ссылок: ${urls.length}`)
}

if (process.argv.includes('--links')) await checkLinks()

console.log(
  `сценариев: ${scenarios.length}, карточек: ${cards.length}, кейсов: ${cases.length}, ошибок: ${mistakes.length}`,
)
if (problems.length > 0) {
  console.error(problems.map((p) => `  ✗ ${p}`).join('\n'))
  process.exit(1)
}
console.log('база знаний в порядке')
