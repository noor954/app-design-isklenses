import type { Metadata } from 'next'
import { ArrowUpRight } from 'lucide-react'
import { ContentPage } from '@/components/storefront/content-page'
import { blogResources } from '@/lib/blog-resources'
import { blogArticles } from '@/lib/blog-articles'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Blogs' }

export default function Page() {
  return (
    <ContentPage title="Lens reading" intro="Guides to choosing and caring for contact lenses.">
      <section aria-label="ISK articles" className="divide-y divide-[#cfe2eb] border-y border-[#cfe2eb]">
        {blogArticles.map((article) => (
          <article key={article.slug} className="py-6">
            <h2><Link href={`/blogs/${article.slug}`}>{article.title}</Link></h2>
            <p className="mt-1 text-sm text-[#526b7b]">{article.summary}</p>
            <Link href={`/blogs/${article.slug}`} className="mt-3 inline-block">Read article</Link>
          </article>
        ))}
      </section>
      <p className="max-w-2xl text-[#526b7b]">Explore more articles from independent publishers. For personal advice about lenses, speak with an eye-care professional.</p>
      <section aria-label="External reading" className="divide-y divide-[#cfe2eb] border-y border-[#cfe2eb]">
        {blogResources.map((resource) => (
          <article key={resource.id} className="flex flex-wrap items-start justify-between gap-5 py-6">
            <div className="max-w-xl">
              <p className="text-sm text-[#526b7b]">{resource.publisher} · External website</p>
              <h2 className="mt-1">{resource.title}</h2>
              <p className="mt-1 text-sm text-[#526b7b]">{resource.description}</p>
            </div>
            <a href={resource.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[#006f9b] px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006f9b]">
              Visit archive <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </article>
        ))}
      </section>
    </ContentPage>
  )
}
