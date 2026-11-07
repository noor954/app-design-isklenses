import { NextResponse } from 'next/server'
import { getAndroidRelease } from '@/lib/android-release'

export async function GET() {
  const release = await getAndroidRelease()
  return NextResponse.json({ data: release }, { headers: { 'Cache-Control': 'no-store' } })
}
