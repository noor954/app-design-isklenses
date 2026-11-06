import { NextResponse } from 'next/server'
import { getAndroidRelease } from '@/lib/android-release'

export async function GET() {
  const release = await getAndroidRelease()
  if (release.status === 'error') {
    return NextResponse.json({ error: 'The Android download could not be checked. Please try again later.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ data: release }, { headers: { 'Cache-Control': 'no-store' } })
}
