import { useMemo, useState } from 'react'
import { BookOpen, Search, X, ArrowUpRight, Rocket, Code2, MessagesSquare, FileCheck2, ListChecks, BriefcaseBusiness, SlidersHorizontal, MessageSquare, FolderGit2, Plug, RotateCcw, LifeBuoy, ShieldCheck, Globe, Bot, Download, UsersRound, Monitor, Terminal, Settings2, Wrench } from 'lucide-react'
import { useTranslation } from '../i18n'
import { resolveHelp } from './helpContent'
import { HelpAssistant } from './HelpAssistant'

const icons = { start: Rocket, 'install-platforms': Download, code: Code2, forge: MessagesSquare, decisions: FileCheck2, execution: ListChecks, work: BriefcaseBusiness, models: SlidersHorizontal, chat: MessageSquare, files: FolderGit2, api: Plug, remote: Globe, 'help-assistant': Bot, 'assistant-control': Bot, telegram: MessageSquare, 'native-permissions': Monitor, 'external-agents': Terminal, 'local-cli': Terminal, settings: Settings2, 'review-teams': UsersRound, specializations: Wrench, diagnostics: LifeBuoy, 'project-contributors': Code2, updates: Download, restart: RotateCcw, troubleshooting: LifeBuoy, privacy: ShieldCheck }

export function Help() {
  const { t, language, direction: interfaceDirection } = useTranslation()
  const { guide, locale, direction, isFallback, isMachineTranslated } = useMemo(() => resolveHelp(language), [language])
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [query, setQuery] = useState('')
  const visible = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase(locale).split(/\s+/).filter(Boolean)
    return guide.sections.filter(section => {
      const text = [section.title, ...section.paragraphs, ...(section.steps ?? []), section.note ?? '', ...section.links.map(link => link.label)].join(' ').toLocaleLowerCase(locale)
      return terms.every(term => text.includes(term))
    })
  }, [query, guide, locale])
  const goTo = (id: string) => {
    setQuery('')
    if (window.matchMedia('(max-width: 880px)').matches) setAssistantOpen(false)
    requestAnimationFrame(() => {
    const heading = document.getElementById(`help-${id}`)
    heading?.scrollIntoView({ block: 'start' })
    heading?.focus({ preventScroll: true })
    })
  }
  return <main className="zf-help" lang={language} dir={interfaceDirection} data-testid="help-view">
    <div className="drag-region h-10 shrink-0" />
    <header className="zf-help-header">
      <div className="zf-help-kicker"><BookOpen size={15} aria-hidden="true" /><span>ZIAForge / {t('help.kicker')}</span></div>
      <h1>{t('help.title')}</h1>
      <p className="zf-help-subtitle">{t('help.subtitle')}</p>
      {isFallback && <p className="zf-help-note" role="note" data-testid="help-english-fallback">{t('help.fallbackNotice')}</p>}
      {isMachineTranslated && <p className="zf-help-note" role="note" data-testid="help-machine-translation">{t('help.machineTranslationNotice')}</p>}
      {window.ziafAPI?.helpAssistant && <button type="button" className="zf-help-ai-toggle" onClick={() => setAssistantOpen(value => !value)} aria-expanded={assistantOpen}><Bot size={16} aria-hidden="true" />{t('help.aiOpen')}</button>}
      <div className="zf-help-search"><Search size={16} className="text-zinc-500" aria-hidden="true" /><input data-testid="help-search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('help.searchPlaceholder')} aria-label={t('help.searchLabel')} />{query && <button type="button" onClick={() => setQuery('')} aria-label={t('help.clearSearch')}><X size={15} /></button>}</div>
    </header>
    <div className={`zf-help-layout${assistantOpen ? ' with-assistant' : ''}`}>
      <nav className="zf-help-nav" aria-label={t('help.sectionsLabel')} lang={locale} dir={direction}>{visible.map(section => { const Icon = icons[section.id as keyof typeof icons] ?? BookOpen; return <a href={`#help-${section.id}`} key={section.id} onClick={event => { event.preventDefault(); goTo(section.id) }}><Icon size={15} aria-hidden="true" />{section.title}</a> })}</nav>
      <div className="zf-help-body" lang={locale} dir={direction} data-help-locale={locale}>
        <p className="sr-only" role="status" lang={language} dir={interfaceDirection}>{t('help.sectionCount', { count: visible.length })}</p>
        {visible.length === 0 && <div className="zf-help-empty" lang={language} dir={interfaceDirection} data-testid="help-no-results"><LifeBuoy size={24} className="mb-3 text-zinc-500" aria-hidden="true" /><h2>{t('help.noResultsTitle')}</h2><p className="mt-3 text-sm">{t('help.noResultsBody')}</p><button className="mt-4 inline-flex items-center gap-2 text-xs text-[#ff8c3a]" onClick={() => setQuery('')}>{t('help.allSections')}<ArrowUpRight size={14} /></button></div>}
        {visible.map(section => { const Icon = icons[section.id as keyof typeof icons] ?? BookOpen; return <section key={section.id} className="zf-help-section" aria-labelledby={`help-${section.id}`}><div className="zf-help-section-header"><Icon size={19} aria-hidden="true" /><h2 id={`help-${section.id}`} tabIndex={-1}>{section.title}</h2></div>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}{section.steps && <ol>{section.steps.map(step => <li key={step}>{step}</li>)}</ol>}{section.note && <aside className="zf-help-note">{section.note}</aside>}<details className="mt-4 text-xs text-zinc-500"><summary lang={language} dir={interfaceDirection}>{t('help.contractsLabel')}</summary><ul className="mt-2 space-y-2">{section.links.map(link => <li key={link.path}>{link.label}<br /><code dir="ltr" className="break-all" title={t('help.sourceLabel')}>{link.path}</code></li>)}</ul></details></section> })}
      </div>
      {assistantOpen && <HelpAssistant sections={guide.sections} onReference={goTo} onClose={() => setAssistantOpen(false)} />}
    </div>
  </main>
}
