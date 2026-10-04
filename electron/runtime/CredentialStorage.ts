interface CredentialStorage {
  isEncryptionAvailable(): boolean
  getSelectedStorageBackend?(): string
}

/** Linux's basic_text fallback uses a public fixed password, not an OS secret store. */
export function protectedCredentialStorage(storage: CredentialStorage, platform: string = process.platform): boolean {
  if (!storage.isEncryptionAvailable()) return false
  if (platform !== 'linux') return true
  return ['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'].includes(storage.getSelectedStorageBackend?.() ?? 'unknown')
}
