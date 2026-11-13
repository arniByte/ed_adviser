import { useEffect, useRef, useState } from 'react'
import { zoneTitle } from '../../../core/knowledge'
import { saveSession, type ReviewRecord, type SessionRecord } from '../../../core/progress'
import { parseSections } from '../../../core/protocol'
import type { Scenario } from '../../../core/types'
import { ArrowRight } from '../../components/icons'
import { RichText } from '../../components/RichText'
import { Thinking } from '../ask/Ask'
import { askMentor } from '../../lib/api'
import { useSmoothText } from '../../lib/useSmoothText'
import { updateMemory } from '../../lib/memory'
import { go } from '../../lib/route'
import { ScoreDots } from './ScoreDots'

const planLines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.replace(/^[-•\d.)\s]+/, '').trim())
    .filter(Boolean)

/** Итог тренировки: наставник подводит черту, сессия сохраняется в память. */
export function Debrief({ scenario, records }: { scenario: Scenario; records: ReviewRecord[] }) {
  const [raw, setRaw] = useState('')
  const [status, setStatus] = useState<'waiting' | 'streaming' | 'done'>('waiting')
  const [sessionId] = useState(() => Date.now().toString(36))
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const finish = (text: string) => {
      const { sections } = parseSections(text)
      const session: SessionRecord = {
        id: sessionId,
        scenario: scenario.id,
        date: new Date().toISOString(),
        items: records,
        summary: sections.summary ?? '',
        plan: planLines(sections.plan ?? ''),
      }
      updateMemory((memory) => saveSession(memory, session))
      setStatus('done')
    }

    askMentor(
      {
        mode: 'debrief',
        scenario: scenario.id,
        results: records.map((r) => ({
          title: r.title,
          zone: r.zone,
          score: r.score,
          mistakes: r.mistakes,
        })),
      },
      {
        onText: (text) => {
          setRaw(text)
          setStatus('streaming')
        },
      },
    )
      .then(finish)
      // Сессию сохраняем и без итога наставника: разборы кейсов уже есть.
      .catch(() => finish(''))
  }, [records, scenario, sessionId])

  const shown = useSmoothText(raw, status === 'streaming')
  const { sections } = parseSections(shown)
  const total = records.reduce((sum, r) => sum + r.score, 0)

  return (
    <main className="page train debrief">
      <p className="caption rise">Итог · {scenario.title}</p>
      <h1 className="display debrief__score rise" style={{ '--i': 1 } as React.CSSProperties}>
        {total} из {records.length * 3}
      </h1>

      {status === 'waiting' && <Thinking text="Подвожу итог" />}
      {sections.summary && <RichText text={sections.summary} reveal />}
      {sections.plan && (
        <section className="debrief__plan">
          <h2 className="caption">Что сделать до настоящего</h2>
          <RichText text={sections.plan} reveal />
        </section>
      )}

      <section className="debrief__cases">
        <h2 className="caption">Кейсы</h2>
        <ul className="rows">
          {records.map((record, index) => (
            <li key={index} className="row debrief__case">
              <span>
                <span className="row__title">{record.title}</span>
                <span className="caption">{zoneTitle(record.scenario, record.zone)}</span>
              </span>
              <ScoreDots score={record.score} withVerdict={false} />
            </li>
          ))}
        </ul>
      </section>

      {status === 'done' && (
        <div className="debrief__actions rise">
          <button className="btn btn--primary" onClick={() => go(`/report/${sessionId}`)}>
            Сохранить разбор <ArrowRight />
          </button>
          <button className="btn btn--glass" onClick={() => go('/progress')}>
            Карта прогресса
          </button>
          <button className="btn btn--glass" onClick={() => go('/')}>
            На главную
          </button>
        </div>
      )}
    </main>
  )
}
