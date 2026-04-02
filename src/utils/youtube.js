export function getVideoId(url) {
  try {
    const parsed = new URL(url)
    return parsed.searchParams.get('v') || null
  } catch {
    return null
  }
}
