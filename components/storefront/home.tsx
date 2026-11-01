import Link from 'next/link'
import type { CSSProperties } from 'react'
import { ArrowRight, BookOpen, Compass, Eye, Headphones, ShoppingBag, Star, type LucideIcon } from 'lucide-react'
import { Slider } from '@/components/storefront/home/slider'
import { SectionProgress } from '@/components/storefront/home/section-progress'
import { HomeScrollMotion } from '@/components/storefront/home/scroll-motion'
import { PagedSectionCarousel } from '@/components/storefront/home/paged-section-carousel'
import { getHomeSectionPage } from '@/lib/data/home-sections'
import { GalleryCard } from '@/components/storefront/home/gallery-card'
import { StorefrontFallbackImage } from '@/components/storefront/fallback-image'
import { TrendingProducts } from '@/components/storefront/home/trending-products'
import { StoreFooter } from '@/components/storefront/shell/store-footer'
import { RuntimeErrorNotice } from '@/components/ui/app-notifications'
import type { BannerContent, HomeContent, SiteChrome } from '@/lib/content-types'
import { DEFAULT_HOME_CONFIGURATION } from '@/lib/home-configuration'
import type { CategoryNode } from '@/lib/catalog-types'
import {
  getCategories,
  getHomeCatalog,
  getHomeProductsPage,
  getStorefrontBrands,
  getStorefrontLensTypes,
  getStorefrontReviews,
  getStorefrontShades,
} from '@/lib/data/catalog'
import { getHomeContent } from '@/lib/data/site-content'
import type { Product } from '@/lib/hooks/use-storefront-data'
import { categoryHref } from '@/lib/store-config'

