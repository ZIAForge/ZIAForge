import englishGuide from '../../docs/help/en.json'
import localeRegistry from '../../docs/help/locales.json'
import { helpSourceSha256 } from './helpSource.generated'

export interface HelpSection {
  id: string
  title: string
  paragraphs: string[]
  steps?: string[]
  note?: string
  links: { label: string; path: string }[]
}
export interface HelpGuide {
  schemaVersion: number
  locale: string
  title: string
  description: string
  sourcePolicy: string
  sections: HelpSection[]
}
interface HelpLocaleEntry {
  status: string
  contentFile: string | null
  reviewedSourceSha256: string | null
  reviewer: string | null
  translatedSourceSha256?: string | null
  translationMethod?: string | null
  englishFallbackSections?: string[]
  retainedTranslationSourceSha256?: string
}
// Machine translations and human-reviewed translations remain distinct claims.
// The build's consistency command validates their complete schema and contract links.
const translations = import.meta.glob<HelpGuide>('../../docs/help/translations/*.json', { eager: true, import: 'default' })
const rtlLocales = new Set(['ar', 'fa', 'pnb', 'ps', 'sd', 'ur'])
export const helpSections: HelpSection[] = englishGuide.sections
export function resolveHelp(language: string) {
  const entry = (localeRegistry.locales as Record<string, HelpLocaleEntry>)[language]
  const path = entry?.contentFile ? `../../docs/help/${entry.contentFile}` : ''
  const translated = translations[path]
  const reviewed = entry?.status === 'reviewed' && entry.reviewedSourceSha256 === helpSourceSha256 && !!entry.reviewer && translated?.locale === language
  const machineTranslated = entry?.status === 'machine-translated' && entry.translatedSourceSha256 === helpSourceSha256 && !!entry.translationMethod && translated?.locale === language
  const englishFallbackSections = machineTranslated ? entry.englishFallbackSections ?? [] : []
  const guide: HelpGuide = reviewed || machineTranslated ? { ...translated, sections: translated.sections.map(section => englishFallbackSections.includes(section.id) ? englishGuide.sections.find(original => original.id === section.id) ?? section : section) } : englishGuide
  return { guide, locale: guide.locale, direction: rtlLocales.has(guide.locale) ? 'rtl' as const : 'ltr' as const, isFallback: language !== 'en' && !reviewed && !machineTranslated, isMachineTranslated: machineTranslated, status: entry?.status ?? 'not-translated', englishFallbackSections }
}
