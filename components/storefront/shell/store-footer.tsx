import Link from 'next/link'
import type { SiteChrome } from '@/lib/content-types'
import type { CategoryNode } from '@/lib/catalog-types'
import { STORE_NAME } from '@/lib/store-config'

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function LinkColumn({ title, links, homepage = false }: { title: string; links: string[][]; homepage?: boolean }) {
  return (
    <nav aria-label={title}>
      <h2 className={`text-xs font-bold uppercase tracking-[0.2em] ${homepage ? 'text-[#b83f6b]' : 'text-[#f3b4c9]'}`}>{title}</h2>
        <ul className={`mt-4 space-y-2.5 text-sm ${homepage ? 'isk-home-footer-links text-[#686371]' : 'text-white/75'}`}>
          {links.map(([label, href]) => <li key={label} className="min-w-0"><Link href={href} className={`block min-w-0 break-words [overflow-wrap:anywhere] transition-colors hover:underline ${homepage ? 'hover:text-[#201b35]' : 'hover:text-white'}`}>{label}</Link></li>)}
      </ul>
    </nav>
  )
}

export function StoreFooter({ chrome, homepage = false, brands = [], categories = [] }: { chrome: SiteChrome; homepage?: boolean; brands?: Array<{ name: string; slug?: string }>; categories?: CategoryNode[] }) {
  const { contact, footer } = chrome
  const phone = contact.phone ?? ''
  const email = contact.email ?? ''
  const facebook = contact.facebook ?? ''
  const instagram = contact.instagram ?? ''
  if (homepage) {
    const shop = categories
      .filter((category) => category.productCount > 0)
      .slice(0, 4)
      .map((category) => [category.name, `/product-category/${category.path}`])
    if (!shop.length) shop.push(['Shop all lenses', '/shop'])
    const help = [
      ['Contact the store', '/contact-us'],
      ['FAQs', '/faq'],
      ['Shipping & returns', '/shipping-returns'],
    ]
    return (
      <footer className="isk-home-footer mt-6 border-t border-[#e6dce1] bg-[#fffaf8] text-[#201b35]">
        <div className="grid gap-7 py-6 sm:grid-cols-2 md:grid-cols-4">
          <div className="sm:col-span-2 md:col-span-1">
            <Link href="/" aria-label={`${STORE_NAME} home`} className="inline-flex">
              <img src="/isk-lenses-portrait.svg" alt={`${STORE_NAME} logo`} width="160" height="220" className="w-28 rounded-xl" />
            </Link>
            {footer.about && <p className="mt-3 max-w-xs text-sm leading-6 text-[#686371]">{footer.about}</p>}
            <ul className="mt-3 space-y-1.5 text-xs text-[#686371]">
              {email && <li><a href={`mailto:${email}`} className="hover:underline">{email}</a></li>}
              {phone && <li><a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="hover:underline">{phone}</a></li>}
              {facebook && <li><a href={facebook} target="_blank" rel="noopener noreferrer" className="hover:underline">Facebook</a></li>}
              {instagram && <li><a href={instagram} target="_blank" rel="noopener noreferrer" className="hover:underline">Instagram</a></li>}
            </ul>
          </div>
          <LinkColumn title="Shop" links={shop} homepage />
          {brands.length > 0 && <LinkColumn title="Brands" links={brands.map(({ name, slug: brandSlug }) => [name, `/shop?brand=${encodeURIComponent(brandSlug ?? slug(name))}`])} homepage />}
          <LinkColumn title="Help" links={help} homepage />
        </div>
        <div className="border-t border-[#e6dce1] py-3 text-xs text-[#686371]">
          © {new Date().getFullYear()} ISK Lenses. Contact lenses are medical devices; follow the guidance of your eye-care professional.
        </div>
      </footer>
    )
  }
  return (
    <footer className="mt-24 border-t border-[#e6dce1] bg-[#201b35] text-white">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {brands.length > 0
          ? <LinkColumn title="Brands" links={brands.map(({ name, slug: brandSlug }) => [name, `/shop?brand=${encodeURIComponent(brandSlug ?? slug(name))}`])} />
          : footer.brands?.length ? <LinkColumn title="Brands" links={footer.brands.map((name) => [name, `/shop?q=${encodeURIComponent(name)}`])} /> : null}
        <div className="space-y-10">
          {footer.collections?.length ? <LinkColumn title="More collections" links={footer.collections.map((name) => [name, `/product-category/${slug(name)}`])} /> : null}
          {footer.explore?.length ? <LinkColumn title="Explore more" links={footer.explore.map(([name, path]) => [name, `/product-category/${path}`])} /> : null}
        </div>
        {footer.information?.length ? <LinkColumn title="Information" links={footer.information} /> : null}
        <div>
          <Link href="/" aria-label={`${STORE_NAME} home`} className="inline-flex">
            <img src="/isk-lenses-portrait.svg" alt={`${STORE_NAME} logo`} width="160" height="220" className="w-32 rounded-xl" />
          </Link>
          {footer.about && <p className="mt-4 max-w-sm text-sm leading-6 text-white/75">{footer.about}</p>}
          <ul className="mt-5 space-y-2 text-sm text-white/90">
            {facebook && <li><a href={facebook} target="_blank" rel="noopener noreferrer" className="hover:underline">Follow us on Facebook</a></li>}
            {email && <li><a href={`mailto:${email}`} className="hover:underline">{email}</a></li>}
            {phone && <li><a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="hover:underline">{phone}</a></li>}
            {contact.address && <li className="text-white/75">{contact.address}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15">
        <p className="mx-auto max-w-[1440px] px-4 py-5 text-xs text-white/65 sm:px-6">
          Copyright {new Date().getFullYear()} © {STORE_NAME} All Rights Reserved. Contact lenses are medical devices; follow the guidance of your eye-care professional.
        </p>
      </div>
    </footer>
  )
}