function Img({ src, alt, className, priority = false }: { src: string; alt: string; className?: string; priority?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async" className={className} />
}

function Heading({
  first,
  accent,
  description,
  href,
  hrefLabel,
  inverse = false,
  id,
}: {
  first: string
  accent?: string
  description?: string
  href?: string
  hrefLabel?: string
  inverse?: boolean
  id?: string
}) {
  return (
    <div className={`flex flex-col gap-5 md:flex-row md:items-end md:justify-between ${inverse ? 'text-white' : 'text-[#15384d]'}`}>
      <div className="max-w-3xl">
        <h2 id={id} className="text-balance text-4xl font-extrabold leading-[0.98] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
          {first}
          {accent && <span className={`ml-2 font-serif font-normal italic ${inverse ? 'text-[#b8e8f5]' : 'text-[#087ba5]'}`}>{` ${accent}`}</span>}
        </h2>
        {description && <p className={`mt-4 max-w-2xl text-base leading-7 sm:text-lg ${inverse ? 'text-white/75' : 'text-[#526b7b]'}`}>{description}</p>}
      </div>
      {href && (
        <Link href={href} className={`inline-flex shrink-0 items-center gap-2 text-sm font-semibold transition-colors ${inverse ? 'text-[#b8e8f5] hover:text-white' : 'text-[#006f9b] hover:text-[#15384d]'}`}>
          {hrefLabel ?? 'Browse all'} <ArrowRight size={17} aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

function brandWordmarkClass(name: string) {
  const brand = name.toLowerCase()
  if (['bella', 'dahab', 'solotica', 'lenseme', 'victoria'].includes(brand)) return 'font-serif font-normal italic'
  if (['hydrocor', 'desio', 'anesthesia'].includes(brand)) return 'font-medium uppercase tracking-[0.1em]'
  return 'font-extrabold tracking-[-0.035em]'
}

const storeFeatures: { title: string; body: string; icon: LucideIcon }[] = [
  { title: 'Browse collections', body: 'Explore listings by brand, shade, and lens type.', icon: Compass },
  { title: 'Review product details', body: 'Compare the information shown on each listing.', icon: BookOpen },
  { title: 'Explore color options', body: 'Use the gallery as a guide, then check listing photos.', icon: Eye },
  { title: 'Manage your basket', body: 'Keep selected catalog items together as you browse.', icon: ShoppingBag },
  { title: 'Ask the store', body: 'Contact the team with questions about an order or listing.', icon: Headphones },
  { title: 'Follow professional guidance', body: 'Consult an eye-care professional about lens fit and suitability.', icon: Eye },
]

type HomeData = {
  content: HomeContent | null
  products: Product[]
  categories: CategoryNode[]
  brands: Awaited<ReturnType<typeof getStorefrontBrands>>
  shades: Awaited<ReturnType<typeof getStorefrontShades>>
  lensTypes: Awaited<ReturnType<typeof getStorefrontLensTypes>>
  reviews: Awaited<ReturnType<typeof getStorefrontReviews>>
  loadError?: string
}

async function loadHome(): Promise<HomeData> {
  const [content, catalog, categories, brands, shades, lensTypes, reviews] = await Promise.allSettled([
    getHomeContent(),
    getHomeCatalog(),
    getCategories(),
    getStorefrontBrands(),
    getStorefrontShades(),
    getStorefrontLensTypes(),
    getStorefrontReviews(),
  ])
  const failed = [
    ['Homepage content could not be loaded.', content],
    ['The product catalog could not be loaded.', catalog],
    ['Product categories could not be loaded.', categories],
    ['Product brands could not be loaded.', brands],
    ['Lens shades could not be loaded.', shades],
    ['Lens types could not be loaded.', lensTypes],
    ['Approved product reviews could not be loaded.', reviews],
  ] as const
  for (const [, result] of failed) {
    if (result.status === 'rejected') console.error('[home] Database content unavailable', result.reason instanceof Error ? result.reason.name : 'UnknownError')
  }
  const errors = failed.filter(([, result]) => result.status === 'rejected').map(([message]) => message)
  return {
    content: content.status === 'fulfilled' ? content.value : null,
    products: catalog.status === 'fulfilled'
      ? catalog.value as unknown as Product[]
      : [],
    categories: categories.status === 'fulfilled' ? categories.value : [],
    brands: brands.status === 'fulfilled' ? brands.value : [],
    shades: shades.status === 'fulfilled' ? shades.value : [],
    lensTypes: lensTypes.status === 'fulfilled' ? lensTypes.value : [],
    reviews: reviews.status === 'fulfilled' ? reviews.value : [],
    loadError: errors.join(' '),
  }
}

function Hero({
  slides,
  style,
  autoplayMs,
  layout,
  label,
}: {
  slides: BannerContent[]
  style: CSSProperties
  autoplayMs: number
  layout: string
  label: string
}) {
  return (
    <section id="hero" aria-label={label} data-hero-layout={layout} style={style} className="isk-home-section relative h-full min-h-full snap-start snap-always">
      {slides.length > 0 ? (
        <Slider label={label} autoPlayMs={autoplayMs} dots arrows editorialControls fullHeight>
          {slides.map((slide, index) => (
            <div key={slide.id} className="relative h-full min-h-full overflow-hidden bg-[#15384d]">
              <Img src={slide.imageUrl} alt={slide.title || 'ISK Lenses collection'} priority={index === 0} className="isk-home-hero-image absolute inset-0 size-full object-cover object-[68%_center]" />
              <div data-hero-overlay aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(21,56,77,.92)_0%,rgba(21,56,77,.73)_38%,rgba(21,56,77,.16)_76%,rgba(21,56,77,.08)_100%)]" />
              <div className={`relative mx-auto flex h-full min-h-full w-full min-w-0 max-w-[1440px] items-center px-5 pb-28 pt-12 sm:px-10 lg:px-12 ${layout === 'centered' ? 'justify-center text-center' : ''}`}>
                <div data-hero-copy className={`w-full min-w-0 max-w-[650px] text-white ${layout === 'centered' ? 'mx-auto' : ''} ${index === 0 ? 'isk-home-hero-copy' : ''}`}>
                  <h1 className="text-balance text-[clamp(2.6rem,7.6vw,6rem)] font-extrabold leading-[0.94] tracking-[-0.055em]">
                    {slide.title || 'ISK Lenses'}
                  </h1>
                  {slide.body && <p className="mt-6 w-full min-w-0 max-w-xl text-lg leading-8 text-white/85 sm:text-xl">{slide.body}</p>}
                  <Link href={slide.href || '/shop'} className="group mt-8 inline-flex min-h-14 items-center gap-3 rounded-full bg-[#087ba5] px-7 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#006f9b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                    {slide.href?.startsWith('/product/') ? 'View product' : 'Browse collection'}
                    <ArrowRight className="transition-transform group-hover:translate-x-1" size={18} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </Slider>
      ) : (
        <div className="flex h-full items-center justify-center bg-[#e8f6fb] px-6 text-center">
          <div className="isk-home-hero-empty-copy">
            <h1 className="text-balance text-4xl font-extrabold tracking-[-0.055em] text-[#15384d] sm:text-6xl">ISK Lenses</h1>
            <p className="mt-4 text-[#526b7b]">No featured collections are available right now.</p>
            <Link href="/shop" className="mt-7 inline-flex min-h-12 items-center rounded-full bg-[#006f9b] px-6 font-semibold text-white">Browse the catalog</Link>
          </div>
        </div>
      )}
    </section>
  )
}

function productImage(product: Product | undefined) {
  return product?.heroImageUrl ?? product?.assets?.find((asset) => asset.mediaType === 'image')?.blobUrl ?? null
}

function productVideo(product: Product | undefined) {
  return product?.assets?.find((asset) => asset.mediaType === 'video')?.blobUrl ?? null
}

export async function Home({ chrome }: { chrome: SiteChrome }) {
  const { content, products, categories, brands, shades, lensTypes, reviews, loadError } = await loadHome()
  const banners = (placement: BannerContent['placement']) => content?.banners.filter((banner) => banner.placement === placement) ?? []
  const h = content?.headings ?? {}
  const homeConfiguration = content?.configuration ?? DEFAULT_HOME_CONFIGURATION
  const configuredSection = (id: string) =>
    homeConfiguration.sections.find((section) => section.id === id)
  const sectionStyle = (id: string): CSSProperties => {
    const section = configuredSection(id)
    return {
      order: section?.order ?? 0,
      display: !section || !section.enabled ? 'none' : undefined,
    }
  }
  const sectionCopy = (id: string) =>
    configuredSection(id) ?? DEFAULT_HOME_CONFIGURATION.sections.find((section) => section.id === id)
  const linkedBrands = brands.filter((brand) => brand.productCount > 0)
  const featuredBrands = [...brands]
    .sort((left, right) => right.productCount - left.productCount || left.name.localeCompare(right.name))
  const heroSlides = banners('hero').slice(0, 7)
  const categoryCards = categories
    .filter((category) => category.isActive)
    .map((category) => {
      const product = products.find((item) => item.categoryPath === category.path || item.categoryPath?.startsWith(`${category.path}/`))
      return { category, product }
    })
  const shadeCards = shades.map((shade) => ({
    shade,
    product: products.find((product) => product.lensShadeId === shade.id),
  }))
  const [categoriesPage, brandsPage, shadesPage, catalogPage] = await Promise.all([
    getHomeSectionPage('categories'),
    getHomeSectionPage('brands'),
    getHomeSectionPage('shades'),
    getHomeProductsPage('catalog', 1),
  ])
  const carouselVariants = { categories: 'coverflow', brands: 'fade-slide', shades: 'infinite-loop' } as const
  const contactProduct = products.find((product) => productImage(product))
  const contactImage = productImage(contactProduct)
  return (
    <main id="isk-home-scroll" tabIndex={0} aria-label="Homepage sections, scroll to explore" className="isk-home flex flex-col snap-y snap-mandatory overflow-x-hidden overflow-y-auto overscroll-y-contain scroll-smooth bg-[#f7fcff] text-[#15384d]">
      <HomeScrollMotion />
      <RuntimeErrorNotice message={loadError} />
      <Hero
        slides={heroSlides}
        style={sectionStyle('hero')}
        autoplayMs={homeConfiguration.heroAutoplayMs}
        layout={homeConfiguration.heroLayout}
        label={sectionCopy('hero')?.title ?? 'Featured lens collections'}
      />
      <SectionProgress sections={homeConfiguration.sections} />

      <section id="bloom" aria-labelledby="bloom-heading" style={sectionStyle('bloom')} className="isk-home-section min-h-full snap-start snap-always bg-[#e8f6fb] py-8 sm:py-10 lg:flex lg:items-center">
        <div className="mx-auto grid w-full max-w-[1440px] items-center gap-8 px-4 sm:px-8 lg:grid-cols-[.85fr_1.4fr] lg:gap-10 lg:px-12">
          <div>
            <h2 id="bloom-heading" className="mt-8 max-w-xl text-5xl font-extrabold leading-[0.94] tracking-[-0.06em] sm:text-6xl">
              {sectionCopy('bloom')?.title ?? 'Browse collections'}
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#526b7b]">{sectionCopy('bloom')?.description ?? 'Shop active product categories from the ISK Lenses catalog.'}</p>
            <div className="mt-7 flex flex-wrap items-center gap-5">
              <Link href="/shop" className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[#006f9b] px-6 text-sm font-bold text-white transition hover:bg-[#087ba5]">
                Browse the catalog <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <span className="text-sm font-semibold text-[#526b7b]">{categoryCards.length} available {categoryCards.length === 1 ? 'category' : 'categories'}</span>
            </div>
          </div>
          <PagedSectionCarousel section="categories" label="categories" variant={carouselVariants.categories} initialItems={categoriesPage.items} initialHasMore={categoriesPage.hasMore} emptyMessage="No active categories are available right now. Browse the catalog or return after categories have been enabled." />
        </div>
      </section>

      <section id="brands" aria-labelledby="brands-heading" style={sectionStyle('brands')} className="isk-home-section min-h-full snap-start snap-always bg-[#f7fcff] py-8 sm:py-10 lg:flex lg:items-center">
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:px-12">
          <Heading
            id="brands-heading"
            first={sectionCopy('brands')?.title ?? 'Shop by brand'}
            description={sectionCopy('brands')?.description}
            href="/brands"
            hrefLabel="View all brands"
          />
          <PagedSectionCarousel section="brands" label="brands" variant={carouselVariants.brands} initialItems={brandsPage.items} initialHasMore={brandsPage.hasMore} emptyMessage="No active brands are available right now." />
        </div>
      </section>

      <section id="shades" aria-labelledby="shades-heading" style={sectionStyle('shades')} className="isk-home-section min-h-full snap-start snap-always bg-[#f7fcff] py-8 sm:py-10 lg:flex lg:items-center">
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:px-12">
          <Heading
            id="shades-heading"
            first={sectionCopy('shades')?.title ?? 'Shop by shade'}
            description={sectionCopy('shades')?.description}
            href="/shop"
            hrefLabel="Browse all shades"
          />
          <PagedSectionCarousel section="shades" label="shades" variant={carouselVariants.shades} initialItems={shadesPage.items} initialHasMore={shadesPage.hasMore} emptyMessage="No active lens shades are available right now." />
        </div>
      </section>

      <section id="trending" aria-labelledby="trending-heading" style={sectionStyle('trending')} className="isk-home-section min-h-full snap-start snap-always bg-white py-8 sm:py-10 lg:flex lg:items-center">
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:px-12">
          <div className="mb-8">
            <Heading
              id="trending-heading"
              first={sectionCopy('trending')?.title ?? 'Browse the catalog'}
              description={sectionCopy('trending')?.description}
              href="/shop"
              hrefLabel="Shop all lenses"
            />
          </div>
          <TrendingProducts initialProducts={catalogPage.items as unknown as Product[]} initialHasMore={catalogPage.hasMore} />
        </div>
      </section>

      <section id="types" aria-labelledby="types-heading" style={sectionStyle('types')} className="isk-home-section min-h-full snap-start snap-always bg-[#e8f6fb] py-8 sm:py-10 lg:flex lg:items-center">
        <div className="mx-auto grid w-full max-w-[1440px] gap-10 px-4 sm:px-8 lg:grid-cols-[.8fr_1.3fr] lg:items-center lg:gap-16 lg:px-12">
          <div>
            <h2 id="types-heading" className="mt-5 text-5xl font-extrabold leading-[0.96] tracking-[-0.06em] sm:text-6xl">
              {sectionCopy('types')?.title ?? 'Shop by lens type'}
            </h2>
            <p className="mt-5 max-w-md text-lg leading-8 text-[#526b7b]">{sectionCopy('types')?.description}</p>
            <Link href="/faq" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#15384d] hover:text-[#087ba5]">
              Need help choosing? <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          {lensTypes.length > 0 ? (
            <ul className="grid grid-cols-2 gap-x-5 sm:grid-cols-3">
              {lensTypes.map((lensType) => (
                <li key={lensType.id}>
                  {lensType.productCount > 0 ? (
                    <Link href={`/shop?q=${encodeURIComponent(lensType.name)}`} className="group flex min-h-28 items-center justify-between gap-3 border-t border-[#15384d]/20 py-4 transition-colors hover:border-[#087ba5] sm:min-h-32">
                      {lensType.fallbackImageUrl && (
                        <StorefrontFallbackImage
                          sources={[lensType.fallbackImageUrl]}
                          alt=""
                          className="size-12 shrink-0 rounded-lg"
                          imageClassName="object-contain"
                        />
                      )}
                      <span>
                        <span className="block text-base font-bold tracking-[-0.035em] text-[#15384d] sm:text-lg">{lensType.name}</span>
                        <span className="mt-1 block text-xs text-[#526b7b] sm:text-sm">{lensType.productCount} active {lensType.productCount === 1 ? 'listing' : 'listings'}</span>
                      </span>
                      <ArrowRight size={18} className="shrink-0 text-[#087ba5] transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </Link>
                  ) : (
                    <div className="flex min-h-28 items-center justify-between gap-3 border-t border-[#15384d]/20 py-4 sm:min-h-32">
                      <span>
                        <span className="block text-base font-bold tracking-[-0.035em] text-[#15384d] sm:text-lg">{lensType.name}</span>
                        <span className="mt-1 block text-xs text-[#526b7b] sm:text-sm">No active listings linked yet</span>
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-[#cfe2eb] bg-white/70 p-6 text-sm text-[#526b7b]">No lens types are available yet.</p>
          )}
        </div>
      </section>

      <section id="why-us" aria-labelledby="why-us-heading" style={sectionStyle('why-us')} className="isk-home-section min-h-full snap-start snap-always bg-[#15384d] py-8 text-white sm:py-10 lg:flex lg:items-center">
        <div className="mx-auto grid w-full max-w-[1440px] gap-10 px-4 sm:px-8 lg:grid-cols-[.8fr_1.3fr] lg:gap-16 lg:px-12">
          <div>
            <h2 id="why-us-heading" className="mt-5 max-w-xl text-5xl font-extrabold leading-[0.96] tracking-[-0.06em] sm:text-6xl">
              {sectionCopy('why-us')?.title ?? 'Browse with confidence'}
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-8 text-white/75">
              {sectionCopy('why-us')?.description}
            </p>
            <Link href="/faq" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#087ba5] px-6 text-sm font-semibold text-white transition hover:bg-white hover:text-[#15384d]">
              Read lens guidance <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <ul className="grid gap-px overflow-hidden rounded-3xl bg-white/10 sm:grid-cols-2">
            {storeFeatures.map(({ title, body, icon: FeatureIcon }) => {
              return (
                <li key={title} className="flex gap-4 bg-[#15384d] p-4 transition-colors hover:bg-white/5 sm:p-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-[#b8e8f5]"><FeatureIcon size={19} aria-hidden="true" /></span>
                  <div>
                    <h3 className="font-semibold text-white">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-white/70">{body}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <section id="reviews" aria-labelledby="reviews-heading" style={sectionStyle('reviews')} className="isk-home-section min-h-full snap-start snap-always overflow-hidden bg-[#e8f6fb] py-8 sm:py-10 lg:flex lg:items-center">
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:px-12">
          <Heading
            id="reviews-heading"
            first={sectionCopy('reviews')?.title ?? h.reviews ?? 'Product reviews'}
            description={sectionCopy('reviews')?.description ?? h.reviewsIntro}
          />
          {reviews.length > 0 ? (
            <div className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
              {reviews.map((review) => (
                <figure key={review.id} className="flex min-h-56 w-[min(84vw,440px)] shrink-0 snap-start flex-col rounded-[2rem] border border-[#cfe2eb] bg-white p-5 sm:w-[440px] sm:p-6">
                  {review.title && <h3 className="font-semibold text-[#15384d]">{review.title}</h3>}
                  <blockquote className="mt-4 flex-1 text-lg leading-8 text-[#15384d] sm:text-xl">“{review.body}”</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3 border-t border-[#cfe2eb] pt-4 text-sm font-semibold text-[#526b7b]">
                    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e8f6fb] font-bold text-[#006f9b]">{review.author.slice(0, 1)}</span>
                    <span className="min-w-0 flex-1 truncate">{review.author}</span>
                    <span className="inline-flex shrink-0 items-center gap-1"><Star size={14} className="fill-[#b66b24] text-[#b66b24]" aria-hidden="true" />{review.rating}/5</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="mt-8 rounded-2xl border border-[#cfe2eb] bg-white p-6 text-sm text-[#526b7b]">No approved product reviews have been published yet.</p>
          )}
        </div>
      </section>

      <section id="contact" aria-labelledby="contact-heading" style={sectionStyle('contact')} className="isk-home-contact-section isk-home-section min-h-full snap-start snap-always bg-[#f7fcff] pt-8 sm:pt-10 lg:flex lg:flex-col lg:justify-center">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col px-4 sm:px-8 lg:px-12">
          <div className="isk-home-contact-card relative grid min-h-[390px] flex-1 items-center gap-2 overflow-hidden rounded-[2rem] bg-[#087ba5] md:grid-cols-[1.3fr_1fr]">
            <div className="isk-home-contact-copy relative z-10 p-6 sm:p-9 lg:p-12">
              <h2 id="contact-heading" className="isk-home-contact-heading mt-4 max-w-2xl text-4xl font-extrabold leading-[0.96] tracking-[-0.055em] text-white sm:text-5xl">
                {sectionCopy('contact')?.title ?? h.serviceTitle ?? 'Questions about a listing or an order?'}
              </h2>
              <p className="isk-home-contact-body mt-4 max-w-xl text-base leading-7 text-white/90">
                {sectionCopy('contact')?.description ?? h.serviceBody}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/contact-us" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#15384d] px-6 text-sm font-bold text-white transition hover:bg-white hover:text-[#15384d]">
                  Contact the store <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className="relative z-10 flex min-h-[260px] items-center justify-center px-6 pb-6 md:min-h-0 md:px-8 md:py-10">
              {contactProduct && contactImage
                ? <Img src={contactImage} alt={contactProduct.name} className="isk-home-contact-portrait aspect-[1.05/1] w-full max-w-[400px] rounded-[50%] object-cover" />
                : <div aria-hidden="true" className="grid aspect-square w-full max-w-[320px] place-items-center rounded-full bg-white/15 text-white"><Eye size={64} strokeWidth={1.2} /></div>}
            </div>
          </div>
          <StoreFooter chrome={chrome} homepage brands={linkedBrands} categories={categories} />
        </div>
      </section>

    </main>
  )
}
