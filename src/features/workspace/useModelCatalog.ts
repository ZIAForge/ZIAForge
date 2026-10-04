import { useEffect, useState } from 'react'
import type { AgentModelCatalog } from '../../../shared/agent-models'

export type ModelCatalogLoader = (agent: string, apiConnectionId?: string) => Promise<AgentModelCatalog>
const loadModelCatalog: ModelCatalogLoader = (agent, apiConnectionId) => window.ziafAPI.getAgentModelCatalog({ agent, ...(apiConnectionId ? { apiConnectionId } : {}) })

export function useModelCatalog(agent: string, apiConnectionId?: string, loadCatalog: ModelCatalogLoader = loadModelCatalog) {
  const [catalog, setCatalog] = useState<AgentModelCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let current = true
    setLoading(true); setCatalog(null)
    void Promise.resolve().then(() => agent === 'OpenAI-compatible API' && !apiConnectionId ? { agent, models: [], source: 'api' as const, command: agent, status: 'unavailable' as const, queriedAt: Date.now() } : loadCatalog(agent, apiConnectionId)).then(result => {
      if (current) setCatalog(result)
    }).catch(() => {
      if (current) setCatalog({ agent, models: [], source: agent === 'OpenAI-compatible API' ? 'api' : 'cli', command: agent, status: 'unavailable', queriedAt: Date.now() })
    }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [agent, apiConnectionId, loadCatalog, refresh])
  return { catalog, loading, refresh: () => setRefresh(value => value + 1) }
}

