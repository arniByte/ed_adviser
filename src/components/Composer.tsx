import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { LIMITS } from '../../core/protocol'
import { transcribe } from '../lib/api'
import { useModal } from '../lib/useModal'
import { canRecord, MAX_SECONDS, startRecording, type Recording } from '../lib/voice'
import { ArrowUp, Mic } from './icons'
import { BlurCycle } from './BlurCycle'
import { NavButton } from './Nav'
import { Orb } from './Orb'
import './Composer.css'

interface Props {
  placeholder: string
  onSubmit: (text: string) => void
  /** Наставник отвечает: отправка временно закрыта. */
  busy?: boolean
  autoFocus?: boolean
  /** Прижимает поле к низу экрана. */
  docked?: boolean
  /** Живая подсказка: «Спроси» и сменяющиеся продолжения вместо обычного placeholder. */
  hints?: string[]
}

/** На сенсорном экране автофокус поднял бы клавиатуру поверх вопроса. */
const HAS_KEYBOARD = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches

type Voice =
  | { state: 'off' | 'requesting' | 'reading' }
  | { state: 'on'; recording: Recording; seconds: number }

interface VoiceSession {
  controller: AbortController
  recording?: Recording
  finishing: boolean
}

export function Composer({
  placeholder,
  onSubmit,
  busy = false,
  autoFocus = false,
  docked = false,
  hints,
}: Props) {
  const [text, setText] = useState('')
  const [voice, setVoice] = useState<Voice>({ state: 'off' })
  const [problem, setProblem] = useState('')
  const field = useRef<HTMLTextAreaElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const session = useRef<VoiceSession | null>(null)

  useEffect(
    () => () => {
      session.current?.controller.abort()
      session.current = null
    },
    [],
  )

  useEffect(() => {
    const element = field.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [text])

  const recording = voice.state === 'on' ? voice.recording : null
  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => {
      setVoice((current) =>
        current.state === 'on' ? { ...current, seconds: current.seconds + 1 } : current,
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [recording])

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const value = text.trim()
    if (!value || busy) return
    onSubmit(value)
    setText('')
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) submit(event)
  }

  const listen = async () => {
    if (session.current) return
    const active: VoiceSession = {
      controller: new AbortController(),
      finishing: false,
    }
    session.current = active
    setProblem('')
    setVoice({ state: 'requesting' })
    try {
      active.recording = await startRecording(active.controller.signal)
      if (session.current === active)
        setVoice({ state: 'on', recording: active.recording, seconds: 0 })
    } catch {
      if (session.current === active) {
        session.current = null
        setVoice({ state: 'off' })
        setProblem('Нет доступа к микрофону. Разреши его в настройках браузера или ответь текстом.')
      }
    }
  }

  const finish = async () => {
    const active = session.current
    if (!active?.recording || active.finishing) return
    active.finishing = true
    setVoice({ state: 'reading' })
    try {
      const audio = await active.recording.stop()
      active.controller.signal.throwIfAborted()
      const spoken = await transcribe(audio, active.controller.signal)
      if (session.current !== active) return
      if (spoken)
        setText((current) =>
          [current.trim(), spoken].filter(Boolean).join(' ').slice(0, LIMITS.messageChars),
        )
      else setProblem('Не расслышал. Попробуй ещё раз, чуть ближе к микрофону.')
    } catch (error) {
      if (session.current === active) setProblem((error as Error).message)
    } finally {
      if (session.current === active) {
        session.current = null
        setVoice({ state: 'off' })
      }
    }
  }

  const cancel = () => {
    session.current?.controller.abort()
    session.current = null
    setVoice({ state: 'off' })
  }

  useModal(dialog, voice.state !== 'off', cancel)

  // Запись сама заканчивается на пределе длины, чтобы файл точно прошёл на сервер.
  const seconds = voice.state === 'on' ? voice.seconds : 0
  const finishRef = useRef(finish)
  finishRef.current = finish
  useEffect(() => {
    if (seconds >= MAX_SECONDS) void finishRef.current()
  }, [seconds])

  return (
    <form className={`composer ${docked ? 'composer--docked' : ''}`} onSubmit={submit}>
      <div className="composer__wrap">
        {/* Кнопка разделов стоит отдельно от поля: её видно и легко нажать. */}
        <NavButton />
        <div className="composer__row">
          {hints && !text && (
            <span className="composer__hint" aria-hidden="true">
              Спроси <BlurCycle items={hints} hold={2200} />
            </span>
          )}
          <textarea
            ref={field}
            className="composer__field"
            rows={1}
            value={text}
            maxLength={LIMITS.messageChars}
            placeholder={hints ? '' : placeholder}
            aria-label={placeholder}
            autoFocus={autoFocus && HAS_KEYBOARD}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
          />
          {canRecord() && (
            <button
              type="button"
              className="composer__button"
              onClick={listen}
              aria-label="Ответить голосом"
            >
              <Mic />
            </button>
          )}
          <button
            type="submit"
            className="composer__button composer__button--send"
            disabled={busy || !text.trim()}
            aria-label="Отправить"
          >
            <ArrowUp />
          </button>
        </div>
      </div>
      {problem && (
        <p className="composer__problem" role="alert">
          {problem}
        </p>
      )}

      {voice.state !== 'off' &&
        createPortal(
          <div
            ref={dialog}
            className="voice"
            role="dialog"
            aria-modal="true"
            aria-label="Запись голоса"
            tabIndex={-1}
          >
            <Orb
              className="voice__orb"
              mood={voice.state === 'on' ? 'listening' : 'thinking'}
              level={voice.state === 'on' ? voice.recording.level : undefined}
            />
            <p className="voice__status" aria-live="polite">
              {voice.state === 'on'
                ? 'Говори, я слушаю'
                : voice.state === 'requesting'
                  ? 'Разреши доступ к микрофону'
                  : 'Расшифровываю…'}
            </p>
            <p className="caption voice__time">
              {voice.state === 'on'
                ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
                : '\u00a0'}
            </p>
            <div className="voice__actions">
              <button type="button" className="btn btn--glass" onClick={cancel}>
                Отмена
              </button>
              {voice.state === 'on' && (
                <button type="button" className="btn btn--primary" onClick={finish}>
                  Готово
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </form>
  )
}
