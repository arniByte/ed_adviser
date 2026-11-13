import { useState } from 'react'
import { getScenario, zoneTitle } from '../../../core/knowledge'
import {
  knownMistakeIds,
  planSession,
  recordReview,
  type ReviewRecord,
  type SessionItem,
} from '../../../core/progress'
import type { ScenarioId } from '../../../core/types'
import { Composer } from '../../components/Composer'
import { Disclaimer } from '../../components/Disclaimer'
import { ArrowRight } from '../../components/icons'
import { askMentor } from '../../lib/api'
import { getMemory, updateMemory } from '../../lib/memory'
import { Debrief } from './Debrief'
import { itemFacts, readReview, Step, type Attempt } from './Step'
import './Train.css'

const MAX_ATTEMPTS = 2

function toRecord(item: SessionItem, attempts: Attempt[]): ReviewRecord {
  const facts = itemFacts(item)
  const final = attempts[attempts.length - 1]
  const review = readReview(final.raw, facts.fallbackCards)
  // Ошибки собираются со всех попыток: исправленная со второго раза всё равно была.
  const mistakes = new Set(attempts.flatMap((a) => readReview(a.raw, []).meta?.mistakes ?? []))
  return {
    kind: item.kind,
    refId: item.kind === 'case' ? item.case.id : item.mistake.id,
    scenario: facts.scenario,
    zone: facts.zone,
    title: facts.title,
    situation: facts.situation,
    question: facts.question,
    answer: final.answer,
    score: review.meta?.score ?? 0,
    mistakes: [...mistakes],
    right: review.right,
    improve: review.improve,
    example: review.example,
    cards: review.cards.map((card) => card.id),
    attempts: attempts.length,
  }
}

export function Train({ scenario: scenarioId }: { scenario: ScenarioId }) {
  const scenario = getScenario(scenarioId)!
  const [items] = useState(() => planSession(scenarioId, getMemory()))
  const [phase, setPhase] = useState<'intro' | 'steps' | 'debrief'>('intro')
  const [index, setIndex] = useState(0)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [records, setRecords] = useState<ReviewRecord[]>([])

  const item = items[index]
  const last = attempts[attempts.length - 1]
  const busy = last?.status === 'waiting' || last?.status === 'streaming'
  const reviewed = last?.status === 'done'
  const canRetry = attempts.length < MAX_ATTEMPTS || last?.status === 'failed'

  const answer = async (text: string) => {
    const done = attempts.filter((a) => a.status === 'done')
    const first = done[0]
    const position = done.length
    const patch = (change: Partial<Attempt>) =>
      setAttempts((list) => list.map((a, i) => (i === position ? { ...a, ...change } : a)))
    setAttempts([...done, { answer: text, raw: '', status: 'waiting' }])

    try {
      const raw = await askMentor(
        {
          mode: 'review',
          ...(item.kind === 'case' ? { caseId: item.case.id } : { probeOf: item.mistake.id }),
          answer: text,
          previous: first && {
            answer: first.answer,
            score: readReview(first.raw, []).meta?.score ?? 0,
          },
          knownMistakes: knownMistakeIds(getMemory()),
        },
        { onText: (value) => patch({ raw: value, status: 'streaming' }) },
      )
      patch({ raw, status: 'done' })
    } catch (error) {
      patch({ status: 'failed', error: (error as Error).message })
    }
  }

  const next = () => {
    const record = toRecord(item, attempts)
    updateMemory((memory) => recordReview(memory, record))
    setRecords((list) => [...list, record])
    setAttempts([])
    window.scrollTo({ top: 0 })
    if (index + 1 < items.length) setIndex(index + 1)
    else setPhase('debrief')
  }

  if (phase === 'intro') {
    const probe = items.find((i) => i.kind === 'probe')
    const zones = [...new Set(items.map((i) => zoneTitle(scenarioId, itemFacts(i).zone)))]
    return (
      <main className="page train">
        <section className="intro focus-in">
          <p className="label">тренажёр · {scenario.title}</p>
          <h1 className="intro__title">
            {items.length === 4 ? 'Четыре кейса' : `Кейсов: ${items.length}`}.
            <br />
            Отвечай как вживую.
          </h1>
          <p className="intro__lead">
            Я дам ситуацию и вопрос с подвохом. Ответь текстом или голосом — разберу, что верно, что
            улучшить, и покажу удачный пример. В конце соберу итог и план, его можно сохранить в
            PDF.
          </p>
          {probe?.kind === 'probe' && (
            <p className="intro__memory glass">
              <span className="label">помню с прошлого раза</span>
              Начнём с возврата к ошибке: {probe.mistake.title.toLowerCase()}. Проверим, что она
              ушла.
            </p>
          )}
          <p className="intro__zones label">в этой тренировке: {zones.join(' · ')}</p>
          <button className="chip chip--solid intro__start" onClick={() => setPhase('steps')}>
            Начать <ArrowRight />
          </button>
        </section>
        <Disclaimer />
      </main>
    )
  }

  if (phase === 'debrief') return <Debrief scenario={scenario} records={records} />

  return (
    <main className="page train">
      <Step key={index} item={item} position={index + 1} total={items.length} attempts={attempts} />
      <div className="train__dock">
        {reviewed && (
          <div className="train__actions focus-in">
            <button className="chip chip--solid" onClick={next}>
              {index + 1 < items.length ? 'Следующий кейс' : 'К итогам'} <ArrowRight />
            </button>
            {attempts.length < MAX_ATTEMPTS && (
              <span className="label">или ответь ещё раз — сравню с первой попыткой</span>
            )}
          </div>
        )}
        {canRetry && (
          <Composer
            docked
            busy={busy}
            autoFocus={attempts.length === 0}
            placeholder={
              busy ? 'Разбираю ответ…' : attempts.length === 0 ? 'Твой ответ…' : 'Вторая попытка…'
            }
            onSubmit={answer}
          />
        )}
      </div>
    </main>
  )
}
