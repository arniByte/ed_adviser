import { useEffect, useRef, type RefObject } from 'react'

/** Модальное окно удерживает клавиатурный фокус и возвращает его к исходной кнопке. */
export function useModal(
  dialog: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const element = dialog.current
    if (!open || !element) return
    const previous = document.activeElement
    const root = document.documentElement
    const wasLocked = root.classList.contains('locked')
    const background = Array.from(document.body.children)
      .filter((node): node is HTMLElement => node instanceof HTMLElement && !node.contains(element))
      .map((node) => ({ node, inert: node.inert }))
    background.forEach(({ node }) => (node.inert = true))
    root.classList.add('locked')

    const focusable = () =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (node) =>
          node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden',
      )
    const focus = () => (focusable()[0] ?? element).focus({ preventScroll: true })
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !element.contains(event.target)) focus()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close.current()
      } else if (event.key === 'Tab') {
        const items = focusable()
        const first = items[0]
        const last = items.at(-1)
        if (!first || !element.contains(document.activeElement)) {
          event.preventDefault()
          focus()
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('focusin', onFocus)
    focus()
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('focusin', onFocus)
      background.forEach(({ node, inert }) => (node.inert = inert))
      if (!wasLocked) root.classList.remove('locked')
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true })
    }
  }, [dialog, open])
}
