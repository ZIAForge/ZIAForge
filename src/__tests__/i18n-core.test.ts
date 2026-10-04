import { describe, expect, it } from 'vitest'
import { UI_LANGUAGES } from '../languages'
import { formatDate, formatNumber, intlLocale, isRtlLocale, localeCatalogs, normalizeLocale, translate, translateText } from '../i18n-core'

describe('localized UI contract', () => {
  it('keeps the 56 saved locale identities and supports regional aliases', () => {
    expect(UI_LANGUAGES).toHaveLength(56)
    expect(new Set(UI_LANGUAGES.map(item => item.id)).size).toBe(56)
    expect(Object.keys(localeCatalogs).sort()).toEqual(UI_LANGUAGES.map(item => item.id).sort())
    expect(normalizeLocale('pt_br')).toBe('pt-BR')
    expect(normalizeLocale('zh-Hant-HK')).toBe('zh-TW')
    expect(normalizeLocale('uk-UA')).toBe('uk')
    expect(normalizeLocale('not-a-language')).toBe('en')
  })
  it('formats numbers and dates for every supported locale without mutating identifiers', () => {
    for (const { id } of UI_LANGUAGES) {
      expect(formatNumber(id, 12345.5)).toBe(new Intl.NumberFormat(intlLocale(id)).format(12345.5))
      expect(formatDate(id, new Date('2026-10-03T12:00:00Z'), { year: 'numeric', timeZone: 'UTC' })).toBeTruthy()
    }
    expect(isRtlLocale('ar-SA')).toBe(true)
    expect(isRtlLocale('pnb')).toBe(true)
    expect(isRtlLocale('ku')).toBe(false)
  })
  it('interpolates exact values once and preserves literal JSON and slash commands', () => {
    const name = '<script>{count}</script> /tmp/a $&'
    expect(translate('en', 'ui.projectAddedSuccessfully', { name })).toContain(name)
    const help = translate('de', 'telegram.helpBody')
    expect(help).toContain('/command {"method":"...","args":[...]}')
    expect(help).toContain('/new {JSON}')
    expect(translate('en', 'unregistered.protocol.id')).toBe('unregistered.protocol.id')
  })
  it('selects native plural categories instead of treating every non-one count alike', () => {
    expect(translate('en', 'help.sectionCount', { count: 1 })).toBe('1 section')
    expect(translate('en', 'help.sectionCount', { count: 2 })).toBe('2 sections')
    expect(translate('ru', 'help.sectionCount', { count: 2 })).toBe('2 раздела')
    expect(translate('ru', 'help.sectionCount', { count: 5 })).toBe('5 разделов')
  })
  it('does not let later menu/Telegram keys hijack an existing UI action', () => {
    expect(translateText('ru', 'Edit')).toBe(translate('ru', 'edit'))
    expect(translateText('ru', 'View')).toBe(translate('ru', 'view'))
    expect(translate('ru', 'menu_edit')).not.toBe(translate('ru', 'edit'))
  })
})
