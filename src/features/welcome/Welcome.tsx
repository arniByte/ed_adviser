import { useEffect, useRef, useState } from 'react'
import { INTERESTS, INTEREST_CHARS, MAX_INTERESTS } from '../../../core/interests'
import { scenarios } from '../../../core/knowledge'
import { STAGES, type Profile, type Stage } from '../../../core/profile'
import { LIMITS } from '../../../core/protocol'
import type { ScenarioId } from '../../../core/types'
import { AuraMark } from '../../components/AuraMark'
import { ArrowRight, Close, Mic } from '../../components/icons'
import { Mark } from '../../components/Mark'
import { transcribe } from '../../lib/api'
import { getProfile, saveProfile } from '../../lib/profile'
import { go } from '../../lib/route'
import { canRecord, MAX_SECONDS, startRecording, type Recording } from '../../lib/voice'
import { InterestSphere, type SphereNode } from './InterestSphere'
import './Welcome.css'

const STAGE_IDS = Object.keys(STAGES) as Stage[]

/** Чип, который парит: у каждого свой период, поэтому облако не качается строем. */
function Chip({
  pressed,
  index,
  onClick,
  children,
  className = '',
  badge,
}: {
  pressed: boolean
  index: number
  onClick: () => void
  children: React.ReactNode
  className?: string
  badge?: number
}) {
  return (
    <button
      type="button"
      className={`welcome__chip ${className}`}
      aria-pressed={pressed}
      style={{ '--j': index % 7, '--i': index } as React.CSSProperties}
      onClick={onClick}
    >
      {children}
      {badge ? <span className="welcome__badge">{badge}</span> : null}
    </button>
  )
}

/** Поле «своё»: появляется по клику, добавляет интерес по Enter. */
function Own({
  onAdd,
  label = 'Своё',
  autoOpen = false,
  onClose,
}: {
  onAdd: (value: string) => void
  label?: string
  autoOpen?: boolean
  onClose?: () => void
}) {
  const [open, setOpen] = useState(autoOpen)
  const [value, setValue] = useState('')
  const close = () => {
    setValue('')
    setOpen(false)
    onClose?.()
  }
  const add = () => {
    if (value.trim()) onAdd(value.trim())
    close()
  }
  if (!open)
    return (
      <button
        type="button"
        className="welcome__chip welcome__chip--own"
        onClick={() => setOpen(true)}
      >
        + {label}
      </button>
    )
  return (
    <input
      autoFocus
      className="welcome__own"
      value={value}
      maxLength={INTEREST_CHARS}
      placeholder="Например, скейт"
      aria-label="Свой интерес"
      onChange={(event) => setValue(event.target.value)}
      onBlur={add}
      onKeyDown={(event) => {
        if (event.key === 'Enter') add()
        if (event.key === 'Escape') close()
      }}
    />
  )
}

/**
 * Знакомство: кто ты, что впереди, что тебе интересно и что ещё добавить — текстом
 * или голосом. Интересы уходят в промпт: из них Черновик берёт примеры и сравнения.
 * Всё остаётся в браузере и отправляется на сервер только вместе с вопросом.
 */
