'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, Menu, MessageCircle, Phone, Search, ShoppingBag, Smartphone, Truck, User, X } from 'lucide-react'
import { GiftFlashBar } from '@/components/storefront/shell/gift-flash-bar'
import { MiniCart } from '@/components/storefront/shell/mini-cart'
import { useStorefrontCart } from '@/lib/hooks/use-storefront-cart'
import { useStorefrontCategories, type ProductCategory } from '@/lib/hooks/use-storefront-categories'
import type { SiteChrome } from '@/lib/content-types'
import { categoryHref, categoryTree, STORE_NAME } from '@/lib/store-config'

export function StoreHeader({ chrome }: { chrome: SiteChrome }) {
  const announcements = [chrome.deliveryNotice, ...chrome.announcements]
    .filter((item): item is string => Boolean(item?.trim()))
  const headerPhone = chrome.contact.phone ?? ''
  const headerEmail = chrome.contact.email ?? ''
  const router = useRouter()
  const pathname = usePathname()
  const isHome = pathname === '/'
  const { count } = useStorefrontCart()
  const { categories, isLoading: categoriesLoading, isError: categoriesError, mutate: refreshCategories } = useStorefrontCategories()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [announcement, setAnnouncement] = useState(0)
  const headerRef = useRef<HTMLElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const announcementText = announcements[announcement % Math.max(announcements.length, 1)] ?? 'Welcome to ISK Lenses'

  const tree = useMemo(() => categoryTree(categories), [categories])
  const roots = tree.get('root') ?? []

  useEffect(() => {
    setMobileOpen(false)
    setCartOpen(false)
    setSearchOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const dialog = mobileMenuRef.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]):not([tabindex="-1"])'))
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    dialog?.querySelector<HTMLElement>('#mobile-store-menu button')?.focus()
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [mobileOpen])

  useEffect(() => {
    if (announcements.length < 2) return
    const id = window.setInterval(() => setAnnouncement((value) => (value + 1) % announcements.length), 4000)
    return () => window.clearInterval(id)
  }, [announcements.length])

  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    const updateHeight = () => {
      document.documentElement.style.setProperty('--isk-header-height', `${header.getBoundingClientRect().height}px`)
    }
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(header)
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--isk-header-height')
    }
  }, [])

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    const term = query.trim()
    router.push(term ? `/shop?q=${encodeURIComponent(term)}` : '/shop')
    setSearchOpen(false)
  }

  const searchForm = (
    <form role="search" onSubmit={submitSearch} className="flex w-full items-center overflow-hidden rounded-full border border-[#e6dce1] bg-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#d45782]">
      <label className="sr-only" htmlFor="store-search">Search lenses</label>
      <input
        id="store-search"
        type="search"
        value={query}
        maxLength={100}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search lenses, brands, colors…"
        className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-[#686371]"
      />
      <button type="submit" aria-label="Search" className="grid h-10 w-12 place-items-center bg-[#b83f6b] text-white hover:bg-[#201b35]">
        <Search size={17} aria-hidden="true" />
      </button>
    </form>
  )

  return (
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-[#e6dce1] bg-[#f7fcff]/95 shadow-[0_8px_30px_rgba(21,56,77,0.08)] backdrop-blur-xl">
      <GiftFlashBar />
      <div className="bg-[#087ba5] text-white">
        <div className="mx-auto flex min-h-11 max-w-[1440px] items-center justify-between gap-3 px-4 text-xs sm:px-6">
          <p className="hidden min-w-0 flex-1 items-center gap-3 truncate text-white/90 lg:flex" aria-live="off">
            {headerPhone && <a href={`tel:${headerPhone.replace(/[^\d+]/g, '')}`} className="inline-flex shrink-0 items-center gap-1.5 hover:underline"><Phone size={12} aria-hidden="true" />{headerPhone}</a>}
            {headerEmail && <a href={`mailto:${headerEmail}`} className="truncate hover:underline">{headerEmail}</a>}
          </p>
          <p className="flex min-w-0 flex-1 items-center justify-center gap-2 text-center font-semibold tracking-wide lg:flex-[2]" aria-live="off">
            <Truck size={14} className="shrink-0 text-white/85" aria-hidden="true" />
            <span className="truncate">{announcementText}</span>
          </p>
          <a href={chrome.whatsappSupportUrl} target="_blank" rel="noopener noreferrer" aria-label="Connect on WhatsApp" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 font-semibold text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <MessageCircle size={16} aria-hidden="true" /> WhatsApp
          </a>
          <Link href="/mobile-app" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 font-semibold text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><Smartphone size={16} aria-hidden="true" /> <span className="hidden sm:inline">Get the app</span><span className="sm:hidden">App</span></Link>
          <Link href="/contact-us" className="hidden shrink-0 text-white/90 hover:text-white hover:underline sm:inline">Contact us</Link>
        </div>
      </div>

      <div className={`mx-auto flex max-w-[1440px] items-center gap-1 px-2 sm:gap-3 sm:px-6 ${isHome ? 'min-h-[76px] lg:min-h-[96px]' : 'h-[76px]'}`}>
        <button type="button" aria-label="Open menu" aria-controls="mobile-store-menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="grid size-10 shrink-0 place-items-center rounded-full text-[#201b35] hover:bg-[#fae9ef] lg:hidden">
          <Menu size={22} aria-hidden="true" />
        </button>
        <Link href="/" className="flex min-w-0 items-center gap-1.5 sm:shrink-0 sm:gap-2.5" aria-label={`${STORE_NAME} home`}>
          <img src="/icon.svg" alt="" aria-hidden="true" className="size-8 shrink-0 sm:size-10" />
          <span className="flex items-baseline gap-1 truncate leading-none">
            <span className="text-base font-extrabold tracking-[-0.055em] text-[#15384d] sm:text-2xl">ISK</span>
            <span className="isk-reference-brand truncate text-base font-semibold sm:text-2xl"><em>Lenses</em></span>
          </span>
        </Link>
        <div className={`mx-8 max-w-xl flex-1 ${isHome ? 'hidden' : 'hidden lg:block'}`}>{searchForm}</div>
        {isHome && (
          <nav aria-label="Featured categories" className="mx-auto hidden lg:block">
            <ul className="flex items-center gap-5 xl:gap-7">
              {roots.slice(0, 4).map((category) => (
                <li key={category.id}><Link href={categoryHref(category)} className="text-sm font-medium text-[#201b35] transition-colors hover:text-[#b83f6b]">{category.name}</Link></li>
              ))}
              <li><Link href="/brands" className="text-sm font-medium text-[#201b35] transition-colors hover:text-[#b83f6b]">Brands</Link></li>
              <li><Link href="/shop" className="text-sm font-medium text-[#d45782] transition-colors hover:text-[#b83f6b]">Catalog</Link></li>
            </ul>
          </nav>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-0 sm:gap-1.5">
          <button type="button" aria-label="Search" aria-expanded={searchOpen} onClick={() => setSearchOpen((open) => !open)} className={`grid size-11 place-items-center rounded-full text-[#201b35] hover:bg-[#fae9ef] ${isHome ? '' : 'lg:hidden'}`}>
            <Search size={20} aria-hidden="true" />
          </button>
          <Link href="/my-account" aria-label="My account" className="grid size-11 place-items-center rounded-full text-[#201b35] hover:bg-[#fae9ef]">
            <User size={20} aria-hidden="true" />
          </Link>
          <button type="button" onClick={() => setCartOpen(true)} aria-label={`Open cart, ${count} items`} className="relative grid size-11 place-items-center rounded-full text-[#201b35] hover:bg-[#fae9ef]">
            <ShoppingBag size={20} aria-hidden="true" />
            {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-[#b83f6b] px-1 text-xs font-bold leading-5 text-white">{count}</span>}
          </button>
        </div>
      </div>
      {searchOpen && <div className="border-t border-[#e6dce1] px-4 py-3 lg:hidden">{searchForm}</div>}

      {!isHome && <nav aria-label="Main" className="hidden border-t border-[#e6dce1] lg:block">
        <ul className="mx-auto flex max-w-[1440px] items-center gap-1 px-6 text-xs font-semibold uppercase tracking-[0.12em]">
          <li><Link href="/" className="block px-3 py-3 hover:text-[#b83f6b]">Home</Link></li>
          <li><Link href="/shop" className="block px-3 py-3 hover:text-[#b83f6b]">Shop all</Link></li>
          <li><Link href="/brands" className="block px-3 py-3 hover:text-[#b83f6b]">Brands</Link></li>
          {roots.slice(0, 8).map((root) => <DesktopItem key={root.id} node={root} tree={tree} top />)}
          <li className="ml-auto"><Link href="/blogs" className="block px-3 py-3 hover:text-[#b83f6b]">Blogs</Link></li>
        </ul>
      </nav>}

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" tabIndex={-1} className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div id="mobile-store-menu" ref={mobileMenuRef} className="absolute inset-y-0 left-0 flex h-[100dvh] w-[min(88vw,24rem)] max-w-[calc(100vw-1rem)] flex-col bg-[#fffaf8] shadow-2xl">
            <div className="flex h-16 items-center justify-between bg-[#201b35] px-4 text-white">
              <Link href="/" className="flex items-center gap-2" aria-label={`${STORE_NAME} home`}>
                <img src="/icon.svg" alt="" aria-hidden="true" className="size-9" />
                <span className="flex items-baseline gap-1 text-lg font-bold text-white">ISK <span className="isk-reference-brand-on-dark font-serif font-normal italic text-[#b8e8f5]">Lenses</span></span>
              </Link>
              <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="grid size-11 place-items-center"><X size={22} /></button>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2 text-sm font-semibold">
              {[['/', 'Home'], ['/shop', 'Shop all'], ['/brands', 'Brands'], ['/blogs', 'Blogs'], ['/faq', 'FAQ'], ['/contact-us', 'Contact us'], ['/my-account', 'My account']].map(([href, label]) => (
                <li key={href}><Link href={href} className="flex min-h-12 items-center border-b border-[#e6dce1] px-5 py-3.5">{label}</Link></li>
              ))}
              <li className="px-5 pb-1 pt-4 text-xs font-bold uppercase tracking-widest text-[#686371]">Categories</li>
              {categoriesLoading && roots.length === 0 && <li className="px-5 py-4 text-sm font-normal text-[#686371]" role="status">Loading categories…</li>}
              {categoriesError && roots.length === 0 && (
                <li className="px-5 py-4 text-sm font-normal text-[#686371]">
                  <p role="alert">Categories could not be loaded.</p>
                  <button type="button" onClick={() => void refreshCategories()} className="mt-2 font-semibold text-[#b83f6b] underline">Try again</button>
                </li>
              )}
              {!categoriesLoading && !categoriesError && roots.length === 0 && <li className="px-5 py-4 text-sm font-normal text-[#686371]">No categories are available yet.</li>}
              {roots.map((root) => <MobileItem key={root.id} node={root} tree={tree} expanded={expanded} toggle={(id) => setExpanded((current) => { const next = new Set(current); if (!next.delete(id)) next.add(id); return next })} depth={0} />)}
            </ul>
          </div>
        </div>
      )}

      <MiniCart open={cartOpen} onClose={() => setCartOpen(false)} />
    </header>
  )
}

type Tree = ReturnType<typeof categoryTree>

function DesktopItem({ node, tree, top = false }: { node: ProductCategory; tree: Tree; top?: boolean }) {
  const kids = tree.get(node.id) ?? []
  return (
    <li className={top ? 'group/menu relative' : 'group/sub relative'}>
      <Link href={categoryHref(node)} className={top ? 'flex items-center gap-1 px-3 py-3 uppercase tracking-wide hover:text-[#b83f6b]' : 'flex items-center justify-between gap-3 rounded px-3 py-2 text-sm font-medium hover:bg-[#fae9ef] hover:text-[#201b35]'}>
        {node.name}
        {kids.length > 0 && <ChevronDown size={14} aria-hidden="true" className={top ? '' : '-rotate-90'} />}
      </Link>
      {kids.length > 0 && (
        <ul className={`invisible absolute z-50 min-w-60 rounded-lg border border-[#e6dce1] bg-[#fffaf8] p-2 opacity-0 shadow-xl transition ${top ? 'left-0 top-full group-hover/menu:visible group-hover/menu:opacity-100 group-focus-within/menu:visible group-focus-within/menu:opacity-100' : 'left-full top-0 group-hover/sub:visible group-hover/sub:opacity-100 group-focus-within/sub:visible group-focus-within/sub:opacity-100'}`}>
          {kids.map((kid) => <DesktopItem key={kid.id} node={kid} tree={tree} />)}
        </ul>
      )}
    </li>
  )
}

function MobileItem({ node, tree, expanded, toggle, depth }: { node: ProductCategory; tree: Tree; expanded: Set<string>; toggle: (id: string) => void; depth: number }) {
  const kids = tree.get(node.id) ?? []
  const open = expanded.has(node.id)
  const childrenId = `mobile-category-${node.id}`
  return (
    <li className={depth === 0 ? 'border-b border-[#e6dce1]' : ''}>
      <div className="flex items-center">
        <Link href={categoryHref(node)} style={{ paddingLeft: 20 + depth * 16 }} className={`flex min-h-12 min-w-0 flex-1 items-center break-words py-3 pr-2 leading-5 ${depth === 0 ? 'uppercase' : 'font-medium'}`}>{node.name}</Link>
        {kids.length > 0 && (
          <button type="button" aria-expanded={open} aria-controls={childrenId} aria-label={`${open ? 'Collapse' : 'Expand'} ${node.name}`} onClick={() => toggle(node.id)} className="grid size-12 shrink-0 place-items-center">
            <ChevronDown size={18} className={open ? 'rotate-180' : ''} />
          </button>
        )}
      </div>
      <ul id={childrenId} hidden={!open} className="bg-[#e8f6fb]">{kids.map((kid) => <MobileItem key={kid.id} node={kid} tree={tree} expanded={expanded} toggle={toggle} depth={depth + 1} />)}</ul>
    </li>
  )
}
