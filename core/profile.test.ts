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

import { cleanMentor, describeMentor, isDefaultMentor } from './mentor.js'

describe('свой наставник', () => {
  it('отбрасывает неизвестное и обрезает имя', () => {
    const m = cleanMentor({
      name: '  Ментор   Миша '.padEnd(40, 'а'),
      color: 'neon',
      tone: 3,
      style: 'rude',
    })
    expect(m.name.length).toBe(24)
    expect(m.color).toBe('thermal')
    expect(m.tone).toBe(1)
    expect(m.style).toBe('warm')
  })

  it('стандартные настройки не меняют промпт', () => {
    expect(isDefaultMentor(cleanMentor({}))).toBe(true)
  })

  it('строгий короткий наставник описан для модели', () => {
    const text = describeMentor(
      cleanMentor({ name: 'Арни', tone: 0.9, depth: 0.1, style: 'business' }),
    )
    expect(text).toContain('«Арни»')
    expect(text).toContain('строгий')
    expect(text).toContain('короче')
    expect(text).toContain('деловая')
  })
})