export function Welcome() {
  const initial = getProfile() ?? {}
  const [stage, setStage] = useState<Stage | undefined>(initial.stage)
  const [goals, setGoals] = useState<ScenarioId[]>(initial.goals ?? [])
  const [interests, setInterests] = useState<string[]>(initial.interests ?? [])
  const [level, setLevel] = useState<string | null>(null)
  const [ownOpen, setOwnOpen] = useState(false)
  const [about, setAbout] = useState(initial.about ?? '')
  const [recording, setRecording] = useState<Recording | null>(null)
  const [hearing, setHearing] = useState(false)
  const [voiceNote, setVoiceNote] = useState('')
  const stopTimer = useRef(0)
  const recordingRef = useRef<Recording | null>(null)
  recordingRef.current = recording

  useEffect(
    () => () => {
      window.clearTimeout(stopTimer.current)
      recordingRef.current?.cancel()
    },
    [],
  )

  const toggleGoal = (id: ScenarioId) =>
    setGoals((list) => (list.includes(id) ? list.filter((g) => g !== id) : [...list, id]))
  const toggleInterest = (item: string) =>
    setInterests((list) =>
      list.includes(item)
        ? list.filter((i) => i !== item)
        : list.length < MAX_INTERESTS
          ? [...list, item]
          : list,
    )
  const addOwn = (item: string) =>
    setInterests((list) =>
      list.some((i) => i.toLowerCase() === item.toLowerCase()) || list.length >= MAX_INTERESTS
        ? list
        : [...list, item],
    )

  const stopVoice = async () => {
    window.clearTimeout(stopTimer.current)
    const current = recordingRef.current
    if (!current) return
    setRecording(null)
    setHearing(true)
    try {
      const text = (await transcribe(await current.stop())).trim()
      if (text) setAbout((value) => `${value.trim()} ${text}`.trim().slice(0, LIMITS.aboutChars))
      setVoiceNote(text ? '' : 'Ничего не расслышал. Попробуй ещё раз.')
    } catch {
      setVoiceNote('Не получилось распознать запись. Можно написать текстом.')
    } finally {
      setHearing(false)
    }
  }

  const startVoice = async () => {
    setVoiceNote('')
    try {
      const next = await startRecording()
      setRecording(next)
      stopTimer.current = window.setTimeout(() => void stopVoice(), MAX_SECONDS * 1000)
    } catch {
      setVoiceNote('Микрофон недоступен. Можно написать текстом.')
    }
  }

  const finish = (profile: Profile) => {
    recordingRef.current?.cancel()
    saveProfile(profile)
    go('/')
  }

  const group = INTERESTS.find((g) => g.id === level)
  const nodes: SphereNode[] = group
    ? [
        { id: 'back', label: '← Все темы', kind: 'back' },
        ...group.items.map((item) => ({
          id: item,
          label: item,
          kind: 'item' as const,
          selected: interests.includes(item),
        })),
        { id: 'own', label: '+ Своё', kind: 'own' },
      ]
    : [
        ...INTERESTS.map((g) => ({
          id: g.id,
          label: g.title,
          kind: 'group' as const,
          count: g.items.filter((item) => interests.includes(item)).length,
        })),
        { id: 'own', label: '+ Своё', kind: 'own' },
      ]
  const pick = (node: SphereNode) => {
    if (node.kind === 'group') setLevel(node.id)
    else if (node.kind === 'back') setLevel(null)
    else if (node.kind === 'own') setOwnOpen(true)
    else toggleInterest(node.id)
  }
  const left = LIMITS.aboutChars - about.length

  return (
    <main className="page welcome">
      <div className="welcome__mark rise" data-listening={!!recording}>
        <AuraMark
          size={196}
          palette="pastel"
          listen={recording?.level}
          mood={hearing ? 'thinking' : undefined}
        />
      </div>
      <h1 className="title welcome__title rise" style={{ '--i': 1 } as React.CSSProperties}>
        {recording ? 'Слушаю тебя' : hearing ? 'Записываю…' : 'Привет! Я Черновик'}
      </h1>
      <p className="lead welcome__lead rise" style={{ '--i': 2 } as React.CSSProperties}>
        Давай познакомимся — тогда советы и примеры будут про тебя, а не про среднего абитуриента.
      </p>

      <section className="welcome__step rise" style={{ '--i': 3 } as React.CSSProperties}>
        <h2 className="welcome__question">Кто ты сейчас?</h2>
        <div className="welcome__chips">
          {STAGE_IDS.map((id, index) => (
            <Chip key={id} index={index} pressed={stage === id} onClick={() => setStage(id)}>
              {STAGES[id]}
            </Chip>
          ))}
        </div>
      </section>

      {stage && (
        <section className="welcome__step welcome__step--in">
          <h2 className="welcome__question">Что впереди?</h2>
          <div className="welcome__chips">
            {scenarios.map((scenario, index) => (
              <Chip
                key={scenario.id}
                index={index + 2}
                pressed={goals.includes(scenario.id)}
                onClick={() => toggleGoal(scenario.id)}
              >
                {scenario.title}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {stage && goals.length > 0 && (
        <section className="welcome__step welcome__step--in">
          <h2 className="welcome__question">Что тебе интересно?</h2>
          <p className="caption welcome__hint">
            Покрути сферу и нажми на тему — раскроются варианты. Из них Черновик берёт примеры.
          </p>
          <InterestSphere key={level ?? 'root'} nodes={nodes} onPick={pick} />
          {ownOpen && <Own autoOpen onAdd={addOwn} onClose={() => setOwnOpen(false)} />}
          {interests.length > 0 && (
            <div className="welcome__chips welcome__mine">
              {interests.map((item, index) => (
                <Chip
                  key={item}
                  index={index}
                  className="welcome__chip--leaf"
                  pressed
                  onClick={() => toggleInterest(item)}
                >
                  {item} <Close />
                </Chip>
              ))}
            </div>
          )}
          <p className="caption" aria-live="polite">
            {interests.length > 0
              ? `Выбрано ${interests.length} из ${MAX_INTERESTS}`
              : 'Можно выбрать до двенадцати'}
          </p>
        </section>
      )}

      {stage && goals.length > 0 && (
        <section className="welcome__step welcome__step--in">
          <h2 className="welcome__question" id="welcome-about">
            Добавить что-то ещё
          </h2>
          <div className="welcome__field" data-recording={!!recording}>
            <textarea
              aria-labelledby="welcome-about"
              className="welcome__about"
              rows={3}
              maxLength={LIMITS.aboutChars}
              value={about}
              placeholder="Город, класс или курс, чего хочешь и что пугает. Можно сказать голосом"
              onChange={(event) => setAbout(event.target.value)}
            />
            <div className="welcome__field-bar">
              {recording || hearing ? (
                <span className="welcome__listener">
                  <Mark
                    size={36}
                    listen={recording?.level}
                    mood={hearing ? 'thinking' : undefined}
                  />
                  <span className="caption">{recording ? 'Слушаю…' : 'Записываю…'}</span>
                </span>
              ) : (
                <span className="caption" data-low={left < 40}>
                  {about.length} / {LIMITS.aboutChars}
                </span>
              )}
              {canRecord() && (
                <button
                  type="button"
                  className="welcome__mic"
                  data-on={!!recording}
                  disabled={hearing}
                  aria-label={recording ? 'Остановить запись' : 'Сказать голосом'}
                  onClick={() => void (recording ? stopVoice() : startVoice())}
                >
                  <Mic />
                  {recording ? 'Готово' : hearing ? 'Слушаю…' : 'Голосом'}
                </button>
              )}
            </div>
          </div>
          {voiceNote && <p className="caption welcome__note">{voiceNote}</p>}
          <p className="caption">Без имени и контактов: ответы хранятся только в этом браузере.</p>
        </section>
      )}

      <div className="welcome__actions rise" style={{ '--i': 4 } as React.CSSProperties}>
        <button
          className="btn btn--primary"
          disabled={!stage || !!recording || hearing}
          onClick={() => finish({ stage, goals, interests, about })}
        >
          Готово <ArrowRight />
        </button>
        <button className="btn btn--glass" onClick={() => finish({})}>
          Пропустить
        </button>
      </div>
    </main>
  )
}
