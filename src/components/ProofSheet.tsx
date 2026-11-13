import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { shortHash } from '../../core/proof'
import { KIND_LABEL, type Card } from '../../core/types'
import { proveCard, type ProofResult } from '../lib/proofs'
import { plural } from '../lib/plural'
import { Check, Close, External } from './icons'
import './ProofSheet.css'

const REPO = 'https://github.com/arniByte/ed_adviser/blob/main/public/proofs.json'

type Step = 'wait' | 'ok' | 'fail'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

/** Пруф карточки: цитата из источника и три проверки, которые браузер делает сам. */
export function ProofSheet({ card, onClose }: { card: Card; onClose: () => void }) {
  const [result, setResult] = useState<ProofResult | null>(null)
  const [failed, setFailed] = useState(false)
  const [shown, setShown] = useState(0)
  const close = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    proveCard(card.id).then(setResult, () => setFailed(true))
  }, [card.id])

  // Проверки появляются по одной: так видно, что это три разных шага.
  useEffect(() => {
    if (!result || shown >= 3) return
    const timer = setTimeout(() => setShown((value) => value + 1), 220)
    return () => clearTimeout(timer)
  }, [result, shown])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.documentElement.classList.add('locked')
    close.current?.focus({ preventScroll: true })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.classList.remove('locked')
    }
  }, [onClose])

  const check = result?.check
  const fresh = !!result && result.verdict !== 'changed'
  const sourceOk = !!check?.ok && result?.verdict === 'verified'
  const steps: { title: string; detail: string; state: Step }[] = result
    ? [
        {
          title:
            check?.kind === 'doi' ? 'Публикация найдена в Crossref' : 'Цитата найдена в источнике',
          detail: check
            ? `${check.kind === 'doi' ? check.detail : 'Страница открылась, фраза на месте'} · ${formatDate(check.checkedAt)}`
            : 'Источник ещё не проверялся',
          state: sourceOk ? 'ok' : 'fail',
        },
        {
          title: fresh ? 'Карточка не менялась после проверки' : 'Карточку изменили после проверки',
          detail: `Отпечаток SHA-256 ${shortHash(result.hash)}`,
          state: fresh ? 'ok' : 'fail',
        },
        {
          title:
            result.verdict === 'outside'
              ? 'Карточки нет в опубликованной базе'
              : 'Карточка входит в базу знаний',
          detail: `${result.steps} ${plural(result.steps, ['шаг', 'шага', 'шагов'])} до корня ${shortHash(result.root)}`,
          state: result.verdict === 'outside' ? 'fail' : 'ok',
        },
      ]
    : []

  const all = steps.length === 3 && steps.every((step) => step.state === 'ok')

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet glass"
        role="dialog"
        aria-modal="true"
        aria-label={`Пруф карточки «${card.title}»`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet__head">
          <p className="caption">Пруф источника</p>
          <button
            ref={close}
            className="btn btn--glass btn--icon"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <Close />
          </button>
        </header>

        <h2 className="sheet__title">{card.title}</h2>

        {card.source.quote && (
          <blockquote className="sheet__quote">
            <p>«{card.source.quote}»</p>
          </blockquote>
        )}
        <a className="sheet__source" href={card.source.url} target="_blank" rel="noreferrer">
          {KIND_LABEL[card.kind]} · {card.source.publisher}
          {card.source.year ? `, ${card.source.year}` : ''} <External />
        </a>

        <ol className="sheet__steps" aria-live="polite">
          {failed && (
            <li className="sheet__step">Не удалось загрузить пруфы. Проверь соединение.</li>
          )}
          {!result && !failed && <li className="sheet__step caption">Проверяю…</li>}
          {steps.slice(0, shown).map((step) => (
            <li key={step.title} className="sheet__step" data-state={step.state}>
              <span className="sheet__tick" aria-hidden="true">
                {step.state === 'ok' ? <Check /> : '!'}
              </span>
              <span>
                <span className="sheet__step-title">{step.title}</span>
                <span className="caption">{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>

        {result && shown >= 3 && (
          <p className="sheet__verdict caption">
            {all
              ? `Проверено в твоём браузере за ${Math.max(1, Math.round(result.ms))} мс. `
              : 'Пруф не сошёлся — опирайся на источник напрямую. '}
            Пруф подтверждает, что карточка совпадает с проверенной версией и цитата была на
            странице в день проверки. Он не заменяет чтение источника.{' '}
            <a href={REPO} target="_blank" rel="noreferrer">
              Корень базы в репозитории
            </a>
          </p>
        )}
      </section>
    </div>,
    document.body,
  )
}

/** Шторка с пруфом для экрана: её открывают и сноски в тексте, и список источников. */
export function useProofSheet(): [sheet: ReactNode, show: (card: Card) => void] {
  const [card, setCard] = useState<Card | null>(null)
  const close = useCallback(() => setCard(null), [])
  return [card && <ProofSheet card={card} onClose={close} />, setCard]
}
