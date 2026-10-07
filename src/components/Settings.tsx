import { uiText } from '../uiText'
import { UI_LANGUAGES } from '../languages'
import { ControlSettings } from '../features/workspace/ControlSettings'
import { UpdatesPanel } from '../features/workspace/UpdatesPanel'
import { ReviewTeamsSettings } from '../features/workspace/ReviewTeamsSettings'
import React, { useState, useEffect, useRef } from 'react'
import { useStore, type Preset } from '../store'
import { useTranslation } from '../i18n'
import { resolveDefaultPreset } from '../features/workspace/modelSelection'
import { ApiConnectionsPanel } from '../features/workspace/ApiConnectionsPanel'
import { PresetEditorDialog } from '../features/workspace/PresetEditorDialog'
import { Save, Sliders, Terminal, User, Sparkles, Folder, PlayCircle, Plus, Trash2, RotateCcw, Edit } from 'lucide-react'

export const Settings: React.FC = () => {
  const { t } = useTranslation()
  const { settings, presets, saveSettings, repositories, addRepositoryInteractive, deleteRepository, appVersion } = useStore()
  
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'integrations' | 'git' | 'repositories' | 'presets' | 'profile' | 'control' | 'updates' | 'review-teams'>('general')
  const [editingPreset, setEditingPreset] = useState<{ isEdit: boolean; oldName?: string; preset: Preset } | null>(null)

  const translatePermission = (perm: string) => {
    if (perm === 'CLI settings') return t('cli_settings')
    if (perm === 'Read & Write') return t('read_write')
    const key = perm.toLowerCase().replace(/ /g, '_').replace(/&/g, 'and').replace(/permissions$/, 'permission')
    return t(key) || perm
  }

  // General State
  const [theme, setTheme] = useState(settings?.theme || 'system')
  const [language, setLanguage] = useState(settings?.language || 'en')
  const [uiLanguage, setUiLanguage] = useState(settings?.uiLanguage || 'en')
  const [defaultIDE, setDefaultIDE] = useState(settings?.defaultIDE || 'VSCode')
  const [autoArchive, setAutoArchive] = useState(settings?.autoArchive || 'never')
  const [soundAlerts, setSoundAlerts] = useState(settings?.soundAlerts ?? true)
  const [soundType, setSoundType] = useState(settings?.soundType || 'Doorbell')
  const [desktopNotifications, setDesktopNotifications] = useState(settings?.desktopNotifications ?? true)
  const [launchAtLogin, setLaunchAtLogin] = useState(settings?.launchAtLogin ?? false)
  const [preventSleep, setPreventSleep] = useState(settings?.preventSleep ?? true)
  const [defaultCodingPreset, setDefaultCodingPreset] = useState(resolveDefaultPreset(presets, settings?.defaultCodingPreset))
  const [defaultHelperPreset, setDefaultHelperPreset] = useState(resolveDefaultPreset(presets, settings?.defaultHelperPreset || settings?.defaultReviewPreset))
  const [defaultReviewPreset, setDefaultReviewPreset] = useState(resolveDefaultPreset(presets, settings?.defaultReviewPreset))
  const [useMockData, setUseMockData] = useState(settings?.useMockData ?? true)
  const [preferNativeClaude, setPreferNativeClaude] = useState(settings?.preferNativeClaude ?? true)
  const [debugLogging, setDebugLogging] = useState(settings?.debugLogging ?? false)
  const [globalWorkspacePath, setGlobalWorkspacePath] = useState(settings?.globalWorkspacePath || '')

  const [jsonError, setJsonError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const saveInProgress = useRef(false)

  useEffect(() => {
    setDefaultCodingPreset(current => resolveDefaultPreset(presets, current))
    setDefaultReviewPreset(current => resolveDefaultPreset(presets, current))
  }, [presets])

  useEffect(() => {
    if (settings) {
      setTheme(settings.theme || 'system')
      setLanguage(settings.language || 'en')
      setUiLanguage(settings?.uiLanguage || 'en')
      setDefaultIDE(settings.defaultIDE || 'VSCode')
      setAutoArchive(settings.autoArchive || 'never')
      setSoundAlerts(settings.soundAlerts ?? true)
      setSoundType(settings.soundType || 'Doorbell')
      setDesktopNotifications(settings.desktopNotifications ?? true)
      setLaunchAtLogin(settings.launchAtLogin ?? false)
      setPreventSleep(settings.preventSleep ?? true)
      setDefaultCodingPreset(resolveDefaultPreset(useStore.getState().presets, settings.defaultCodingPreset))
      setDefaultReviewPreset(resolveDefaultPreset(useStore.getState().presets, settings.defaultReviewPreset))
      setDefaultHelperPreset(resolveDefaultPreset(useStore.getState().presets, settings.defaultHelperPreset || settings.defaultReviewPreset))
      setUseMockData(settings.useMockData ?? true)
      setPreferNativeClaude(settings.preferNativeClaude ?? true)
      setDebugLogging(settings.debugLogging ?? false)
      setGlobalWorkspacePath(settings.globalWorkspacePath || '')
    }
  }, [settings])
  // Integrations State
  const [gatewayUrl, setGatewayUrl] = useState('http://127.0.0.1:4000/v1')
  const [apiKey, setApiKey] = useState('••••••••••••••••••••••••••••••••')
  const [mcpJson, setMcpJson] = useState(`{
  "mcpServers": {
    "git": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-git"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/developer"]
    }
  }
}`)

  // Git State
  const [defaultBranch, setDefaultBranch] = useState('main')
  const [signCommits, setSignCommits] = useState(false)
  const [autoPush, setAutoPush] = useState(true)
  const [autoFetch, setAutoFetch] = useState(true)
  const [worktreeDir, setWorktreeDir] = useState('worktrees/')

  // Repositories State
  const [reposList] = useState([
    { id: 'mock-1', name: 'ZIAForge', path: '/Users/developer/Projects/ZIAForge', repoPath: '/Users/developer/Projects/ZIAForge' },
    { id: 'mock-2', name: 'app.deepaudit.ai', path: '/Users/developer/Projects/app.deepaudit.ai', repoPath: '/Users/developer/Projects/app.deepaudit.ai' },
    { id: 'mock-3', name: 'customer-engagement-portal', path: '/Users/developer/Projects/customer-engagement-portal', repoPath: '/Users/developer/Projects/customer-engagement-portal' }
  ])

  const isDirty = 
    theme !== (settings?.theme || 'system') ||
    language !== (settings?.language || 'en') ||
    uiLanguage !== (settings?.uiLanguage || 'en') ||
    defaultIDE !== (settings?.defaultIDE || 'VSCode') ||
    autoArchive !== (settings?.autoArchive || 'never') ||
    soundAlerts !== (settings?.soundAlerts ?? true) ||
    soundType !== (settings?.soundType || 'Doorbell') ||
    desktopNotifications !== (settings?.desktopNotifications ?? true) ||
    launchAtLogin !== (settings?.launchAtLogin ?? false) ||
    preventSleep !== (settings?.preventSleep ?? true) ||
    defaultCodingPreset !== resolveDefaultPreset(presets, settings?.defaultCodingPreset) ||
    defaultReviewPreset !== resolveDefaultPreset(presets, settings?.defaultReviewPreset) ||
    defaultHelperPreset !== resolveDefaultPreset(presets, settings?.defaultHelperPreset || settings?.defaultReviewPreset) ||
    useMockData !== (settings?.useMockData ?? true) ||
    preferNativeClaude !== (settings?.preferNativeClaude ?? true) ||
    debugLogging !== (settings?.debugLogging ?? false) ||
    globalWorkspacePath !== (settings?.globalWorkspacePath || '')

  const handleSave = async () => {
    if (saveInProgress.current) return
    if (activeSubTab === 'integrations') {
      try {
        JSON.parse(mcpJson)
        setJsonError(null)
      } catch (e: unknown) {
        setJsonError(`Invalid JSON configuration: ${e instanceof Error ? e.message : String(e)}`)
        return
      }
    }
    saveInProgress.current = true
    setIsSaving(true)
    setSaveError(null)
    try {
      await saveSettings({
        theme,
        language,
        uiLanguage,
        defaultIDE,
        autoArchive,
        soundAlerts,
        soundType,
        desktopNotifications,
        launchAtLogin,
        preventSleep,
        defaultCodingPreset,
        defaultReviewPreset, defaultHelperPreset,
        useMockData,
        preferNativeClaude,
        debugLogging,
        globalWorkspacePath
      })
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : String(error))
    } finally {
      saveInProgress.current = false
      setIsSaving(false)
    }
  }


  const subTabs = [
    { id: 'general', name: t('general'), icon: Sliders },
    { id: 'integrations', name: t('integrations'), icon: Sparkles },
    { id: 'git', name: t('git'), icon: Terminal },
    { id: 'repositories', name: t('repository'), icon: Folder },
    { id: 'presets', name: t('presets'), icon: PlayCircle },
    { id: 'control', name: uiText("Remote control", undefined, ((settings?.uiLanguage??'en').startsWith('ru')) ? 'ru' : undefined), icon: Terminal },
    { id: 'updates', name: uiText("Updates", undefined, ((settings?.uiLanguage??'en').startsWith('ru')) ? 'ru' : undefined), icon: RotateCcw },
    { id: 'review-teams', name: uiText("Review teams", undefined, ((settings?.uiLanguage??'en').startsWith('ru')) ? 'ru' : undefined), icon: Sparkles },
    { id: 'profile', name: t('profile'), icon: User }
  ]

  return (
    <div className="flex flex-1 bg-[#0b0c0e] text-zinc-300 overflow-hidden h-screen select-none">
      
      {/* Settings Left Navigation Sidebar */}
      <div className="w-[200px] border-r border-[#1e2024] bg-[#0f1012] p-3 flex flex-col justify-between h-full relative">
        <div className="absolute top-0 left-0 right-0 h-10 drag-region" />
        <div className="space-y-1 mt-10">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider pl-3 mb-3">{t('settings')}</h3>
          {subTabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as typeof activeSubTab)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  activeSubTab === tab.id
                    ? 'bg-[#1e2024] text-white font-semibold'
                    : 'hover:bg-[#15171a] hover:text-zinc-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Settings Right Configuration Area */}
      <div className="flex-1 flex flex-col overflow-hidden h-full px-8 relative">
        <div className="h-10 w-full drag-region shrink-0" />
        
        {/* Top Control Bar */}
        <div className="flex items-center justify-between border-b border-[#1e2024] pb-4 mb-6 no-drag-region">
          <h2 className="text-xl font-bold text-white">{['control', 'updates', 'review-teams'].includes(activeSubTab) ? subTabs.find(tab => tab.id === activeSubTab)?.name : t(`${activeSubTab}_settings`)}</h2>
          <div className="flex items-center gap-3">
            {(isDirty || isSaving) && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-[#ff6b00] hover:bg-[#ff7c1a] shadow-lg transition-all animate-fade-in disabled:opacity-50 disabled:cursor-wait"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{t(isSaving ? 'saving' : 'save_changes')}</span>
              </button>
            )}
            {activeSubTab === 'presets' && !editingPreset && (
              <button
                onClick={() => setEditingPreset({ isEdit: false, preset: { name: '', agent: 'Google Antigravity', model: 'auto', permissions: 'CLI settings', reasoningEffort: null } })}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-[#ff6b00] hover:bg-[#ff7c1a] shadow-lg transition-all animate-fade-in"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t('add_preset')}</span>
              </button>
            )}
          </div>
        </div>

        {saveError && (
          <div role="alert" className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
            {uiText("Error: {value1}", { value1: saveError })}
          </div>
        )}

        {/* Viewport */}
        <div className="flex-1 overflow-y-auto space-y-6 pb-12 pr-4">
          
          {/* GENERAL TAB */}
          {activeSubTab === 'control' && <ControlSettings />}
          {activeSubTab === 'updates' && <UpdatesPanel />}
          {activeSubTab === 'review-teams' && <ReviewTeamsSettings />}
          {activeSubTab === 'general' && (
            <div className="space-y-6 animate-fade-in">
              
              <div className="bg-[#15171a] border border-[#1e2024] rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#1e2024] pb-2">{t('appearance')}</h3>
                <div className="grid grid-cols-3 gap-4">
                  {settings?.useMockData === true && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('theme')}</label>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="system">{uiText("System")}</option>
                      <option value="dark">{uiText("Dark")}</option>
                      <option value="light">{uiText("Light")}</option>
                    </select>
                  </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('interface_language')}</label>
                    <select
                      value={uiLanguage}
                      onChange={(e) => setUiLanguage(e.target.value)}
                      className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      {UI_LANGUAGES.map(locale => <option key={locale.id} value={locale.id}>{locale.name}</option>)}
                    </select>
                  </div>
                  {settings?.useMockData === true && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('response_language')}</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      {UI_LANGUAGES.map(locale => <option key={locale.id} value={locale.id}>{locale.name}</option>)}
                    </select>
                  </div>
                  )}
                </div>
              </div>

              {settings?.useMockData === true && <>
              <div className="bg-[#15171a] border border-[#1e2024] rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#1e2024] pb-2">{t('code_editor')}</h3>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('default_ide')}</label>
                  <select
                    value={defaultIDE}
                    onChange={(e) => setDefaultIDE(e.target.value)}
                    className="w-full max-w-xs bg-[#1e2024] border border-[#2b2e33] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="VSCode">Visual Studio Code</option>
                    <option value="PhpStorm">PhpStorm</option>
                    <option value="Cursor">Cursor</option>
                    <option value="Sublime">Sublime Text</option>
                  </select>
                </div>
              </div>

              <div className="bg-[#15171a] border border-[#1e2024] rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#1e2024] pb-2">{t('tasks')}</h3>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('auto_archive')}</label>
                  <select
                    value={autoArchive}
                    onChange={(e) => setAutoArchive(e.target.value)}
                    className="w-full max-w-xs bg-[#1e2024] border border-[#2b2e33] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="never">{uiText("Never")}</option>
                    <option value="1week">{uiText("1 week")}</option>
                    <option value="1month">{uiText("1 month")}</option>
                  </select>
                </div>
              </div>

              <div className="bg-[#15171a] border border-[#1e2024] rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#1e2024] pb-2">{t('desktop_notifications')}</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={soundAlerts}
                      onChange={(e) => setSoundAlerts(e.target.checked)}
                      className="rounded bg-[#1e2024] border-[#2b2e33] text-[#ff6b00] focus:ring-[#ff6b00]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-zinc-300 block">{t('sound_alerts')}</span>
                      <span className="text-[10px] text-zinc-500">{uiText("Play sound when subtasks complete")}</span>
                    </div>
                  </label>
                  {soundAlerts && (
                    <div className="pl-6">
                      <select
                        value={soundType}
                        onChange={(e) => setSoundType(e.target.value)}
                        className="bg-[#1e2024] border border-[#2b2e33] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                      >
                        <option value="Doorbell">{uiText("Doorbell")}</option>
                        <option value="Notification">{uiText("Notification Bell")}</option>
                        <option value="Chime">{uiText("Chime")}</option>
                      </select>
                    </div>
                  )}
                  <label className="flex items-center gap-3 cursor-pointer border-t border-[#1e2024] pt-3">
                    <input
                      type="checkbox"
                      checked={desktopNotifications}
                      onChange={(e) => setDesktopNotifications(e.target.checked)}
                      className="rounded bg-[#1e2024] border-[#2b2e33] text-[#ff6b00] focus:ring-[#ff6b00]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-zinc-300 block">{t('desktop_notifications')}</span>
                      <span className="text-[10px] text-zinc-500">{uiText("Show system banner when task ends")}</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="bg-[#15171a] border border-[#1e2024] rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#1e2024] pb-2">{t('system_audio')}</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={launchAtLogin}
                      onChange={(e) => setLaunchAtLogin(e.target.checked)}
                      className="rounded bg-[#1e2024] border-[#2b2e33] text-[#ff6b00] focus:ring-[#ff6b00]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-zinc-300 block">{t('launch_at_login')}</span>
                      <span className="text-[10px] text-zinc-500">{t('launch_at_login_desc')}</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer border-t border-[#1e2024] pt-3">
                    <input
                      type="checkbox"
                      checked={preventSleep}
                      onChange={(e) => setPreventSleep(e.target.checked)}
                      className="rounded bg-[#1e2024] border-[#2b2e33] text-[#ff6b00] focus:ring-[#ff6b00]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-zinc-300 block">{t('prevent_sleep')}</span>
                      <span className="text-[10px] text-zinc-500">{t('prevent_sleep_desc')}</span>
                    </div>
                  </label>
                </div>
              </div>

              </>}

              <div className="bg-[#15171a] border border-[#1e2024] rounded-xl p-5 space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={preferNativeClaude} onChange={event => setPreferNativeClaude(event.target.checked)} className="mt-1 rounded bg-[#1e2024] border-[#2b2e33] text-[#ff6b00]" />
                  <span>
                    <span className="text-xs font-semibold text-zinc-300 block">{t('prefer_native_claude')}</span>
                    <span className="text-[10px] text-zinc-500">{t('prefer_native_claude_desc')}</span>
                  </span>
                </label>
              </div>

              <div className="bg-[#15171a] border border-[#1e2024] rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#1e2024] pb-2">{uiText("Developer & Workspace")}</h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useMockData}
                      onChange={(e) => setUseMockData(e.target.checked)}
                      className="rounded bg-[#1e2024] border-[#2b2e33] text-[#ff6b00] focus:ring-[#ff6b00]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-zinc-300 block">{uiText("Developer mock mode (version {version})", { version: appVersion?.version ?? "0.0.1" })}</span>
                      <span className="text-[10px] text-zinc-500">{uiText("Run the application with pre-generated mock data and simulated agent outputs")}</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={debugLogging}
                      onChange={(e) => setDebugLogging(e.target.checked)}
                      className="rounded bg-[#1e2024] border-[#2b2e33] text-[#ff6b00] focus:ring-[#ff6b00]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-zinc-300 block">{uiText("Enable Debug Logging")}</span>
                      <span className="text-[10px] text-zinc-500">{t('settings_debug_logging_description')}</span>
                    </div>
                  </label>
                  
                  <div className="border-t border-[#1e2024] pt-3">
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">{uiText("Global Workspace Directory")}</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={globalWorkspacePath}
                        className="flex-1 bg-[#1e2024] border border-[#2b2e33] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const path = await window.ziafAPI.selectDirectory()
                          if (path) setGlobalWorkspacePath(path)
                        }}
                        className="bg-[#1e2024] hover:bg-[#2b2e33] text-zinc-300 px-3 py-2 rounded-lg text-xs font-semibold border border-[#2b2e33] transition-colors"
                      >
                        {uiText("Browse...")}</button>
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-1 block">
                      {uiText("All projects, temporary branch worktrees, and logs will be organized in subfolders within this directory.")}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INTEGRATIONS TAB */}
          {activeSubTab === 'integrations' && settings?.useMockData !== true && <ApiConnectionsPanel />}
          {activeSubTab === 'integrations' && settings?.useMockData === true && (
            <div className="space-y-6 animate-fade-in">
              {jsonError && (
                <div className="border border-rose-500/25 bg-rose-500/5 text-rose-400 p-4 rounded-xl text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>{uiText("⚠ JSON Validation Error")}</span>
                  </div>
                  <p className="text-zinc-300 font-mono text-[10px]">{jsonError}</p>
                </div>
              )}
              <div className="bg-[#15171a] border border-[#1e2024] rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#1e2024] pb-2">{t('litellm_model_gateway')}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('gateway_endpoint_url')}</label>
                    <input
                      type="text"
                      value={gatewayUrl}
                      onChange={(e) => setGatewayUrl(e.target.value)}
                      className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('authorization_api_key')}</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#15171a] border border-[#1e2024] rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#1e2024] pb-2">{t('mcp_servers_configuration')}</h3>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 mb-2">{"config/mcp.json"}</label>
                  <textarea
                    value={mcpJson}
                    onChange={(e) => {
                      setMcpJson(e.target.value)
                      try {
                        JSON.parse(e.target.value)
                        setJsonError(null)
                      } catch (err: unknown) {
                        setJsonError(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`)
                      }
                    }}
                    rows={8}
                    className="w-full bg-[#0f1012] border border-[#2b2e33] rounded-lg p-3 text-xs text-zinc-300 font-mono focus:outline-none focus:border-[#ff6b00] resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* GIT TAB */}
          {activeSubTab === 'git' && settings?.useMockData !== true && <div data-testid="settings-git-guidance" className="rounded-xl border border-[#1e2024] bg-[#15171a] p-5 text-xs leading-relaxed text-zinc-400">{t('settings_git_guidance')}</div>}
          {activeSubTab === 'git' && settings?.useMockData === true && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-[#15171a] border border-[#1e2024] rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#1e2024] pb-2">{t('git_options')}</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('default_base_branch')}</label>
                      <input
                        type="text"
                        value={defaultBranch}
                        onChange={(e) => setDefaultBranch(e.target.value)}
                        className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('worktrees_directory_subfolder')}</label>
                      <input
                        type="text"
                        value={worktreeDir}
                        onChange={(e) => setWorktreeDir(e.target.value)}
                        className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={signCommits}
                        onChange={(e) => setSignCommits(e.target.checked)}
                        className="rounded bg-[#1e2024] border-[#2b2e33] text-[#ff6b00] focus:ring-[#ff6b00]"
                      />
                      <div>
                        <span className="text-xs font-semibold text-zinc-300 block">{t('sign_commits')}</span>
                        <span className="text-[10px] text-zinc-500">{t('sign_commits_desc')}</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer border-t border-[#1e2024] pt-3">
                      <input
                        type="checkbox"
                        checked={autoPush}
                        onChange={(e) => setAutoPush(e.target.checked)}
                        className="rounded bg-[#1e2024] border-[#2b2e33] text-[#ff6b00] focus:ring-[#ff6b00]"
                      />
                      <div>
                        <span className="text-xs font-semibold text-zinc-300 block">{t('auto_push_branches')}</span>
                        <span className="text-[10px] text-zinc-500">{t('auto_push_branches_desc')}</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer border-t border-[#1e2024] pt-3">
                      <input
                        type="checkbox"
                        checked={autoFetch}
                        onChange={(e) => setAutoFetch(e.target.checked)}
                        className="rounded bg-[#1e2024] border-[#2b2e33] text-[#ff6b00] focus:ring-[#ff6b00]"
                      />
                      <div>
                        <span className="text-xs font-semibold text-zinc-300 block">{t('auto_fetch_changes')}</span>
                        <span className="text-[10px] text-zinc-500">{t('auto_fetch_changes_desc')}</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* REPOSITORIES TAB */}
          {activeSubTab === 'repositories' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-[#15171a] border border-[#1e2024] rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-[#1e2024] pb-2">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">{t('active_workspace_repositories')}</h3>
                  <button 
                    onClick={async () => {
                      if (settings?.useMockData) {
                        alert(uiText("Please turn off 'Developer Mock Mode' in General settings to select real folders from your computer."));
                      } else {
                        await addRepositoryInteractive();
                      }
                    }}
                    className="flex items-center gap-1 bg-[#1e2024] hover:bg-[#2b2e33] text-zinc-300 px-2.5 py-1 rounded-lg text-xs font-semibold border border-[#2b2e33] transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 text-[#ff6b00]" />
                    <span>{t('add_repository')}</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {(settings?.useMockData ? reposList : repositories).map((repo, idx) => (
                    <div key={repo.id || idx} className="flex justify-between items-center bg-[#0f1012] border border-[#1e2024] p-3 rounded-lg">
                      <div>
                        <span className="text-xs font-bold text-white block">{repo.name}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{repo.path}</span>
                      </div>
                      <button 
                        onClick={async () => {
                          if (settings?.useMockData) {
                            alert(uiText("Cannot delete mock repository"));
                          } else {
                            if (confirm(`Are you sure you want to remove project "${repo.name}"? This will not delete the repository files on disk.`)) {
                              await deleteRepository(repo.id);
                            }
                          }
                        }}
                        className="p-1.5 rounded bg-[#1e2024] text-zinc-500 hover:text-rose-500 hover:bg-[#2b2e33] transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PRESETS TAB */}
          {activeSubTab === 'presets' && editingPreset && <PresetEditorDialog
            initial={editingPreset.preset} isEdit={editingPreset.isEdit} existingNames={presets.map(preset => preset.name)}
            onSave={preset => editingPreset.isEdit && editingPreset.oldName
              ? useStore.getState().updatePreset(editingPreset.oldName, preset)
              : useStore.getState().addPreset(preset)}
            onClose={() => setEditingPreset(null)}
          />}

          {activeSubTab === 'presets' && !editingPreset && (
            <div className="space-y-6 animate-fade-in">
              {/* Default Presets Selection Card */}
              <div className="bg-[#15171a] border border-[#1e2024] p-5 rounded-xl space-y-4 shadow-xl">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#1e2024] pb-2">
                  {t('default_presets')}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('default_coding_preset')}</label>
                    <select
                      aria-label={t('default_coding_preset')}
                      data-testid="default-coding-preset"
                      value={defaultCodingPreset}
                      onChange={(e) => setDefaultCodingPreset(e.target.value)}
                      className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      {presets.map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('default_review_preset')}</label>
                    <select
                      aria-label={t('default_review_preset')}
                      data-testid="default-review-preset"
                      value={defaultReviewPreset}
                      onChange={(e) => setDefaultReviewPreset(e.target.value)}
                      className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      {presets.map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <label className="block text-xs text-zinc-400">{uiText("Background helper preset", undefined, (uiLanguage === 'ru') ? 'ru' : undefined)}<select data-testid="default-helper-preset" value={defaultHelperPreset} onChange={event => setDefaultHelperPreset(event.target.value)} className="mt-1 w-full rounded border border-zinc-700 bg-[#15171a] p-2 text-white">{presets.filter(item => item.agent !== 'Google Antigravity').map(item => <option key={item.name}>{item.name}</option>)}</select></label>
              {/* Presets Table View */}
              <div className="bg-[#15171a] border border-[#1e2024] rounded-xl overflow-hidden shadow-xl">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-[#1e2024] text-zinc-400 font-bold uppercase border-b border-[#2b2e33]">
                    <tr>
                      <th className="p-3">{t('preset_name')}</th>
                      <th className="p-3">{t('coding_agent')}</th>
                      <th className="p-3">{t('model')}</th>
                      <th className="p-3">{t('permissions')}</th>
                      <th className="p-3 text-right">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2024]">
                    {presets.map(p => (
                      <tr key={p.name} className="hover:bg-[#1a1c21] transition-colors">
                        <td className="p-3 font-semibold text-white">{p.name}</td>
                        <td className="p-3 text-zinc-400">{p.agent}</td>
                        <td className="p-3 font-mono text-[#ff6b00]">{p.model}</td>
                        <td className="p-3 text-zinc-500">
                          {translatePermission(p.permissions)}
                        </td>
                        <td className="p-3 text-right flex justify-end gap-2">
                          <button
                            onClick={() => setEditingPreset({
                              isEdit: true,
                              oldName: p.name,
                              preset: { ...p }
                            })}
                            className="p-1 rounded text-zinc-500 hover:text-white hover:bg-[#1e2024] transition-colors"
                            title={t('edit')}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`${t('delete_preset')} "${p.name}"?`)) {
                                await useStore.getState().deletePreset(p.name)
                              }
                            }}
                            className="p-1 rounded text-zinc-500 hover:text-rose-500 hover:bg-rose-950/20 transition-colors"
                            title={t('delete')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DEV OPTIONS & PROFILE TAB */}
          {activeSubTab === 'profile' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-[#15171a] border border-[#1e2024] rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#1e2024] pb-2">{t('developer_profile')}</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-zinc-500 block">{t('workspace_user')}</span>
                    <span className="font-semibold text-white">{settings?.useMockData === true ? 'developer' : t('settings_local_profile')}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">{t('ziaforge_license')}</span>
                    <span className="font-semibold text-white">Apache-2.0</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#15171a]/30 border border-rose-500/20 rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-rose-500 uppercase tracking-wider border-b border-rose-500/20 pb-2">{t('danger_zone')}</h3>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-semibold text-zinc-300 block">{t('reset_database_archives')}</span>
                    <span className="text-[10px] text-zinc-500">{t('reset_database_archives_desc')}</span>
                  </div>
                  <button 
                    onClick={async () => {
                      if (confirm(t('reset_database') + "?")) {
                        const res = await window.ziafAPI.resetDatabase()
                        if (res.success) {
                          localStorage.clear()
                          alert(uiText("Database reset successfully! The application will reload.", undefined, (uiLanguage === 'ru') ? 'ru' : undefined))
                          window.location.reload()
                        } else {
                          alert(uiText("Error: {value1}", { value1: res.error || uiText("Unknown error") }))
                        }
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-500 border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{t('reset_database')}</span>
                  </button>
                </div>

                <div className="flex justify-between items-center border-t border-[#1e2024] pt-4">
                  <div>
                    <span className="text-xs font-semibold text-zinc-300 block">{t('restore_factory_defaults')}</span>
                    <span className="text-[10px] text-zinc-500">{t('restore_factory_defaults_desc')}</span>
                  </div>
                  <button 
                    onClick={async () => {
                      if (confirm(t('restore_defaults') + "?")) {
                        const res = await window.ziafAPI.restoreFactoryDefaults()
                        if (res.success) {
                          localStorage.clear()
                          alert(uiText("Factory defaults restored successfully! The application will quit.", undefined, (uiLanguage === 'ru') ? 'ru' : undefined))
                          await window.ziafAPI.quitApp()
                        } else {
                          alert(uiText("Error: {value1}", { value1: res.error || uiText("Unknown error") }))
                        }
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 border border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{t('restore_defaults')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
