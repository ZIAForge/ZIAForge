import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { downloadGrokVideo } from '../ApiMediaDownload'
import type { ResolvedApiConnection } from '../ApiProviderStore'
import type { GrokVideoArtifact } from '../GrokProtocol'

const bytes = Buffer.from('bounded synthetic MP4 transfer; actual container parsing belongs to the media store')
const artifact: GrokVideoArtifact = { id: `file_${'a'.repeat(32)}`, kind: 'video', mime: 'video/mp4', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
const connection: ResolvedApiConnection = { id: 'fixture', name: 'Fixture', enabled: true, baseUrl: 'https://example.invalid/v1', model: 'grok-fixture', transport: 'responses', profile: 'grok-connector-v1', hasApiKey: true, apiKey: 'synthetic-key' }
const response = () => new Response(bytes, { headers: { 'content-type': 'video/mp4', 'content-length': String(bytes.length) } })

describe('protected Grok video custody', () => {
  it('derives only the authenticated same-origin Files endpoint and verifies exact bytes', async () => {
    const request = vi.fn(async () => response())
    expect(await downloadGrokVideo(connection, artifact, new AbortController().signal, request)).toEqual(bytes)
    expect(request).toHaveBeenCalledExactlyOnceWith(`https://example.invalid/v1/files/${artifact.id}/content`, expect.objectContaining({ headers: { Authorization: 'Bearer synthetic-key' }, redirect: 'error' }))
    await expect(downloadGrokVideo(connection, { ...artifact, id: 'https://foreign.invalid/video.mp4' }, new AbortController().signal, request)).rejects.toThrow('metadata')
    await expect(downloadGrokVideo(connection, { ...artifact, bytes: 128 * 1024 * 1024 + 1 }, new AbortController().signal, request)).rejects.toThrow('metadata')
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('refuses redirects, partial content, MIME mismatch, truncation, oversize and forged hashes', async () => {
    for (const bad of [new Response('', { status: 307 }), new Response(bytes, { status: 206 }), new Response(bytes, { headers: { 'content-type': 'text/html' } }), new Response(bytes.subarray(1), { headers: { 'content-type': 'video/mp4' } }), new Response(Buffer.concat([bytes, Buffer.from('x')]), { headers: { 'content-type': 'video/mp4' } }), new Response(Buffer.alloc(bytes.length), { headers: { 'content-type': 'video/mp4' } })]) await expect(downloadGrokVideo(connection, artifact, new AbortController().signal, async () => bad)).rejects.toThrow()
  })
  it('cancels a stalled protected body without returning partial bytes', async () => {
    const controller = new AbortController(), cancelled = vi.fn()
    let begin!: () => void
    const reading = new Promise<void>(resolve => { begin = resolve })
    const body = new ReadableStream<Uint8Array>({ pull() { begin() }, cancel: cancelled })
    const downloading = downloadGrokVideo(connection, artifact, controller.signal, async () => new Response(body, { headers: { 'content-type': 'video/mp4' } }))
    const rejected = expect(downloading).rejects.toThrow()
    await reading; controller.abort(new Error('Stopped by owner')); await rejected
    expect(cancelled).toHaveBeenCalledTimes(1)
  })
})
