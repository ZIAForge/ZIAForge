import { describe, expect, it } from 'vitest'
import english from '../../../docs/help/en.json'
import russian from '../../../docs/help/translations/ru.json'
import { resolveHelp } from '../helpContent'

describe('mixed Help localization', () => {
  it('serves translated API guidance while retaining explicit fallback for pending updates guidance', () => {
    const result = resolveHelp('ru')
    expect(result.isFallback).toBe(false)
    expect(result.isMachineTranslated).toBe(true)
    expect(result.englishFallbackSections).toEqual(['updates'])
    expect(result.guide.sections.find(section => section.id === 'updates')).toEqual(english.sections.find(section => section.id === 'updates'))
    expect(result.guide.sections.find(section => section.id === 'api')).toEqual(russian.sections.find(section => section.id === 'api'))
    expect(result.guide.sections.find(section => section.id === 'models')).toEqual(russian.sections.find(section => section.id === 'models'))
    expect(result.guide.sections.find(section => section.id === 'models')?.title).not.toEqual(english.sections.find(section => section.id === 'models')?.title)
    expect(resolveHelp('en').englishFallbackSections).toEqual([])
    expect(resolveHelp('unavailable').isFallback).toBe(true)
  })
})
