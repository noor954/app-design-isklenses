import { NextResponse } from 'next/server'
import { blogArticles } from '@/lib/blog-articles'

export async function GET() {
  return NextResponse.json({ data: blogArticles }, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
