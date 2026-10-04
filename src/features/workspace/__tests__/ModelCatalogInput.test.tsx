/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentModelCatalog } from '../../../../shared/agent-models'
import { useStore, type Settings } from '../../../store'
import { ModelCatalogInput } from '../ModelCatalogInput'

const catalog = (agent: string, ids: string[]): AgentModelCatalog => ({ agent, models: ids.map(id => ({ id, label: id })), status: 'ready', source: 'cli', command: `${agent} native catalog`, queriedAt: 1 })
describe('Native model catalogs', () => {
  beforeEach(() => useStore.setState({ settings: { uiLanguage: 'en' } as Settings }))
  afterEach(cleanup)
  it('exposes every returned model and provenance, while refreshing never replaces a manual selection', async () => {
    const load = vi.fn().mockResolvedValueOnce(catalog('Codex', ['visible', 'hidden/preview'])).mockResolvedValueOnce(catalog('Codex', ['future-model']))
    const onChange = vi.fn()
    const { rerender } = render(<ModelCatalogInput agent="Codex" value="custom/model" loadCatalog={load} onChange={onChange} />)
    await act(async () => {})
    expect(screen.getByTestId('model-id-catalog').textContent).toContain('hidden/preview')
    expect(screen.getByTestId('model-id-catalog-status').textContent).toContain('Codex native catalog')
    fireEvent.change(screen.getByTestId('model-id-catalog'), { target: { value: 'hidden/preview' } })
    expect(onChange).toHaveBeenLastCalledWith('hidden/preview')
    rerender(<ModelCatalogInput agent="Codex" value="custom/model" loadCatalog={load} onChange={onChange} />)
    await act(async () => fireEvent.click(screen.getByTestId('model-id-refresh')))
    expect((screen.getByTestId('model-id') as HTMLInputElement).value).toBe('custom/model')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('model-id-catalog').textContent).toContain('future-model')
  })
  it('ignores stale provider catalogs and shows unavailable errors without inventing model IDs', async () => {
    let resolveOld!: (value: AgentModelCatalog) => void
    const load = vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve })).mockResolvedValueOnce({ ...catalog('Claude Code', []), status: 'unavailable', error: 'CLI initialization failed' })
    const onChange = vi.fn()
    const { rerender } = render(<ModelCatalogInput agent="Codex" value="auto" loadCatalog={load} onChange={onChange} />)
    await act(async () => {})
    rerender(<ModelCatalogInput agent="Claude Code" value="private-model" loadCatalog={load} onChange={onChange} />)
    await act(async () => resolveOld(catalog('Codex', ['wrong-provider-model'])))
    expect(screen.getByTestId('model-id-catalog-error').textContent).toBe('CLI initialization failed')
    expect(screen.getByTestId('model-id-catalog').textContent).not.toContain('wrong-provider-model')
    expect(screen.getByTestId('model-id-catalog').querySelectorAll('option')).toHaveLength(2)
    fireEvent.change(screen.getByTestId('model-id'), { target: { value: 'my/manual-id' } })
    expect(onChange).toHaveBeenCalledWith('my/manual-id')
  })
})
