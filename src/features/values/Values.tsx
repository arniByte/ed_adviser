import { Aura } from '../../components/Aura'
import { ArrowRight } from '../../components/icons'
import './Values.css'

const PRINCIPLES = [
  {
    title: 'Здесь можно ошибаться',
    text: 'Неудачный ответ — начало работы. Черновик разбирает его по делу и даёт попробовать ещё раз, пока настоящая встреча впереди.',
  },
  {
    title: 'Ты принимаешь решение',
    text: 'ИИ помогает увидеть варианты и подобрать слова. Какое направление выбрать, куда подать заявку и что сказать — решаешь ты.',
  },
  {
    title: 'У факта должен быть источник',
    text: 'Сноски ведут к цитатам и проверкам. Пруф подтверждает происхождение и целостность текста; сам источник всегда можно прочитать и оценить.',
    href: '#/proofs',
    link: 'Как устроены пруфы',
  },
  {
    title: 'Память — в твоём браузере',
    text: 'Профиль, разговоры, прогресс и найденные материалы сохраняются в браузере. Вопросы, ответы и профиль передаются модели для разбора. Не добавляй лишние личные сведения.',
  },
  {
    title: 'Честность важнее уверенного тона',
    text: 'ИИ может ошибаться. Советы помогают подготовиться, но не заменяют официальные правила вуза, условия работодателя и твою оценку ситуации.',
  },
]

export function Values() {
  return (
    <main className="page values">
      <header className="values__hero">
        <p className="caption rise">Ценности Черновика</p>
        <div className="values__orbit rise" aria-hidden="true">
          <Aura palette="pastel" round bands={0} seed={4} fps={18} />
          <span className="values__orbit-core" />
        </div>
        <h1 className="display rise" style={{ '--i': 1 } as React.CSSProperties}>
          ИИ помогает.
          <br />
          Решение — твоё.
        </h1>
        <p className="lead values__lead rise" style={{ '--i': 2 } as React.CSSProperties}>
          Технологии должны давать тебе больше уверенности и свободы. С этого начинается Черновик.
        </p>
      </header>

      <ol className="values__principles">
        {PRINCIPLES.map((principle, index) => (
          <li
            key={principle.title}
            className="values__principle rise"
            style={{ '--i': index + 3 } as React.CSSProperties}
          >
            <span className="caption values__number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <h2 className="values__title">{principle.title}</h2>
              <p className="values__text">{principle.text}</p>
              {principle.href && (
                <a className="values__link" href={principle.href}>
                  {principle.link} <ArrowRight />
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>

      <footer className="values__footer">
        <p className="values__closing">Оставь себе право на черновик.</p>
        <a className="btn btn--primary" href="#/">
          К тренировкам <ArrowRight />
        </a>
      </footer>
    </main>
  )
}
