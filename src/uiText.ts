import { useStore } from './store'
import { translate, translateText, normalizeLocale, type TranslationValues } from './i18n-core'

/** Also usable by event handlers: reads the current UI language without capturing a stale setting. */
export function uiText(source: string, values?: TranslationValues, locale?: string): string {
  return translateText(locale ?? useStore.getState().settings?.uiLanguage, source, values)
}
export const currentLocale = () => normalizeLocale(useStore.getState().settings?.uiLanguage)

/** Explicit key for text shared by different grammatical or product contexts. */
export function uiKey(key: string, values?: TranslationValues, locale?: string): string {
  return translate(locale ?? useStore.getState().settings?.uiLanguage, key, values)
}
