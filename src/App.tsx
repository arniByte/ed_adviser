import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChatTurn } from '../core/protocol'
import { parseSections } from '../core/protocol'
import { FloatingNav, sectionOf } from './components/Nav'
import { Trail } from './components/Trail'
import { Ask } from './features/ask/Ask'
import { Home } from './features/home/Home'
import { Train } from './features/train/Train'
import { askMentor } from './lib/api'
import { loadChat, saveChat, type AskHandler, type Exchange } from './lib/chat'
import { saveToMine } from './lib/mine'
import { useMemory } from './lib/memory'
import { useProfile } from './lib/profile'
import { go, useRoute } from './lib/route'

// Редкие экраны грузятся отдельно: главная и тренажёр открываются быстрее.
const Library = lazy(() =>
  import('./features/library/Library').then((m) => ({ default: m.Library })),
)
const Progress = lazy(() =>
  import('./features/progress/Progress').then((m) => ({ default: m.Progress })),
)
const Report = lazy(() => import('./features/report/Report').then((m) => ({ default: m.Report })))
const Proofs = lazy(() => import('./features/proofs/Proofs').then((m) => ({ default: m.Proofs })))
const Welcome = lazy(() =>
  import('./features/welcome/Welcome').then((m) => ({ default: m.Welcome })),
)
const Values = lazy(() => import('./features/values/Values').then((m) => ({ default: m.Values })))

export function App() {
  const route = useRoute()
  const memory = useMemory()
  const profile = useProfile()
  // Пока не познакомились, главная начинается со знакомства.
  const greet = route.view === 'hello' || (route.view === 'home' && profile === null)
  const [exchanges, setExchanges] = useState<Exchange[]>(loadChat)
  const nextId = useRef(Math.max(0, ...exchanges.map((e) => e.id)) + 1)
  useEffect(() => saveChat(exchanges), [exchanges])

  // Страница въезжает с той стороны, где стоит её вкладка.
  const tab = sectionOf(route)
  const lastTab = useRef(tab)
  useLayoutEffect(() => {
    const root = document.documentElement
    if (tab !== lastTab.current) root.dataset.dir = tab > lastTab.current ? 'next' : 'back'
    else delete root.dataset.dir
    lastTab.current = tab
  }, [route, tab])

  // Диалог справки живёт здесь, чтобы не теряться при переходе между разделами.
  const ask: AskHandler = useCallback(
    async (question, options) => {
      const id = nextId.current++
      const patch = (change: Partial<Exchange>) =>
        setExchanges((list) => list.map((e) => (e.id === id ? { ...e, ...change } : e)))

      const turns: ChatTurn[] = exchanges
        .filter((e) => e.status === 'done')
        .slice(-4)
        .flatMap((e) => [
          { role: 'user' as const, content: e.question },
          { role: 'assistant' as const, content: parseSections(e.raw).lead },
        ])
      turns.push({ role: 'user', content: question })

      const web = options?.web === true
      setExchanges((list) => [...list, { id, question, raw: '', status: 'waiting', web }])
      go('/ask')
      try {
        const raw = await askMentor(
          { mode: 'ask', turns, web },
          {
            onStatus: (progress) => patch({ progress }),
            onFound: (found) => {
              patch({ found })
              // Подтверждённое наставник запоминает сам: оно пойдёт в следующие ответы.
              for (const card of found.cards) saveToMine(card, found.checks[card.id])
            },
            onText: (text) => patch({ raw: text, status: 'streaming' }),
          },
        )
        patch({ raw, status: 'done' })
      } catch (error) {
        patch({ status: 'failed', error: (error as Error).message })
      }
    },
    [exchanges],
  )

  return (
    <>
      <Trail />
      {route.view === 'home' && !greet && <Home memory={memory} onAsk={ask} />}
      {route.view === 'ask' && (
        <Ask exchanges={exchanges} onAsk={ask} onReset={() => setExchanges([])} />
      )}
      {route.view === 'train' && <Train key={route.scenario} scenario={route.scenario} />}
      <Suspense fallback={<main className="page" />}>
        {route.view === 'progress' && <Progress memory={memory} />}
        {route.view === 'library' && <Library />}
        {route.view === 'proofs' && <Proofs />}
        {route.view === 'values' && <Values />}
        {route.view === 'report' && <Report memory={memory} sessionId={route.session} />}
        {greet && <Welcome />}
        {['progress', 'library', 'proofs', 'report', 'values'].includes(route.view) && (
          <FloatingNav />
        )}
      </Suspense>
    </>
  )
}
