import { NextResponse } from 'next/server'
import { blogResources } from '@/lib/blog-resources'

export async function GET() {
  return NextResponse.json({ data: blogResources }, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
