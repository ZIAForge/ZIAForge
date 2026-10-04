import { uiText } from '../../uiText'
import { useState } from 'react'
import { useStore } from '../../store'
import { StructuredChat } from './StructuredChat'
import { structuredProvider } from './modelSelection'

/** A real, separately configured read-only helper bound to a registered task. */
export function ProjectAssistant() {
  const { tasks, activeTaskId, presets, settings } = useStore()
  const [selectedTask, setSelectedTask] = useState(activeTaskId || '')
  const task = tasks.find(item => item.id === selectedTask)
  const ru = (settings?.uiLanguage || settings?.language || 'en').startsWith('ru')
  const preset = presets.find(item => item.name === settings?.defaultHelperPreset && item.agent !== 'Google Antigravity') || presets.find(item => item.agent === 'Codex') || presets.find(item => item.agent === 'Claude Code')
  return <section className="flex min-h-0 flex-1 flex-col" data-testid="project-assistant">
    <header className="space-y-3 border-b border-zinc-800 p-5">
      <h1 className="text-lg font-semibold text-white">{uiText("Project assistant", undefined, (ru) ? 'ru' : undefined)}</h1>
      <p className="text-xs text-zinc-400">{uiText("A separate read-only conversation for questions, research and result analysis. Select the preset, tool and model in the conversation settings.", undefined, (ru) ? 'ru' : undefined)}</p>
      <select aria-label={uiText("Assistant task", undefined, (ru) ? 'ru' : undefined)} className="w-full rounded border border-zinc-700 bg-[#15171a] p-2 text-sm" value={selectedTask} onChange={event => setSelectedTask(event.target.value)}><option value="">{uiText("Select a task", undefined, (ru) ? 'ru' : undefined)}</option>{tasks.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    </header>
    {task ? <StructuredChat taskId={task.id} chatId="chat-helper" presetName={preset?.name || ''} provider={structuredProvider(preset?.name || '', presets) || 'codex'} model={preset?.model} apiConnectionId={preset?.apiConnectionId} presets={presets.filter(item => item.agent !== 'Google Antigravity')} /> : <p className="p-6 text-sm text-zinc-500">{uiText("Create or select a task to work with its context.", undefined, (ru) ? 'ru' : undefined)}</p>}
  </section>
}
