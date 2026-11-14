import { cleanMentor, DEFAULT_MENTOR, type MentorSettings } from '../../core/mentor'
import { createStore } from './store'

/** Свой наставник: настройки живут в браузере и уходят с каждым вопросом. */
const store = createStore<MentorSettings>('chernovik:mentor:v1', DEFAULT_MENTOR, (value) =>
  value && typeof value === 'object' ? cleanMentor(value) : null,
)

export const getMentor = store.get
export const useMentor = store.use
export const saveMentor = (change: Partial<MentorSettings>) =>
  store.set(cleanMentor({ ...store.get(), ...change }))
export const resetMentor = () => store.set(DEFAULT_MENTOR)
