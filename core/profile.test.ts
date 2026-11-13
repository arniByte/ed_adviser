import { describe, expect, it } from 'vitest'
import { cleanProfile, describeProfile } from './profile.js'

describe('профиль', () => {
  it('оставляет только известные поля и обрезает длинный текст', () => {
    const profile = cleanProfile({
      stage: 'school',
      goals: ['admission', 'space', 'job'],
      about: '  Ставрополь  '.padEnd(600, 'а'),
      name: 'Иван',
    })
    expect(profile?.stage).toBe('school')
    expect(profile?.goals).toEqual(['admission', 'job'])
    expect(profile?.about?.length).toBe(300)
    expect(profile).not.toHaveProperty('name')
  })

  it('пустой или чужой профиль не принимается', () => {
    expect(cleanProfile({ stage: 'boss' })).toBeUndefined()
    expect(cleanProfile('строка')).toBeUndefined()
  })

  it('описывается одной строкой для промпта', () => {
    expect(describeProfile({ stage: 'student', goals: ['job'], about: 'люблю данные' })).toBe(
      'сейчас: студент; впереди: поиск первой работы; о себе: «люблю данные»',
    )
  })
})
