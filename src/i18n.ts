import { useStore } from './store'
import { translate, normalizeLocale, localeDirection, formatDate, formatNumber, type TranslationValues } from './i18n-core'

export const useTranslation = () => {
  const selected = useStore(state => state.settings?.uiLanguage)
  const language = normalizeLocale(selected ?? useStore.getState().settings?.uiLanguage)
  const t = (key: string, values?: TranslationValues): string => translate(language, key, values)
  return { t, language, direction: localeDirection(language), formatDate: (value: number | Date, options?: Intl.DateTimeFormatOptions) => formatDate(language, value, options), formatNumber: (value: number, options?: Intl.NumberFormatOptions) => formatNumber(language, value, options) }
}
