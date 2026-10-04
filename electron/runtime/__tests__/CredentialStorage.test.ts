import { expect, it } from 'vitest'
import { protectedCredentialStorage } from '../CredentialStorage'

it('refuses the unprotected Linux fallback even when Electron reports encryption available', () => {
  const storage = { isEncryptionAvailable: () => true, getSelectedStorageBackend: () => 'basic_text' }
  expect(protectedCredentialStorage(storage, 'linux')).toBe(false)
  expect(protectedCredentialStorage({ ...storage, getSelectedStorageBackend: () => 'unknown' }, 'linux')).toBe(false)
  expect(protectedCredentialStorage({ ...storage, getSelectedStorageBackend: () => 'gnome_libsecret' }, 'linux')).toBe(true)
})
