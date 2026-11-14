import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { leafHash, shortHash, type WebCheck } from '../../core/proof'
import { KIND_LABEL, type Card } from '../../core/types'
import { getMine, saveToMine, useMine, useMineRoot } from '../lib/mine'
import { proveCard, type ProofResult } from '../lib/proofs'
import { plural } from '../lib/plural'
import { useModal } from '../lib/useModal'
import { Check, Close, External } from './icons'
import './ProofSheet.css'

const REPO = 'https://github.com/arniByte/ed_adviser/blob/main/public/proofs.json'

type Step = 'wait' | 'ok' | 'fail'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

const formatMoment = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

interface Props {
  card: Card
  /** Пруф сервера для карточки из интернета. */
  check?: WebCheck
  onClose: () => void
}

/**
 * Пруф карточки: цитата из источника и три проверки. Для общей базы браузер сверяет
 * карточку с опубликованным деревом; для найденного в интернете — с пруфом сервера
 * и с личной базой пользователя.
 */
export function ProofSheet({ card, check: given, onClose }: Props) {
  const web = card.kind === 'web'
  const webCheck = given ?? getMine().find((item) => item.card.id === card.id)?.check
  const [result, setResult] = useState<ProofResult | null>(null)
  const [failed, setFailed] = useState(false)
  const [shown, setShown] = useState(0)
  const dialog = useRef<HTMLElement>(null)
  const mine = useMine()
  const mineRoot = useMineRoot()
  const saved = mine.some((item) => item.card.id === card.id)

  useEffect(() => {
    if (!web) {
      proveCard(card.id).then(setResult, () => setFailed(true))
      return
    }
    // Отпечаток карточки из интернета браузер считает сам и сравнивает с тем, что снял сервер.
    const started = performance.now()
    leafHash(card).then(
      (hash) =>
        setResult({
          verdict: webCheck && hash === webCheck.hash ? 'verified' : 'changed',
          hash,
          steps: 0,
          root: '',
          ms: performance.now() - started,
        }),
      () => setFailed(true),
    )
  }, [card, web, webCheck])

  // Проверки появляются по одной: так видно, что это три разных шага.
  useEffect(() => {
    if (!result || shown >= 3) return
    const timer = setTimeout(() => setShown((value) => value + 1), 220)
    return () => clearTimeout(timer)
  }, [result, shown])

  useModal(dialog, true, onClose)

  const check = result?.check
  const fresh = !!result && result.verdict !== 'changed'
  const sourceOk = !!check?.ok && result?.verdict === 'verified'
  const webSteps: { title: string; detail: string; state: Step }[] =
    result && web
      ? [
          {
            title: webCheck ? 'Цитата найдена на странице' : 'Пруф сервера потерялся',
            detail: webCheck
              ? `Сервер открыл страницу во время поиска · ${formatMoment(webCheck.checkedAt)}`
              : 'Найди эту карточку поиском ещё раз',
            state: webCheck ? 'ok' : 'fail',
          },
          {
            title: fresh ? 'Карточка не менялась после проверки' : 'Отпечаток не совпал',
            detail: `Отпечаток SHA-256 ${shortHash(result.hash)}`,
            state: fresh ? 'ok' : 'fail',
          },
          {
            title: saved ? 'Карточка в твоей базе' : 'Пока не в твоей базе',
            detail: saved
              ? `Корень твоей базы ${mineRoot ? shortHash(mineRoot) : '…'}`
              : 'Сохрани — и Черновик будет опираться на неё дальше',
            state: saved ? 'ok' : 'wait',
          },
        ]
      : []
  const baseSteps: { title: string; detail: string; state: Step }[] =
    result && !web
      ? [
          {
            title:
              check?.kind === 'doi'
                ? 'Публикация найдена в Crossref'
                : 'Цитата найдена в источнике',
            detail: check
              ? `${check.kind === 'doi' ? check.detail : 'Страница открылась, фраза на месте'} · ${formatDate(check.checkedAt)}`
              : 'Источник ещё не проверялся',
            state: sourceOk ? 'ok' : 'fail',
          },
          {
            title: fresh
              ? 'Карточка не менялась после проверки'
              : 'Карточку изменили после проверки',
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
  const steps = web ? webSteps : baseSteps

  const all = steps.length === 3 && steps.every((step) => step.state === 'ok')
  const trusted = web ? steps.slice(0, 2).every((step) => step.state === 'ok') : all

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        ref={dialog}
        className="sheet glass"
        role="dialog"
        aria-modal="true"
        aria-label={`Пруф карточки «${card.title}»`}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet__head">
          <p className="caption">Пруф источника</p>
          <button className="btn btn--glass btn--icon" onClick={onClose} aria-label="Закрыть">
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
                {step.state === 'ok' ? <Check /> : step.state === 'wait' ? '+' : '!'}
              </span>
              <span>
                <span className="sheet__step-title">{step.title}</span>
                <span className="caption">{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>

        {web && result && shown >= 3 && webCheck && !saved && trusted && (
          <button
            className="btn btn--primary sheet__save"
            onClick={() => saveToMine(card, webCheck)}
          >
            Сохранить в мою базу
          </button>
        )}

        {result && shown >= 3 && (
          <p className="sheet__verdict caption">
            {web ? (
              <>
                {trusted
                  ? `Отпечаток пересчитан в твоём браузере за ${Math.max(1, Math.round(result.ms))} мс. `
                  : 'Пруф не сошёлся — опирайся на источник напрямую. '}
                Пруф подтверждает, что фраза была на странице в момент поиска. Он не заменяет чтение
                источника.
              </>
            ) : (
              <>
                {all
                  ? `Проверено в твоём браузере за ${Math.max(1, Math.round(result.ms))} мс. `
                  : 'Пруф не сошёлся — опирайся на источник напрямую. '}
                Пруф подтверждает, что карточка совпадает с проверенной версией и цитата была на
                странице в день проверки. Он не заменяет чтение источника.{' '}
                <a href={REPO} target="_blank" rel="noreferrer">
                  Корень базы в репозитории
                </a>
              </>
            )}
          </p>
        )}
      </section>
    </div>,
    document.body,
  )
}

/**
 * Шторка с пруфом для экрана: её открывают и сноски в тексте, и список источников.
 * checks — пруфы сервера для карточек, найденных в интернете в этом ответе.
 */
export function useProofSheet(
  checks?: Record<string, WebCheck>,
): [sheet: ReactNode, show: (card: Card) => void] {
  const [card, setCard] = useState<Card | null>(null)
  const close = useCallback(() => setCard(null), [])
  return [card && <ProofSheet card={card} check={checks?.[card.id]} onClose={close} />, setCard]
}
