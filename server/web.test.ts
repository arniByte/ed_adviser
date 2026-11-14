import { beforeEach, describe, expect, it, vi } from 'vitest'
import { complete } from './openrouter.js'
import { findOnWeb, needsWeb, parseCandidates } from './web.js'

vi.mock('./openrouter.js', () => ({
  complete: vi.fn(),
  MODELS: { fallback: 'router-test' },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('parseCandidates', () => {
  it('достаёт источники из оборванного массива и пропускает неполные', () => {
    const text = `Вот что нашлось:
[{"url": "https://example.ru/abitur", "title": "Сроки приёма", "publisher": "Институт", "year": 2026,
  "quote": "Приём документов начинается 20 июня 2026 года.", "fact": "Подавать с 20 июня.", "scenario": "admission"},
 {"url": "ftp://bad", "title": "x", "quote": "раз два три четыре пять шесть", "fact": "y"},
 {"url": "https://example.ru/short", "title": "Коротко", "quote": "Две фразы", "fact": "z"},
 {"url": "https://example.ru/cut", "title": "Оборвано", "quote": "Ответ модели закончи`
    const found = parseCandidates(text)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      url: 'https://example.ru/abitur',
      year: 2026,
      scenario: 'admission',
    })
  })

  it('подставляет домен, если издатель не указан', () => {
    const [item] = parseCandidates(
      '[{"url": "https://hh.ru/article/1", "title": "Т", "quote": "Одна две три четыре пять шесть семь", "fact": "Ф"}]',
    )
    expect(item.publisher).toBe('hh.ru')
  })
})

describe('контекст веб-поиска', () => {
  const question = 'Найди в интернете правила подачи заявления на бакалавриат в МГУ в 2026 году'
  const previousQuestion = 'Сколько часов в неделю можно работать в 17 лет?'
  const followup = 'А если я ещё учусь в школе?'

  const messages = () => vi.mocked(complete).mock.calls[0][0].messages

  it('маршрутизатор получает самодостаточный вопрос отдельно от прошлой темы', async () => {
    vi.mocked(complete).mockResolvedValueOnce('yes')
    await expect(needsWeb(question, previousQuestion)).resolves.toBe(true)
    const user = String(messages().find((message) => message.role === 'user')?.content)
    expect(user).toContain(`Текущий вопрос пользователя: «${question}»`)
    expect(user).toContain(`Предыдущий вопрос — только контекст уточнения: «${previousQuestion}»`)
    expect(user).not.toContain(`Текущий вопрос пользователя: «${previousQuestion}`)
    expect(String(messages()[0].content)).toContain(
      'Если текущий вопрос самодостаточен, игнорируй предыдущий',
    )
  })

  it('маршрутизатор отличает уточнение от его контекста', async () => {
    vi.mocked(complete).mockResolvedValueOnce('no')
    await expect(needsWeb(followup, previousQuestion)).resolves.toBe(false)
    const user = String(messages().find((message) => message.role === 'user')?.content)
    expect(user).toContain(`Текущий вопрос пользователя: «${followup}»`)
    expect(user).toContain(`Предыдущий вопрос — только контекст уточнения: «${previousQuestion}»`)
    expect(String(messages()[0].content)).toContain('не ищи факты по прежней теме')
  })

  it('поиск отделяет новый вопрос от прежней темы', async () => {
    vi.mocked(complete).mockResolvedValueOnce('[]')
    await expect(findOnWeb(question, { previousQuestion })).resolves.toEqual({
      cards: [],
      checks: {},
      looked: 0,
    })
    const user = String(messages().find((message) => message.role === 'user')?.content)
    expect(user).toContain(`Текущий вопрос пользователя: «${question}»`)
    expect(user).toContain(`Предыдущий вопрос — только контекст уточнения: «${previousQuestion}»`)
    expect(user).not.toContain(`Текущий вопрос пользователя: «${previousQuestion}`)
    expect(String(messages()[0].content)).toContain(
      'Если текущий вопрос самодостаточен, игнорируй предыдущий',
    )
  })

  it('поиск получает контекст длинного уточнения со словом «там»', async () => {
    const previousQuestion = 'Какие правила поступления в МГУ?'
    const followup = 'А когда там заканчивается приём документов на платное обучение?'
    vi.mocked(complete).mockResolvedValueOnce('[]')
    await findOnWeb(followup, { previousQuestion })
    const user = String(messages().find((message) => message.role === 'user')?.content)
    expect(user).toContain(`Текущий вопрос пользователя: «${followup}»`)
    expect(user).toContain(`Предыдущий вопрос — только контекст уточнения: «${previousQuestion}»`)
    expect(String(messages()[0].content)).toContain('не ищи факты по прежней теме')
  })
})
