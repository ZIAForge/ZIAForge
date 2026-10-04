import React, { useState } from 'react'
import { useTranslation } from '../i18n'
import { Link2, Info, ChevronDown, Plus } from 'lucide-react'

interface IntegrationApp {
  id: string
  name: string
  category: 'development' | 'productivity'
  iconLabel: string
  iconBg: string
  iconColor: string
  dropdown?: { options: string[]; defaultValue: string }
  connectedAs?: string
  accessLevel?: string
}

const INTEGRATIONS: IntegrationApp[] = [
  // Development
  {
    id: 'github',
    name: 'GitHub',
    category: 'development',
    iconLabel: 'GH',
    iconBg: '#ffffff',
    iconColor: '#1a1a1a',
    connectedAs: 'developer',
    accessLevel: 'Full access',
  },
  {
    id: 'jira',
    name: 'Jira',
    category: 'development',
    iconLabel: 'J',
    iconBg: '#2684ff',
    iconColor: '#ffffff',
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'development',
    iconLabel: 'L',
    iconBg: '#5e6ad2',
    iconColor: '#ffffff',
  },
  {
    id: 'amplitude',
    name: 'Amplitude',
    category: 'development',
    iconLabel: 'A',
    iconBg: '#1bbfae',
    iconColor: '#ffffff',
    dropdown: { options: ['United States', 'Europe', 'Asia Pacific'], defaultValue: 'United States' },
  },
  {
    id: 'sentry',
    name: 'Sentry',
    category: 'development',
    iconLabel: 'S',
    iconBg: '#362d59',
    iconColor: '#ffffff',
  },
  // Productivity
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'productivity',
    iconLabel: 'M',
    iconBg: '#ea4335',
    iconColor: '#ffffff',
    dropdown: { options: ['Read only', 'Read & Write', 'Full access'], defaultValue: 'Read only' },
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    category: 'productivity',
    iconLabel: 'C',
    iconBg: '#4285f4',
    iconColor: '#ffffff',
    dropdown: { options: ['Read only', 'Read & Write', 'Full access'], defaultValue: 'Read only' },
  },
  {
    id: 'google-drive',
    name: 'Google Drive & Docs',
    category: 'productivity',
    iconLabel: 'D',
    iconBg: '#34a853',
    iconColor: '#ffffff',
    dropdown: { options: ['Read only', 'Read & Write', 'Full access'], defaultValue: 'Read only' },
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'productivity',
    iconLabel: 'H',
    iconBg: '#ff7a59',
    iconColor: '#ffffff',
  },
  {
    id: 'miro',
    name: 'Miro',
    category: 'productivity',
    iconLabel: 'M',
    iconBg: '#ffd02f',
    iconColor: '#1a1a1a',
    dropdown: { options: ['Read only', 'Read & Write', 'Full access'], defaultValue: 'Read & Write' },
  },
]

export const Connections: React.FC = () => {
  const { t } = useTranslation()
  const [connectedApps, setConnectedApps] = useState<Record<string, boolean>>({
    github: true,
  })
  const [dropdownValues, setDropdownValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    INTEGRATIONS.forEach((app) => {
      if (app.dropdown) {
        initial[app.id] = app.dropdown.defaultValue
      }
    })
    return initial
  })

  const toggleConnection = (id: string) => {
    setConnectedApps((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleDropdownChange = (id: string, value: string) => {
    setDropdownValues((prev) => ({ ...prev, [id]: value }))
  }

  const developmentApps = INTEGRATIONS.filter((app) => app.category === 'development')
  const productivityApps = INTEGRATIONS.filter((app) => app.category === 'productivity')

  const renderCard = (app: IntegrationApp) => {
    const isConnected = !!connectedApps[app.id]

    return (
      <div
        key={app.id}
        className="bg-[#15171a] border border-[#1e2024] rounded-xl px-5 py-4 flex items-center justify-between gap-4"
      >
        {/* Left side: icon + name + info */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ backgroundColor: app.iconBg, color: app.iconColor }}
          >
            {app.iconLabel}
          </div>
          <span className="text-sm font-medium text-white whitespace-nowrap">{app.name}</span>
          <Info className="h-4 w-4 text-zinc-500 shrink-0 cursor-help" />
        </div>

        {/* Right side: status / dropdown / button */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Connected status indicator */}
          {isConnected && app.connectedAs && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="whitespace-nowrap">
                {t('connected_as')} {app.connectedAs} ({t(app.accessLevel ? app.accessLevel.toLowerCase().replace(/ & /g, '_and_').replace(/ /g, '_') : '') || app.accessLevel})
              </span>
            </div>
          )}

          {/* Dropdown selector */}
          {!isConnected && app.dropdown && (
            <div className="relative">
              <select
                value={dropdownValues[app.id] || app.dropdown.defaultValue}
                onChange={(e) => handleDropdownChange(app.id, e.target.value)}
                className="appearance-none bg-[#1e2024] border border-[#2a2d32] text-zinc-300 rounded-lg px-3 py-2 text-sm pr-8 cursor-pointer focus:outline-none focus:border-[#3a3d42] transition-colors"
              >
                {app.dropdown.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {t(opt.toLowerCase().replace(/ & /g, '_and_').replace(/ /g, '_')) || opt}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
            </div>
          )}

          {/* Connect / Disconnect button */}
          {isConnected ? (
            <button
              onClick={() => toggleConnection(app.id)}
              className="border border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-400 rounded-lg px-4 py-2 text-sm transition-colors"
            >
              {t('disconnect')}
            </button>
          ) : (
            <button
              onClick={() => toggleConnection(app.id)}
              className="bg-[#ff6b00] hover:bg-[#e55f00] text-white rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-colors"
            >
              <Link2 className="h-4 w-4" />
              {t('connect')}
            </button>
          )}
        </div>
      </div>
    )
  }

  const renderCategory = (title: string, apps: IntegrationApp[]) => (
    <div className="space-y-3">
      <h3 className="text-sm text-zinc-400 uppercase tracking-wider font-medium">{t(title)}</h3>
      <div className="space-y-3">
        {apps.map(renderCard)}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0b0c0e] px-8 py-6">
      {/* Page Title */}
      <h1 className="text-xl font-bold text-white mb-6">{t('connections')}</h1>

      {/* Sub-header with action button */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-lg font-semibold text-white">{t('manage_connections')}</h2>
        <button className="bg-[#ff6b00] hover:bg-[#e55f00] text-white rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-colors">
          <Plus className="h-4 w-4" />
          {t('connect_more_apps')}
        </button>
      </div>

      {/* Integration Categories */}
      <div className="space-y-8">
        {renderCategory('development', developmentApps)}
        {renderCategory('productivity', productivityApps)}
      </div>
    </div>
  )
}
