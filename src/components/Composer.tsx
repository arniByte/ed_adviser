import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { LIMITS } from '../../core/protocol'
import { transcribe } from '../lib/api'
import { canRecord, MAX_SECONDS, startRecording, type Recording } from '../lib/voice'
import { ArrowUp, Mic } from './icons'
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
}

/** На сенсорном экране автофокус поднял бы клавиатуру поверх вопроса. */
const HAS_KEYBOARD = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches

type Voice =
  { state: 'off' } | { state: 'on'; recording: Recording; seconds: number } | { state: 'reading' }

export function Composer({
  placeholder,
  onSubmit,
  busy = false,
  autoFocus = false,
  docked = false,
}: Props) {
  const [text, setText] = useState('')
  const [voice, setVoice] = useState<Voice>({ state: 'off' })
  const [problem, setProblem] = useState('')
  const field = useRef<HTMLTextAreaElement>(null)

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
    setProblem('')
    try {
      setVoice({ state: 'on', recording: await startRecording(), seconds: 0 })
    } catch {
      setProblem('Нет доступа к микрофону. Разреши его в настройках браузера или ответь текстом.')
    }
  }

  const finish = async () => {
    if (voice.state !== 'on') return
    setVoice({ state: 'reading' })
    try {
      const spoken = await transcribe(await voice.recording.stop())
      if (spoken) setText((current) => [current.trim(), spoken].filter(Boolean).join(' '))
      else setProblem('Не расслышал. Попробуй ещё раз, чуть ближе к микрофону.')
    } catch (error) {
      setProblem((error as Error).message)
    }
    setVoice({ state: 'off' })
    field.current?.focus()
  }

  const cancel = () => {
    if (voice.state === 'on') voice.recording.cancel()
    setVoice({ state: 'off' })
  }

  // Запись сама заканчивается на пределе длины, чтобы файл точно прошёл на сервер.
  const seconds = voice.state === 'on' ? voice.seconds : 0
  const finishRef = useRef(finish)
  finishRef.current = finish
  useEffect(() => {
    if (seconds >= MAX_SECONDS) void finishRef.current()
  }, [seconds])

  return (
    <form className={`composer ${docked ? 'composer--docked' : ''}`} onSubmit={submit}>
      <div className="composer__row">
        <textarea
          ref={field}
          className="composer__field"
          rows={1}
          value={text}
          maxLength={LIMITS.messageChars}
          placeholder={placeholder}
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
      {problem && (
        <p className="composer__problem" role="alert">
          {problem}
        </p>
      )}

      {voice.state !== 'off' && (
        <div className="voice" role="dialog" aria-label="Запись голоса">
          <Orb
            className="voice__orb"
            mood={voice.state === 'on' ? 'listening' : 'thinking'}
            level={voice.state === 'on' ? voice.recording.level : undefined}
          />
          <p className="label voice__status" aria-live="polite">
            {voice.state === 'on'
              ? `говори · ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
              : 'расшифровываю'}
          </p>
          {voice.state === 'on' && (
            <div className="voice__actions">
              <button type="button" className="chip" onClick={cancel}>
                Отмена
              </button>
              <button type="button" className="chip chip--solid" onClick={finish}>
                Готово
              </button>
            </div>
          )}
        </div>
      )}
    </form>
  )
}
