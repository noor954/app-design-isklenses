const RELEASE_API = 'https://api.github.com/repos/qaiserfccc/e-commerce-app-design/releases/tags/android-latest'
const ASSET_URL = 'https://github.com/qaiserfccc/e-commerce-app-design/releases/download/android-latest/isklenses.apk'

export type AndroidRelease =
  | { status: 'available'; downloadUrl: string; publishedAt: string }
  | { status: 'unavailable' | 'error' }

export async function getAndroidRelease(): Promise<AndroidRelease> {
  try {
    const response = await fetch(RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8000),
    })
    if (response.status === 404) return { status: 'unavailable' }
    if (!response.ok) throw new Error(`GitHub release lookup returned ${response.status}`)
    const release: unknown = await response.json()
    if (typeof release !== 'object' || release === null || !('assets' in release) || !Array.isArray(release.assets) ||
        !('published_at' in release) || typeof release.published_at !== 'string' ||
        !('draft' in release) || release.draft !== false || !('prerelease' in release) || release.prerelease !== false) {
      throw new Error('GitHub returned an invalid Android release')
    }
    const asset = release.assets.find((item: unknown) =>
      typeof item === 'object' && item !== null && 'name' in item && item.name === 'isklenses.apk' &&
      'state' in item && item.state === 'uploaded' && 'browser_download_url' in item && item.browser_download_url === ASSET_URL,
    )
    return asset
      ? { status: 'available', downloadUrl: ASSET_URL, publishedAt: release.published_at }
      : { status: 'unavailable' }
  } catch (error) {
    console.error('[android-release] Unable to check the Android release', error instanceof Error ? error.message : 'Unknown error')
    return { status: 'error' }
  }
}
