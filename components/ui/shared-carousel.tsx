'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CAROUSEL_INTERVAL_MS, type CarouselVariant } from '@/lib/carousel-variants'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'

type Props<T> = {
  items: T[]
  variant: CarouselVariant
  label: string
  getKey: (item: T) => string
  renderItem: (item: T, index: number) => ReactNode
  hasMore?: boolean
  onNeedMore?: () => void
  intervalMs?: number
  maxVisible?: number
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

/**
 * Shared auto-advancing carousel. Moves right-to-left every `intervalMs`,
 * pauses on hover/focus/manual pause, and requests the next page near the end.
 */
export function SharedCarousel<T>({
  items,
  variant,
  label,
  getKey,
  renderItem,
  hasMore = false,
  onNeedMore,
  intervalMs = CAROUSEL_INTERVAL_MS,
  maxVisible = 4,
}: Props<T>) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLUListElement>(null)
  const [per, setPer] = useState(2)
  const [index, setIndex] = useState(0)
  const [animate, setAnimate] = useState(true)
  const [hovered, setHovered] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const reduced = usePrefersReducedMotion()
  const count = items.length
  const effectivePer = variant === 'coverflow' ? 1 : Math.min(per, Math.max(count, 1))
  const paused = hovered || userPaused || reduced || count <= effectivePer

  useEffect(() => {
    const node = viewportRef.current
    if (!node) return
    const measure = () => {
      const width = node.clientWidth
      setPer(Math.min(maxVisible, width < 560 ? 2 : width < 900 ? 3 : 4))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [maxVisible])

  const loops = variant === 'infinite-loop'
  const clones = loops ? effectivePer : 0

  const advance = useCallback(
    (direction: 1 | -1 = 1) => {
      if (count === 0) return
      setAnimate(true)
      setIndex((current) => {
        const next = current + direction
        if (variant === 'infinite-loop') return next
        if (variant === 'fade-slide') {
          const pages = Math.ceil(count / effectivePer)
          return ((next % pages) + pages) % pages
        }
        return ((next % count) + count) % count
      })
    },
    [count, variant, effectivePer],
  )

  useEffect(() => {
    if (paused || variant === 'continuous') return
    const id = window.setInterval(() => advance(1), intervalMs)
    return () => window.clearInterval(id)
  }, [paused, variant, advance, intervalMs])

  // Infinite loop: after the clone window is reached, snap back to the start without animating.
  useEffect(() => {
    if (!loops || count === 0) return
    if (index >= count) {
      const id = window.setTimeout(() => {
        setAnimate(false)
        setIndex(index - count)
      }, 650)
      return () => window.clearTimeout(id)
    }
    if (index < 0) {
      setAnimate(false)
      setIndex(index + count)
    }
  }, [index, count, loops])

  // Continuous: constant-velocity scroll over a duplicated track.
  useEffect(() => {
    if (variant !== 'continuous' || paused) return
    const track = trackRef.current
    if (!track) return
    let frame = 0
    let last = performance.now()
    let offset = Number(track.dataset.offset ?? 0)
    const tick = (time: number) => {
      const elapsed = time - last
      last = time
      const half = track.scrollWidth / 2
      offset = half > 0 ? (offset + elapsed * 0.04) % half : 0
      track.dataset.offset = String(offset)
      track.style.transform = `translate3d(${-offset}px,0,0)`
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [variant, paused, count])

  // Ask for the next page when the reader approaches the end of loaded items.
  useEffect(() => {
    if (!hasMore || !onNeedMore) return
    const position = variant === 'fade-slide' ? (index + 1) * effectivePer : index + effectivePer
    if (variant === 'continuous' || position >= count - 2) onNeedMore()
  }, [index, count, hasMore, onNeedMore, variant, effectivePer])

  const transition = animate && !reduced ? 'transform 650ms cubic-bezier(.22,1,.36,1)' : 'none'
  const slideStyle: CSSProperties = { flex: `0 0 ${100 / effectivePer}%`, padding: '0 .5rem' }

  const controls = (
    <div className="mt-5 flex items-center justify-center gap-3">
      <button type="button" aria-label={`Previous ${label}`} onClick={() => advance(-1)} className="grid size-11 place-items-center rounded-full border border-[#b8d4e0] bg-white text-[#15384d] hover:bg-[#e8f6fb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087ba5]">
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <button type="button" aria-pressed={userPaused} aria-label={userPaused ? `Play ${label} carousel` : `Pause ${label} carousel`} onClick={() => setUserPaused((value) => !value)} className="grid size-11 place-items-center rounded-full border border-[#b8d4e0] bg-white text-[#15384d] hover:bg-[#e8f6fb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087ba5]">
        {userPaused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
      </button>
      <button type="button" aria-label={`Next ${label}`} onClick={() => advance(1)} className="grid size-11 place-items-center rounded-full border border-[#b8d4e0] bg-white text-[#15384d] hover:bg-[#e8f6fb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087ba5]">
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  )

  let body: ReactNode
  if (variant === 'coverflow') {
    body = (
      <ul className="mx-auto grid w-full max-w-5xl overflow-visible py-2 [perspective:1200px]" style={{ transformStyle: 'preserve-3d' }}>
        {items.map((item, itemIndex) => {
          let offset = itemIndex - index
          if (offset > count / 2) offset -= count
          if (offset < -count / 2) offset += count
          const abs = Math.abs(offset)
          const style: CSSProperties = {
            gridArea: '1 / 1',
            justifySelf: 'center',
            width: 'min(17rem, 58%)',
            transition: reduced ? 'none' : 'transform 650ms cubic-bezier(.22,1,.36,1), opacity 650ms',
            transform: `translateX(${offset * 72}%) translateZ(${-abs * 120}px) rotateY(${offset * -38}deg) scale(${abs === 0 ? 1 : 0.82})`,
            opacity: abs > 2 ? 0 : 1 - abs * 0.25,
            zIndex: 10 - abs,
            pointerEvents: abs === 0 ? 'auto' : 'none',
          }
          return (
            <li key={getKey(item)} style={style} aria-hidden={abs !== 0}>
              {renderItem(item, itemIndex)}
            </li>
          )
        })}
      </ul>
    )
  } else if (variant === 'fade-slide') {
    const pages = Math.max(Math.ceil(count / effectivePer), 1)
    const pageIndex = Math.min(index, pages - 1)
    const visible = items.slice(pageIndex * effectivePer, pageIndex * effectivePer + effectivePer)
    body = (
      <ul key={pageIndex} className="isk-carousel-fade flex" style={{ ['--isk-carousel-ms' as string]: reduced ? '0ms' : '650ms' }}>
        {visible.map((item, itemIndex) => (
          <li key={getKey(item)} style={slideStyle}>{renderItem(item, pageIndex * effectivePer + itemIndex)}</li>
        ))}
      </ul>
    )
  } else if (variant === 'continuous') {
    body = (
      <ul ref={trackRef} className="flex w-max will-change-transform">
        {[...items, ...items].map((item, itemIndex) => (
          <li key={`${getKey(item)}-${itemIndex}`} className="w-[min(70vw,16rem)] shrink-0 px-2" aria-hidden={itemIndex >= count}>
            {renderItem(item, itemIndex % Math.max(count, 1))}
          </li>
        ))}
      </ul>
    )
  } else {
    const rendered = loops ? [...items, ...items.slice(0, clones)] : items
    const maxIndex = Math.max(count - effectivePer, 0)
    const shift = loops ? index : Math.min(index, maxIndex)
    body = (
      <ul ref={trackRef} className="flex" style={{ transform: `translate3d(${-(shift * 100) / effectivePer}%,0,0)`, transition }}>
        {rendered.map((item, itemIndex) => (
          <li key={`${getKey(item)}-${itemIndex}`} style={slideStyle}>{renderItem(item, itemIndex % Math.max(count, 1))}</li>
        ))}
      </ul>
    )
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      data-carousel-variant={variant}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={() => setHovered(false)}
    >
      <div ref={viewportRef} className="overflow-hidden py-2">{body}</div>
      {variant !== 'continuous' && count > 1 && controls}
      {variant === 'continuous' && count > 1 && (
        <div className="mt-5 flex justify-center">
          <button type="button" aria-pressed={userPaused} aria-label={userPaused ? `Play ${label} carousel` : `Pause ${label} carousel`} onClick={() => setUserPaused((value) => !value)} className="grid size-11 place-items-center rounded-full border border-[#b8d4e0] bg-white text-[#15384d] hover:bg-[#e8f6fb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087ba5]">
            {userPaused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
          </button>
        </div>
      )}
    </div>
  )
}
