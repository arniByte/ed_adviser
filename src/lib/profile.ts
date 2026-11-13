import { cleanProfile, type Profile } from '../../core/profile'
import { createStore } from './store'

/** null — ещё не знакомились; пустой объект — пользователь пропустил знакомство. */
const store = createStore<Profile | null>('chernovik:profile:v1', null, (value) =>
  value && typeof value === 'object' ? (cleanProfile(value) ?? {}) : null,
)

export const getProfile = store.get
export const saveProfile = (profile: Profile) => store.set(cleanProfile(profile) ?? {})
export const useProfile = store.use
