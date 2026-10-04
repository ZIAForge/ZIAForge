import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DiagnosticLog, formatDiagnosticText, redactDiagnosticText } from '../DiagnosticLog'

const directories: string[] = []
const destination = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ziaforge-diagnostics-'))
  directories.push(directory)
  return path.join(directory, 'debug.log')
}
afterEach(() => directories.splice(0).forEach(directory => fs.rmSync(directory, { recursive: true, force: true })))

describe('diagnostic log privacy and storage bounds', () => {
  it('removes credentials from headers, JSON, environment assignments and URLs before truncation', () => {
    const credentials = ['private-header-value', 'private-cookie-value', 'private-json-value', 'private-env-value', 'private-url-value', 'private-query-value']
    const input = `Authorization: Bearer ${credentials[0]}\nCookie: session=${credentials[1]}\n{"access_token":"${credentials[2]}"}\nANTHROPIC_API_KEY=${credentials[3]}\nhttps://user:${credentials[4]}@host/path?token=${credentials[5]}`
    const output = redactDiagnosticText(input)
    for (const secret of credentials) expect(output).not.toContain(secret)
    expect(output).toContain('[REDACTED]')
    expect(output).toContain('https://[REDACTED]@host/path?token=[REDACTED]')
  })

  it('removes private keys, provider key formats and JWTs embedded in error messages', () => {
    const input = 'failed sk-ant-api03-privateTestKey123 github_pat_privateTestKey123 eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature\n-----BEGIN PRIVATE KEY-----\nprivate-material\n-----END PRIVATE KEY-----'
    expect(redactDiagnosticText(input)).toBe('failed [REDACTED] [REDACTED] [REDACTED]\n[REDACTED]')
  })

  it('prevents forged multiline entries and bounds large Unicode output', () => {
    expect(formatDiagnosticText('\x1b[31mhello\x1b[0m\n[Main] fake\rreset')).toBe('hello\\n[Main] fake\\rreset')
    const result = formatDiagnosticText('界'.repeat(1000), 100)
    expect(Buffer.byteLength(result)).toBeLessThanOrEqual(100)
    expect(result).toContain('[truncated]')
    expect(result).not.toContain('\uFFFD')
    expect(formatDiagnosticText('pass\x1b[0mword=private-fixture-value')).toBe('password=[REDACTED]')
    expect(formatDiagnosticText('sk-ant-\x1b[31mprivateTestKey123')).toBe('[REDACTED]')
  })

  it('bounds the complete entry including timestamp and restricts legacy archives', () => {
    const filePath = destination()
    new DiagnosticLog({ filePath }).append('界'.repeat(10_000), 'Critical')
    expect(fs.statSync(filePath).size).toBeLessThanOrEqual(8192)
    fs.writeFileSync(filePath, 'x'.repeat(512))
    fs.chmodSync(filePath, 0o644)
    fs.writeFileSync(`${filePath}.1`, 'previous log', { mode: 0o644 })
    new DiagnosticLog({ filePath, maxBytes: 512, retainedFiles: 2 }).append('rotate')
    for (const filename of [filePath, `${filePath}.1`, `${filePath}.2`]) {
      expect(fs.statSync(filename).mode & 0o777).toBe(0o600)
    }
  })

  it('bounds current and rotated files across repeated appends and logger recreation', () => {
    const filePath = destination()
    for (let i = 0; i < 100; i++) {
      new DiagnosticLog({ filePath, maxBytes: 512, retainedFiles: 2, maxEntryBytes: 180 })
        .append(`entry ${i}: ${'x'.repeat(400)}`, 'Renderer')
    }
    const files = fs.readdirSync(path.dirname(filePath))
    expect(files.sort()).toEqual(['debug.log', 'debug.log.1', 'debug.log.2'])
    for (const file of files) expect(fs.statSync(path.join(path.dirname(filePath), file)).size).toBeLessThanOrEqual(512)
    expect(fs.readFileSync(filePath, 'utf8')).toContain('entry 99:')
    expect(fs.statSync(filePath).mode & 0o777).toBe(0o600)
  })

  it('does not follow a log symlink and returns only the sanitized console text', () => {
    const filePath = destination()
    const victim = path.join(path.dirname(filePath), 'unrelated.txt')
    fs.writeFileSync(victim, 'original')
    fs.symlinkSync(victim, filePath)
    const log = new DiagnosticLog({ filePath })
    expect(() => log.append('overwrite')).toThrow('regular file')
    expect(fs.readFileSync(victim, 'utf8')).toBe('original')
    fs.unlinkSync(filePath)
    expect(log.append('password=private-value')).toBe('password=[REDACTED]')
    expect(fs.readFileSync(filePath, 'utf8')).not.toContain('private-value')
  })

  it('bounds oversized legacy logs and archives during upgrade, preserving complete recent lines', () => {
    const filePath = destination()
    fs.writeFileSync(filePath, 'old log line\n'.repeat(5000) + 'recent legacy entry\n')
    fs.writeFileSync(`${filePath}.1`, 'old archived line\n'.repeat(5000))
    new DiagnosticLog({ filePath, maxBytes: 512, retainedFiles: 2 }).append('new entry')
    const files = fs.readdirSync(path.dirname(filePath)).map(file => path.join(path.dirname(filePath), file))
    for (const file of files) expect(fs.statSync(file).size).toBeLessThanOrEqual(512)
    expect(files.map(file => fs.readFileSync(file, 'utf8')).join('')).toContain('recent legacy entry\n')
    expect(fs.readFileSync(filePath, 'utf8')).toContain('new entry')
  })
})
