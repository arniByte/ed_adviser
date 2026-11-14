import { useState } from 'react'
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

/** Как наставник отзовётся на одну и ту же слабую строчку резюме — при разных настройках. */
function sample(m: MentorSettings): string {
  const tone = m.tone < 0.35 ? 0 : m.tone > 0.65 ? 2 : 1
  const base =
    m.style === 'business'
      ? [
          'Проект назван — это плюс. Чего не хватает: масштаба и результата.',
          'Проект назван. Не хватает цифр: масштаб, результат, твоя роль.',
          'Без цифр строка не работает. Нужны масштаб, результат и твоя роль.',
        ]
      : [
          'Здорово, что ты назвал конкретный проект — это уже сильная сторона. Добавь цифры, и строчка заиграет.',
          'Проект назван — это плюс. Не хватает цифр: сколько людей и какой вышел результат.',
          'Без цифр это пустые слова. Назови масштаб и результат — иначе рекрутер пролистает.',
        ]
  let text = base[tone]
  if (m.depth > 0.65) text += ' Например: «собрал турнир на 120 участников и нашёл трёх спонсоров».'
  if (m.style === 'playful') text += ' Рекрутеры любят цифры почти так же, как кофе.'
  return text
}

function traits(m: MentorSettings): string[] {
  return [
    m.tone < 0.35 ? 'мягкий' : m.tone > 0.65 ? 'строгий' : 'прямой',
    m.depth < 0.35 ? 'коротко' : m.depth > 0.65 ? 'подробно' : 'по делу',
    STYLES[m.style].toLowerCase(),
  ]
}

/**
 * Свой наставник: имя, цвет, тон, подробность и манера. Всё сразу видно на живом
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
    const result = await shareImage(blob, 'moy-nastavnik.png', `Мой наставник — ${mentor.name}`)
    setShared(result === 'saved' ? 'Карточка сохранена' : 'Готово')
    window.setTimeout(() => setShared(''), 2200)
  }

  return (
    <main className="page studio">
      <h1 className="display rise">Свой наставник</h1>
      <p className="lead studio__lead rise" style={{ '--i': 1 } as React.CSSProperties}>
        Настрой, как он говорит с тобой. Настройки хранятся в этом браузере и уходят вместе с
        вопросом.
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
    </main>
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
