export function normalizePreviewUrl(input: string): string | null {
  const value = input.trim()
  if (!value || value.length > 4096 || [...value].some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) return null
  // A local development server is commonly entered without its scheme.
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:[/?#]|$)/i.test(value)
  const candidate = local ? `http://${value}` : value
  try {
    const url = new URL(candidate)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null
    return url.href
  } catch { return null }
}
