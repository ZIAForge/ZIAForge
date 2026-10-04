import { describe, expect, it } from 'vitest'
import { assertCommandScope, validateControlConfig, validateControlRequest } from '../ControlPolicy'
import type { ControlConfig } from '../../../shared/control'

const config = (): ControlConfig => ({ enabled: false, host: '127.0.0.1', port: 43210, scope: 'read', nativeComputer: false, assistantPreset: '', assistantOperate: false, telegramEnabled: false, telegramOwner: '', instances: [] })

describe('application command authority', () => {
  it('allows observations, rejects mutations for read access and never exposes owner grants as commands', () => {
    for (const method of ['getTasks', 'workflows.get', 'editorRead', 'system.context']) expect(() => assertCommandScope(method, 'read')).not.toThrow()
    for (const method of ['createTask', 'editorCreate', 'editorSave', 'workflows.respond', 'computer.run']) expect(() => assertCommandScope(method, 'read')).toThrow()
    for (const method of ['control.configure', 'control.rotateToken', 'updates.install', 'spawnPty', 'constructor', 'toString', '__proto__']) {
      expect(() => assertCommandScope(method, 'operate'), method).toThrow()
    }
    expect(() => assertCommandScope('editorSave', 'operate')).not.toThrow()
  })

  it('rejects authority injected into a command envelope and bounds IDs and argument lists', () => {
    expect(() => validateControlRequest({ method: 'getTasks', args: [], requestId: 'client-request-1' })).not.toThrow()
    for (const value of [null, [], { method: 'getTasks', scope: 'operate' }, { method: 'getTasks', nativeComputer: true }, { method: 'getTasks', args: {} }, { method: 'getTasks', args: Array(5).fill(null) }, { method: 'getTasks', requestId: '../grant' }, { method: 'getTasks', requestId: 'a'.repeat(161) }, { method: 'a'.repeat(101) }]) {
      expect(() => validateControlRequest(value)).toThrow()
    }
  })

  it('accepts only explicit owner booleans and bounded plain instance origins', () => {
    expect(() => validateControlConfig(config())).not.toThrow()
    expect(() => validateControlConfig({ ...config(), nativeComputer: true, assistantOperate: true })).not.toThrow()
    for (const change of [{ nativeComputer: 'true' }, { assistantOperate: 1 }, { host: 'example.com' }, { port: 80 }, { enabled: undefined }, { telegramOwner: '@owner' }, { scope: 'owner' }, { arbitraryGrant: true }]) expect(() => validateControlConfig({ ...config(), ...change })).toThrow()
    const instance = { id: 'second', name: 'Second instance', url: 'https://example.test', token: 'offline-fixture-token' }
    expect(() => validateControlConfig({ ...config(), instances: [instance] })).not.toThrow()
    for (const url of ['file:///tmp', 'https://user:password@example.test', 'https://example.test/path', 'https://example.test/?token=secret', 'https://example.test/#fragment']) expect(() => validateControlConfig({ ...config(), instances: [{ ...instance, url }] })).toThrow()
    expect(() => validateControlConfig({ ...config(), instances: [instance, instance] })).toThrow()
    expect(() => validateControlConfig({ ...config(), instances: Array.from({ length: 21 }, (_, i) => ({ ...instance, id: `instance-${i}` })) })).toThrow()
  })
})
