import type { Profile } from '../../core/profile'
import type { ScenarioId } from '../../core/types'

/**
 * Вопросы-подсказки на пустом экране общения. По кнопке «Перемешать» набор меняется:
 * вопросы подбираются под цели из профиля, часть — под его интересы.
 */
const POOL: Record<ScenarioId | 'life', string[]> = {
  admission: [
    'Как расставить приоритеты, если боюсь не пройти на мечту?',
    'До какого числа подавать согласие на зачисление?',
    'Сколько вузов и направлений можно выбрать?',
    'Что такое БВИ и кому оно положено?',
    'Сколько баллов надо, чтобы поступить в МФТИ?',
    'Что будет, если не отработать целевое?',
    'Сколько стоит общежитие и кому оно бесплатно?',
    'Колледж после 9 класса — это запасной вариант?',
    'Как вернуть деньги за платное обучение?',
    'За что дают дополнительные баллы при поступлении?',
  ],
  job: [
    'Что писать в резюме без опыта?',
    'Меня спросят про слабые стороны. Что отвечать?',
    'Как понять, что вакансия — развод?',
    'Как ответить на вопрос о зарплате?',
    'Как готовиться к собеседованию за вечер?',
    'Сколько часов в неделю можно работать в 16 лет?',
    'Где искать первую стажировку?',
    'Что такое метод STAR и зачем он нужен?',
  ],
  onboarding: [
    'Что спросить у руководителя в первый день?',
    'Могут ли уволить на испытательном сроке?',
    'Как попросить помощи и не выглядеть глупо?',
    'Что делать, если ошибся в первую неделю?',
    'Больничный продлевает испытательный срок?',
    'Как понять, чего от меня ждут на новой работе?',
  ],
  life: [
    'Что взять с собой в общагу?',
    'Как не волноваться перед экзаменом?',
    'Как совмещать учёбу и подработку?',
    'Как составить бюджет на первый месяц самостоятельной жизни?',
    'Как выбрать между двумя направлениями, если нравятся оба?',
    'Как не выгореть, готовясь к ЕГЭ?',
  ],
}

const ABOUT_INTEREST = [
  (x: string) => `Как рассказать про увлечение «${x}» в резюме?`,
  (x: string) => `Можно ли сделать «${x}» профессией?`,
  (x: string) => `Мне нравится «${x}». Какие направления в вузах подойдут?`,
  (x: string) => `Мой интерес — «${x}». Как это пригодится на собеседовании?`,
]

const shuffle = <T>(list: T[]) => {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Шесть подсказок: сначала по целям, затем по интересам и про жизнь. Повторов с прошлым набором нет. */
export function pickStarters(
  profile: Profile | null,
  previous: string[] = [],
  count = 6,
): string[] {
  const goals = profile?.goals?.length
    ? profile.goals
    : (['admission', 'job', 'onboarding'] as ScenarioId[])
  const fromGoals = shuffle(goals.flatMap((goal) => POOL[goal]))
  const fromInterests = shuffle(profile?.interests ?? [])
    .slice(0, 2)
    .map((interest) => ABOUT_INTEREST[Math.floor(Math.random() * ABOUT_INTEREST.length)](interest))
  const fromLife = shuffle(POOL.life)
  const order = [
    ...fromGoals.slice(0, 3),
    ...fromInterests,
    ...fromLife.slice(0, 1),
    ...fromGoals.slice(3),
    ...fromLife.slice(1),
  ]
  const fresh = order.filter((question) => !previous.includes(question))
  return [...new Set(fresh.length >= count ? fresh : order)].slice(0, count)
}
