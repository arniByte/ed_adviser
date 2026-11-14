import { useEffect, useState } from 'react'
import { COLORS, STYLES, type MentorSettings, type MentorStyle } from '../../../core/mentor'
import { Aura } from '../../components/Aura'
import { AuraMark } from '../../components/AuraMark'
import { resetMentor, saveMentor, useMentor } from '../../lib/mentor'
import { mentorCard, shareImage } from '../../lib/shareCard'
import '../../components/BlurCycle.css'
import './MentorStudio.css'

const COLOR_NAMES: Record<MentorSettings['color'], string> = {
  thermal: 'Тепло',
  pastel: 'Пастель',
  mint: 'Мята',
  dusk: 'Закат',
}

/** Как Черновик отзовётся на одну и ту же слабую строчку резюме — при разных настройках. */
const SAMPLES: Record<MentorSettings['style'], [string, string, string]> = {
  warm: [
    'Здорово, что ты назвал конкретный проект — это уже сильная сторона. Добавь цифры, и строчка заиграет.',
    'Проект назван — это плюс. Не хватает цифр: сколько людей и какой вышел результат.',
    'Без цифр это пустые слова. Назови масштаб и результат — иначе рекрутер пролистает.',
  ],
  business: [
    'Проект назван — это плюс. Чего не хватает: масштаба и результата.',
    'Проект назван. Не хватает цифр: масштаб, результат, твоя роль.',
    'Без цифр строка не работает. Нужны масштаб, результат и твоя роль.',
  ],
  playful: [
    'Турнир — отличная зацепка! Добавь цифры, и строчка из скромной станет звёздной.',
    'Проект есть, цифр нет. Рекрутер любит цифры почти так же, как кофе.',
    'Сейчас это строчка-ниндзя: её никто не замечает. Цифры, роль, результат — и она выйдет на свет.',
  ],
  bro: [
    'Слушай, проект назван — уже круто. Докинь цифры, и строчка начнёт работать на тебя.',
    'Короче, проект есть, а цифр нет. Сколько людей, какой результат — вот это добавь.',
    'Давай честно: без цифр это просто слова. Масштаб и результат — и тогда норм.',
  ],
  roast: [
    'Ну камон, турнир — это уже интересно. Только где цифры? Покажи масштаб.',
    '«Участвовал в организации» звучит как «стоял рядом». Сколько людей и что сделал именно ты?',
    'Это строчка-невидимка: рекрутер пролистает и не заметит. Цифры, роль, результат — быстро.',
  ],
  meme: [
    'Турнир — база. Добавь цифры, и будет вообще вайб.',
    'Без цифр строчка слегка кринж. Сколько участников, какой результат — и изи.',
    'Пока это кринж-строчка, рекрутер скипнет. Цифры, роль, результат — и будет база.',
  ],
}

function sample(m: MentorSettings): string {
  const tone = m.tone < 0.35 ? 0 : m.tone > 0.65 ? 2 : 1
  let text = SAMPLES[m.style][tone]
  if (m.depth > 0.65) text += ' Например: «собрал турнир на 120 участников и нашёл трёх спонсоров».'
  if (m.humor > 0.8)
    text += ' А «участвовал» — как «был на вечеринке»: вопрос, ты диджей или подпирал стену?'
  else if (m.humor > 0.5 && m.style !== 'playful')
    text += ' Цифры в резюме — как мемы в чате: без них скучно.'
  return text
}

function traits(m: MentorSettings): string[] {
  return [
    m.tone < 0.35 ? 'мягкий' : m.tone > 0.65 ? 'строгий' : 'прямой',
    m.depth < 0.35 ? 'коротко' : m.depth > 0.65 ? 'подробно' : 'по делу',
    m.humor < 0.15
      ? 'серьёзно'
      : m.humor > 0.8
        ? 'угарно'
        : m.humor > 0.5
          ? 'с шутками'
          : 'с улыбкой',
    STYLES[m.style].toLowerCase(),
  ]
}

/**
 * Свой Черновик: имя, цвет, тон, подробность, юмор и манера. Всё сразу видно на живом
 * превью и действительно меняет ответы — настройки уходят в промпт.
 */
