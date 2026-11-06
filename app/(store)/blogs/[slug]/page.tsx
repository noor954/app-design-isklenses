import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ContentPage } from '@/components/storefront/content-page'
import { blogArticles } from '@/lib/blog-articles'

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = blogArticles.find((item) => item.slug === slug)
  if (!article) notFound()
  return (
    <ContentPage title={article.title} intro={article.summary}>
      <p>These general tips do not replace advice from your eye-care professional.</p>
      {article.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-3">{paragraph}</p>)}
        </section>
      ))}
      <p>Further reading: <a href={article.source} target="_blank" rel="noopener noreferrer">CDC contact lens guidance</a>.</p>
      <Link href="/blogs">Back to lens reading</Link>
    </ContentPage>
  )
}
