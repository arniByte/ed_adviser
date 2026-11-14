import { useEffect, useState } from 'react'
import { Aura } from '../../components/Aura'
import { ArrowRight, Close } from '../../components/icons'
import { deleteChat, useChats, type Chat } from '../../lib/chat'
import { chatCover, chatPreview, chatSize, chatWhen } from '../../lib/chatLook'
import { go } from '../../lib/route'
import './Chats.css'

interface Props {
  current: string
  onNew: () => void
}

function ChatCard({ chat, index, open }: { chat: Chat; index: number; open: boolean }) {
  // Удаление в два касания: первое спрашивает, второе удаляет.
  const [asking, setAsking] = useState(false)
  useEffect(() => {
    if (!asking) return
    const timer = window.setTimeout(() => setAsking(false), 2600)
    return () => window.clearTimeout(timer)
  }, [asking])

  return (
    <li
      className="chats__item rise"
      style={{ '--i': Math.min(index, 8) + 2 } as React.CSSProperties}
    >
      <a className="chat-card" href={`#/ask/${chat.id}`} aria-current={open ? 'page' : undefined}>
        <img className="chat-card__cover" src={chatCover(chat.id)} alt="" aria-hidden="true" />
        <span className="chat-card__meta caption">
          {open ? 'Открыт сейчас' : chatWhen(chat.updatedAt)} · {chatSize(chat.exchanges.length)}
        </span>
        <span className="chat-card__title">{chat.title}</span>
        <span className="chat-card__preview">{chatPreview(chat.exchanges)}</span>
        <span className="chat-card__go" aria-hidden="true">
          <ArrowRight />
        </span>
      </a>
      <button
        type="button"
        className="chat-card__delete"
        data-asking={asking}
        aria-label={asking ? 'Точно удалить разговор' : `Удалить разговор «${chat.title}»`}
        onClick={() => (asking ? deleteChat(chat.id) : setAsking(true))}
      >
        {asking ? 'Удалить?' : <Close />}
      </button>
    </li>
  )
}

/** Все разговоры с наставником: открыть старый или начать новый. */
export function Chats({ current, onNew }: Props) {
  const chats = useChats()

  return (
    <main className="page chats">
      <header className="chats__hero">
        <div className="chats__orb rise" aria-hidden="true">
          <Aura palette="dusk" round bands={0} seed={7} fps={18} />
        </div>
        <p className="caption rise">История</p>
        <h1 className="display rise" style={{ '--i': 1 } as React.CSSProperties}>
          Разговоры
        </h1>
        <button
          type="button"
          className="btn btn--primary rise"
          style={{ '--i': 2 } as React.CSSProperties}
          onClick={() => {
            onNew()
            go('/ask')
          }}
        >
          Новый разговор
        </button>
      </header>

      {chats.length === 0 ? (
        <p className="lead chats__empty rise" style={{ '--i': 3 } as React.CSSProperties}>
          Здесь появятся разговоры со справкой. Спроси наставника о поступлении, первой работе или
          испытательном сроке — разговор сохранится в браузере.
        </p>
      ) : (
        <ul className="chats__list">
          {chats.map((chat, index) => (
            <ChatCard key={chat.id} chat={chat} index={index} open={chat.id === current} />
          ))}
        </ul>
      )}
      {chats.length > 0 && (
        <p className="caption chats__note">
          Хранятся последние 30 разговоров, только в этом браузере.
        </p>
      )}
    </main>
  )
}