export function MentorStudio() {
  const mentor = useMentor()
  const [shared, setShared] = useState('')
  // Имя правится локально: пустое поле не должно сразу превращаться обратно в «Черновик».
  const [name, setName] = useState(mentor.name)
  const text = sample(mentor)

  const share = async () => {
    const blob = await mentorCard(mentor.name, traits(mentor), text, mentor.color)
    const result = await shareImage(blob, 'moy-chernovik.png', `Мой Черновик — ${mentor.name}`)
    setShared(result === 'saved' ? 'Карточка сохранена' : 'Готово')
    window.setTimeout(() => setShared(''), 2200)
  }

  return (
    <main className="page studio">
      <h1 className="display rise">Свой Черновик</h1>
      <p className="lead studio__lead rise" style={{ '--i': 1 } as React.CSSProperties}>
        Собери Черновика под себя: как говорит, насколько шутит и как спорит. Настройки хранятся в
        этом браузере и уходят вместе с вопросом.
      </p>

      <section className="studio__preview rise" style={{ '--i': 2 } as React.CSSProperties}>
        <Aura className="studio__aura" palette={mentor.color} seed={5} bands={6} fps={18} />
        <div className="studio__card">
          <AuraMark size={132} palette={mentor.color} />
          <div className="studio__who">
            <p className="studio__name">{mentor.name}</p>
            <p className="caption">{traits(mentor).join(' · ')}</p>
          </div>
          <p className="studio__sample" aria-live="polite">
            <span className="caption">Так он ответит на «участвовал в организации турнира»</span>
            <span key={text} className="studio__words">
              {text.split(' ').map((word, i) => (
                <span
                  key={i}
                  className="blur-cycle__word"
                  style={{ animationDelay: `${i * 35}ms` }}
                >
                  {word}{' '}
                </span>
              ))}
            </span>
          </p>
        </div>
      </section>

      <section className="studio__controls">
        <label className="studio__field">
          <span className="studio__label">Имя</span>
          <input
            className="studio__input"
            value={name}
            maxLength={24}
            placeholder="Черновик"
            onChange={(event) => {
              setName(event.target.value)
              saveMentor({ name: event.target.value })
            }}
          />
        </label>

        <div className="studio__field" role="radiogroup" aria-label="Цвет">
          <span className="studio__label">Цвет</span>
          <div className="studio__swatches">
            {COLORS.map((color, i) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={mentor.color === color}
                aria-label={COLOR_NAMES[color]}
                className="studio__swatch"
                onClick={() => saveMentor({ color })}
              >
                <Aura palette={color} seed={i + 1} round bands={5} fps={12} />
                <span className="caption">{COLOR_NAMES[color]}</span>
              </button>
            ))}
          </div>
        </div>

        <Slider
          label="Тон"
          left="Мягко"
          right="Строго"
          value={mentor.tone}
          onChange={(tone) => saveMentor({ tone })}
        />
        <Slider
          label="Подробность"
          left="Коротко"
          right="Подробно"
          value={mentor.depth}
          onChange={(depth) => saveMentor({ depth })}
        />

        <Slider
          label="Юмор"
          left="Серьёзно"
          right="Угарно"
          value={mentor.humor}
          onChange={(humor) => saveMentor({ humor })}
        />

        <div className="studio__field" role="radiogroup" aria-label="Манера">
          <span className="studio__label">Манера</span>
          <div className="studio__chips">
            {(Object.keys(STYLES) as MentorStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                role="radio"
                aria-checked={mentor.style === style}
                className="btn btn--glass btn--small studio__chip"
                onClick={() => saveMentor({ style })}
              >
                {STYLES[style]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="studio__actions">
        <button className="btn btn--primary" onClick={share}>
          {shared || 'Поделиться карточкой'}
        </button>
        <button
          className="btn btn--glass"
          onClick={() => {
            resetMentor()
            setName('Черновик')
          }}
        >
          Сбросить
        </button>
      </div>

      <FullReset />
    </main>
  )
}

/** Всё, что Черновик хранит в браузере, лежит под одним префиксом. */
function wipeEverything() {
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith('chernovik:')) localStorage.removeItem(key)
    sessionStorage.clear()
  } catch {
    // Хранилище закрыто — после перезагрузки и так ничего не останется.
  }
  window.location.replace(`${window.location.pathname}#/`)
  window.location.reload()
}

/** Красная кнопка внизу: стирает историю целиком. Срабатывает со второго нажатия. */
function FullReset() {
  const [asking, setAsking] = useState(false)
  useEffect(() => {
    if (!asking) return
    const timer = window.setTimeout(() => setAsking(false), 4000)
    return () => window.clearTimeout(timer)
  }, [asking])

  return (
    <section className="studio__danger" aria-labelledby="studio-danger">
      <h2 id="studio-danger" className="studio__danger-title">
        Начать с нуля
      </h2>
      <p className="studio__danger-text">
        Удалит все разговоры, прогресс, «Мою базу», знакомство и настройки Черновика в этом
        браузере. Вернуть их не получится.
      </p>
      <button
        type="button"
        className="btn studio__danger-button"
        data-asking={asking}
        onClick={() => (asking ? wipeEverything() : setAsking(true))}
      >
        {asking ? 'Точно? Нажми ещё раз' : 'Сбросить всё'}
      </button>
    </section>
  )
}

function Slider({
  label,
  left,
  right,
  value,
  onChange,
}: {
  label: string
  left: string
  right: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="studio__field">
      <span className="studio__label">{label}</span>
      <input
        className="studio__range"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        style={{ '--fill': `${value * 100}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="studio__ends caption">
        <span>{left}</span>
        <span>{right}</span>
      </span>
    </label>
  )
}
