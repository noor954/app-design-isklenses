const APK_URL = 'https://www.isklenses.online/isklenses.apk'

export type AndroidRelease = { status: 'available'; downloadUrl: string; publishedAt: null }

export async function getAndroidRelease(): Promise<AndroidRelease> {
  return { status: 'available', downloadUrl: APK_URL, publishedAt: null }
}
