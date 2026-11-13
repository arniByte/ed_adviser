import { useEffect, useState } from 'react'
import { cards } from '../../../core/knowledge'
import { shortHash, type ProofManifest } from '../../../core/proof'
import { Check, External, Seal } from '../../components/icons'
import { loadManifest, proveCard } from '../../lib/proofs'
import { plural } from '../../lib/plural'
import './Proofs.css'

const REPO_FILE = 'https://github.com/arniByte/ed_adviser/blob/main/public/proofs.json'
const SCRIPT = 'https://github.com/arniByte/ed_adviser/blob/main/scripts/proofs.ts'

const STEPS = [
  {
    title: 'Цитата из источника',
    text: 'У каждой карточки есть дословная фраза со страницы источника. Скрипт открывает страницу и ищет эту фразу. Научные статьи сверяются по DOI в Crossref: название, автор и год.',
  },
  {
    title: 'Отпечаток карточки',
    text: 'Из текста карточки считается SHA-256. Изменится хоть одна буква — отпечаток станет другим, и проверку придётся пройти заново. За этим следит CI.',
  },
  {
    title: 'Дерево Меркла',
    text: 'Отпечатки всех карточек сворачиваются в один корень, и он хранится в репозитории. Браузер проходит путь от карточки до корня и убеждается, что карточка — из опубликованной базы.',
  },
]

interface Summary {
  verified: number
  total: number
  quotes: number
  dois: number
  ms: number
}

export function Proofs() {
  const [data, setData] = useState<ProofManifest | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    loadManifest().then(setData, () => setData(null))
  }, [])

  const runAll = async () => {
    setRunning(true)
    const started = performance.now()
    const results = await Promise.all(cards.map((card) => proveCard(card.id)))
    setSummary({
      verified: results.filter((result) => result.verdict === 'verified').length,
      total: results.length,
      quotes: results.filter((result) => result.check?.kind === 'quote').length,
      dois: results.filter((result) => result.check?.kind === 'doi').length,
      ms: performance.now() - started,
    })
    setRunning(false)
  }

  const checkedAt = data
    ? Object.values(data.cards)
        .map((proof) => proof.check?.checkedAt ?? '')
        .sort()
        .at(-1)
    : undefined

  return (
    <main className="page proofs">
      <div className="proofs__seal rise" aria-hidden="true">
        <Seal />
      </div>
      <h1 className="display rise" style={{ '--i': 1 } as React.CSSProperties}>
        Пруфы
      </h1>
      <p className="lead proofs__lead rise" style={{ '--i': 2 } as React.CSSProperties}>
        Каждый факт наставника можно проверить: откуда он, не изменён ли он и входит ли в
        опубликованную базу. Проверка идёт прямо в твоём браузере и занимает миллисекунды.
      </p>

      <section className="proofs__run surface rise" style={{ '--i': 3 } as React.CSSProperties}>
        <div>
          <p className="caption">Корень базы знаний</p>
          <p className="proofs__root">{data ? shortHash(data.root) : '…'}</p>
          <p className="caption">
            {cards.length} карточек
            {checkedAt
              ? ` · источники проверены ${new Date(checkedAt).toLocaleDateString('ru-RU')}`
              : ''}
          </p>
        </div>
        <button className="btn btn--primary" onClick={runAll} disabled={!data || running}>
          {running ? 'Проверяю…' : 'Проверить всю базу'}
        </button>
        {summary && (
          <p className="proofs__result" aria-live="polite">
            <Check />
            {summary.verified} из {summary.total} сошлись за {Math.max(1, Math.round(summary.ms))}{' '}
            мс · {summary.quotes} {plural(summary.quotes, ['цитата', 'цитаты', 'цитат'])} и{' '}
            {summary.dois} DOI
          </p>
        )}
      </section>

      <ol className="proofs__steps">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="proofs__step rise"
            style={{ '--i': 4 + index } as React.CSSProperties}
          >
            <span className="proofs__number">{index + 1}</span>
            <span>
              <span className="row__title">{step.title}</span>
              <span className="proofs__text">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>

      <section className="proofs__agents">
        <h2 className="title">Для агентов</h2>
        <p className="proofs__text">
          Манифест лежит по адресу <code>/proofs.json</code>: отпечатки, пути до корня и результаты
          проверок. Любой агент может пересчитать их по карточкам из репозитория и не верить
          интерфейсу на слово.
        </p>
        <div className="proofs__links">
          <a
            className="btn btn--glass btn--small"
            href={REPO_FILE}
            target="_blank"
            rel="noreferrer"
          >
            Манифест в репозитории <External />
          </a>
          <a className="btn btn--glass btn--small" href={SCRIPT} target="_blank" rel="noreferrer">
            Скрипт проверки <External />
          </a>
        </div>
      </section>

      <p className="disclaimer proofs__note">
        Пруф подтверждает, что карточка совпадает с проверенной версией и цитата была на странице в
        день проверки. Он не заменяет чтение источника и не делает совет официальным требованием.
      </p>
    </main>
  )
}
