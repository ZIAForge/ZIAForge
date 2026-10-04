import en from './locales/en.json'
import ru from './locales/ru.json'
import uk from './locales/uk.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'
import jaJP from './locales/ja-JP.json'
import ko from './locales/ko.json'
import de from './locales/de.json'
import fr from './locales/fr.json'
import es from './locales/es.json'
import ptBR from './locales/pt-BR.json'
import it from './locales/it.json'
import nl from './locales/nl.json'
import pl from './locales/pl.json'
import tr from './locales/tr.json'
import th from './locales/th.json'
import vi from './locales/vi.json'
import hi from './locales/hi.json'
import ar from './locales/ar.json'
import fa from './locales/fa.json'
import id from './locales/id.json'
import kk from './locales/kk.json'
import bn from './locales/bn.json'
import pnb from './locales/pnb.json'
import mr from './locales/mr.json'
import te from './locales/te.json'
import ta from './locales/ta.json'
import ur from './locales/ur.json'
import jv from './locales/jv.json'
import ha from './locales/ha.json'
import gu from './locales/gu.json'
import bho from './locales/bho.json'
import ps from './locales/ps.json'
import kn from './locales/kn.json'
import su from './locales/su.json'
import yo from './locales/yo.json'
import ml from './locales/ml.json'
import my from './locales/my.json'
import or from './locales/or.json'
import am from './locales/am.json'
import tl from './locales/tl.json'
import ig from './locales/ig.json'
import ro from './locales/ro.json'
import pa from './locales/pa.json'
import ku from './locales/ku.json'
import mg from './locales/mg.json'
import az from './locales/az.json'
import uz from './locales/uz.json'
import om from './locales/om.json'
import sd from './locales/sd.json'
import mai from './locales/mai.json'
import so from './locales/so.json'
import ne from './locales/ne.json'
import ceb from './locales/ceb.json'
import ff from './locales/ff.json'
import km from './locales/km.json'

export const localeCatalogs: Record<string, Record<string, string>> = {
  en,
  ru,
  uk,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'ja-JP': jaJP,
  ko,
  de,
  fr,
  es,
  'pt-BR': ptBR,
  it,
  nl,
  pl,
  tr,
  th,
  vi,
  hi,
  ar,
  fa,
  id,
  kk,
  bn,
  pnb,
  mr,
  te,
  ta,
  ur,
  jv,
  ha,
  gu,
  bho,
  ps,
  kn,
  su,
  yo,
  ml,
  my,
  or,
  am,
  tl,
  ig,
  ro,
  pa,
  ku,
  mg,
  az,
  uz,
  om,
  sd,
  mai,
  so,
  ne,
  ceb,
  ff,
  km
}


/** Pure shared translation functions: safe in Electron main, without React or application state. */
export type TranslationValues = Record<string, string | number>
export function normalizeLocale(value?: string): string {
  if (!value) return 'en'
  const normalized = value.replace(/_/g, '-').toLowerCase()
  const exact = Object.keys(localeCatalogs).find(locale => locale.toLowerCase() === normalized)
  if (exact) return exact
  if (normalized.startsWith('zh')) return /(?:tw|hk|hant)/.test(normalized) ? 'zh-TW' : 'zh-CN'
  if (normalized.startsWith('ja')) return 'ja-JP'
  if (normalized.startsWith('pt')) return 'pt-BR'
  return Object.keys(localeCatalogs).find(locale => locale.toLowerCase() === normalized.split('-')[0]) ?? 'en'
}
export const localeDirection = (locale?: string): 'rtl' | 'ltr' => ['ar', 'fa', 'ur', 'pnb', 'ps', 'sd'].includes(normalizeLocale(locale)) ? 'rtl' : 'ltr'
export const intlLocale = (locale?: string): string => (({ pnb: 'pa-Arab-PK', ff: 'ff-Latn', ku: 'ku-Latn' } as Record<string, string>)[normalizeLocale(locale)] ?? normalizeLocale(locale))
export function translate(locale: string | undefined, key: string, values: TranslationValues = {}): string {
  const language = normalizeLocale(locale)
  const dictionary = localeCatalogs[language]
  let resolved = key
  if (typeof values.count === 'number') {
    const category = new Intl.PluralRules(intlLocale(language)).select(values.count)
    if (dictionary[`${key}.${category}`] || en[`${key}.${category}` as keyof typeof en]) resolved = `${key}.${category}`
    else if (dictionary[`${key}.other`] || en[`${key}.other` as keyof typeof en]) resolved = `${key}.other`
  }
  const template = dictionary[resolved] ?? localeCatalogs.en[resolved] ?? dictionary[key] ?? localeCatalogs.en[key] ?? key
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, name: string) => {
    const value = values[name]
    return value === undefined ? match : typeof value === 'number' ? new Intl.NumberFormat(intlLocale(language)).format(value) : value
  })
}
const textKeys = new Map<string, string>()
for (const [key, text] of Object.entries(en)) if (!textKeys.has(text)) textKeys.set(text, key)
/** Source English is a stable lookup, never persisted as a protocol or provider value. */
export function translateText(locale: string | undefined, source: string, values?: TranslationValues): string {
  return translate(locale, textKeys.get(source) ?? source, values)
}
export const formatNumber = (locale: string | undefined, value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(intlLocale(locale), options).format(value)
export const formatDate = (locale: string | undefined, value: number | Date, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlLocale(locale), options ?? { dateStyle: 'medium', timeStyle: 'short' }).format(value)

export const isRtlLocale = (locale?: string) => localeDirection(locale) === 'rtl'
