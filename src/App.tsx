import { useCallback, useRef, useState } from 'react'
import type { ChatTurn } from '../core/protocol'
import { parseSections } from '../core/protocol'
import { TopBar } from './components/TopBar'
import { Ask, type Exchange } from './features/ask/Ask'
import { Home } from './features/home/Home'
import { Library } from './features/library/Library'
import { Progress } from './features/progress/Progress'
import { Report } from './features/report/Report'
import { Train } from './features/train/Train'
import { askMentor } from './lib/api'
import { useMemory } from './lib/memory'
import { go, useRoute } from './lib/route'

export function App() {
  const route = useRoute()
  const memory = useMemory()
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const nextId = useRef(1)

  // Диалог справки живёт здесь, чтобы не теряться при переходе между разделами.
  const ask = useCallback(
    async (question: string) => {
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

      setExchanges((list) => [...list, { id, question, raw: '', status: 'waiting' }])
      go('/ask')
      try {
        const raw = await askMentor(
          { mode: 'ask', turns },
          { onText: (text) => patch({ raw: text, status: 'streaming' }) },
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
      <TopBar view={route.view} />
      {route.view === 'home' && <Home memory={memory} onAsk={ask} />}
      {route.view === 'ask' && <Ask exchanges={exchanges} onAsk={ask} />}
      {route.view === 'train' && <Train key={route.scenario} scenario={route.scenario} />}
      {route.view === 'progress' && <Progress memory={memory} />}
      {route.view === 'library' && <Library />}
      {route.view === 'report' && <Report memory={memory} sessionId={route.session} />}
    </>
  )
}
