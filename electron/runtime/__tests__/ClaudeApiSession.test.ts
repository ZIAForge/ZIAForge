import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RunService } from '../RunService'
import { SessionRegistry } from '../SessionRegistry'
import { ProcessSupervisor } from '../ProcessSupervisor'
import type { TrustedAgentSessionConfig } from '../SessionManager'
import { claudeFrame, claudeRecords, responseId } from '../../api/__tests__/claudeFixture'

const roots: string[] = [], services: RunService[] = [], servers: http.Server[] = []
afterEach(async () => {
  await Promise.all(services.splice(0).map(service => service.sessions.shutdown()))
  for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

describe('Claude Messages owned session integration', () => {
  it('keeps typed document bytes private, caches immutable artifact revisions, and resumes without replay across service restart', async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-claude-session-'))); roots.push(root)
    const documentText = 'Private document fixture: CEDAR-REFERENCE-7291'
    const filename = path.join(root, 'reference.txt'); fs.writeFileSync(filename, documentText)
    const pdf = Buffer.from('%PDF-1.7\nPrivate PDF fixture\n%%EOF\n')
    const pdfName = path.join(root, 'reference.pdf'); fs.writeFileSync(pdfName, pdf)
    const artifacts = [Buffer.from('private revision one\n'), Buffer.from('private revision two\n')]
    const metadata = artifacts.map((bytes, index) => ({ id: `file_${String(index + 1).padStart(32, '0')}`, kind: 'file', filename: 'report.txt', mime_type: 'application/octet-stream', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), api_url: `/v1/files/file_${String(index + 1).padStart(32, '0')}/content`, revision: index + 1, ...(index ? { supersedes_file_id: `file_${'1'.padStart(32, '0')}` } : {}) }))
    const posted: Array<{ previous_response_id?: string; messages: Array<{ role: string; content: Array<Record<string, unknown>> }> }> = []
    const downloads: string[] = [], authorization: string[] = []
    const server = http.createServer((request, response) => {
      authorization.push(request.headers.authorization ?? '')
      const artifactIndex = metadata.findIndex(item => request.url === item.api_url)
      if (artifactIndex >= 0) { downloads.push(request.url!); response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': artifacts[artifactIndex].length }); response.end(artifacts[artifactIndex]); return }
      if (request.url === '/v1/models') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ object: 'list', has_more: false, data: [{ id: 'fixture-model', type: 'model', display_name: 'Fixture model', reasoning_efforts: ['low', 'high'], input_modalities: ['text', 'image'], context_windows: [] }] })); return }
      if (request.url === '/v1/claude/capabilities') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ version: 1, provider: 'claude', toolCatalog: ['Write'], discoveredTools: [{ name: 'Write', available: true, enabled: true }] })); return }
      if (request.url !== '/v1/messages' || request.method !== 'POST') { response.writeHead(404); response.end(); return }
      let body = ''; request.on('data', chunk => { body += chunk }); request.on('end', () => {
        posted.push(JSON.parse(body)); const round = posted.length
        response.writeHead(200, { 'Content-Type': 'text/event-stream' })
        const extras = round === 1 ? metadata.map(artifact => ({ type: 'claude.artifact', version: 1, response_id: responseId(round), artifact })) : []
        const blocks = [{ type: 'thinking', thinking: 'Public summary', signature: 'private-signature-not-journaled' }, { type: 'text', text: round === 1 ? 'Files delivered.' : 'Continuation received.' }]
        response.end(claudeRecords(round, blocks, extras).map(claudeFrame).join(''))
      })
    })
    servers.push(server); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const config: TrustedAgentSessionConfig = { taskId: 'task', chatId: 'claude-chat', presetName: '', cwd: root, provider: 'api', model: 'fixture-model', reasoningEffort: 'low', apiConnectionId: 'claude-http-fixture', apiReadOnly: false, apiConnection: { id: 'claude-http-fixture', name: 'Claude HTTP fixture', model: 'fixture-model', enabled: true, hasApiKey: true, apiKey: 'fixture-key-never-persist', baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}`, transport: 'anthropic-messages', profile: 'claude-connector-v1', claude: { mode: 'native', nativeTools: ['Write'], permissionMode: 'manual' } } }
    const create = () => { const service = new RunService({ sessionRegistry: new SessionRegistry(), processSupervisor: new ProcessSupervisor(), baseStorageDir: path.join(root, 'state') }); services.push(service); return service }
    const first = create(), original = await first.sessions.create(config)
    expect(original).toMatchObject({ apiTransport: 'anthropic-messages', apiProfile: 'claude-connector-v1', apiClaudeConfig: { mode: 'native', permissionMode: 'manual', maxTokens: 4096, maxTurns: 30, historyMode: 'reject', nativeTools: ['Write'] } })
    const docs = await first.sessions.stageDocuments(original, [filename, pdfName])
    await expect(first.sessions.stageDocuments({ ...original, runId: 'foreign-run' }, [filename])).rejects.toThrow('stale')
    const foreign = await first.sessions.create({ ...config, chatId: 'other-chat' })
    await expect(first.sessions.send({ ...foreign, text: 'Try foreign documents', clientMessageId: 'foreign-documents', documentIds: docs.map(doc => doc.id) })).rejects.toThrow('unavailable')
    expect(posted).toHaveLength(0)
    await first.sessions.send({ ...original, text: 'Read the references and return two file revisions.', clientMessageId: 'first', documentIds: docs.map(doc => doc.id) })
    await vi.waitFor(async () => expect((await first.sessions.snapshot(original)).lastTurn?.status).toBe('completed'), { timeout: 5000 })
    // Renderer acknowledgement clears temporary inputs only after provider acceptance.
    await first.sessions.discardDocuments({ ...original, documentIds: docs.map(doc => doc.id) })
    expect(posted[0].messages).toEqual([{ role: 'user', content: [{ type: 'text', text: 'Read the references and return two file revisions.' }, { type: 'document', title: 'reference.txt', source: { type: 'text', media_type: 'text/plain', data: documentText } }, { type: 'document', title: 'reference.pdf', source: { type: 'base64', media_type: 'application/pdf', data: pdf.toString('base64') } }] }])
    const completed = await first.sessions.snapshot(original), refs = completed.feed.flatMap(message => message.tools ?? []).flatMap(tool => tool.artifacts ?? [])
    expect(refs).toHaveLength(2)
    expect(refs[1]).toMatchObject({ sourceRunId: original.runId, revision: 2, supersedesFileId: metadata[0].id, providerFileId: metadata[1].id })
    const artifactRequest = { sessionId: original.sessionId, runId: original.runId, artifactId: refs[0].id }
    expect(Buffer.from((await first.sessions.readArtifact(artifactRequest)).bytes)).toEqual(artifacts[0])
    await expect(first.sessions.readArtifact({ sessionId: foreign.sessionId, runId: foreign.runId, artifactId: refs[0].id })).rejects.toThrow('unavailable')
    const journal = fs.readFileSync(first.getJournal(original.taskId, original.runId).filePath, 'utf8'), publicState = JSON.stringify(completed)
    for (const privateValue of [documentText, pdf.toString('base64'), 'private-signature-not-journaled', 'fixture-key-never-persist', artifacts[0].toString()]) { expect(journal).not.toContain(privateValue); expect(publicState).not.toContain(privateValue) }
    expect(downloads).toEqual(metadata.map(item => item.api_url))
    await first.sessions.shutdown()
    const second = create(), attached = await second.sessions.attach(config)
    expect(attached).toMatchObject({ sessionStatus: 'disconnected', resumeAvailable: true })
    expect(Buffer.from((await second.sessions.readArtifact(artifactRequest)).bytes)).toEqual(artifacts[0])
    const resumed = await second.sessions.resume(attached!, config)
    expect(resumed.runId).not.toBe(original.runId); expect(posted).toHaveLength(1)
    await expect(second.sessions.readArtifact(artifactRequest)).rejects.toThrow('stale')
    expect(Buffer.from((await second.sessions.readArtifact({ ...artifactRequest, runId: resumed.runId, artifactId: refs[1].id })).bytes)).toEqual(artifacts[1])
    expect(downloads).toHaveLength(2)
    await second.sessions.send({ ...resumed, text: 'Continue from the same response.', clientMessageId: 'second' })
    await vi.waitFor(async () => expect((await second.sessions.snapshot(resumed)).lastTurn?.status).toBe('completed'), { timeout: 5000 })
    expect(posted[1]).toMatchObject({ previous_response_id: responseId(1), messages: [{ role: 'user', content: [{ type: 'text', text: 'Continue from the same response.' }] }] })
    const pinned = second.sessions.persistedLaunch(resumed)
    await second.sessions.terminate(resumed)
    await expect(second.sessions.resume(resumed, { ...config, ...pinned, apiConnection: { ...config.apiConnection!, claude: { ...config.apiConnection!.claude, permissionMode: 'dontAsk' } } })).rejects.toThrow('Saved Claude configuration changed')
    expect(posted).toHaveLength(2); expect(authorization.every(value => value === 'Bearer fixture-key-never-persist')).toBe(true)
  })
})
