'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'

interface SliderProps {
  label: string
  children: ReactNode[]
  autoPlayMs?: number
  dots?: boolean
  arrows?: boolean
  perView?: string
  editorialControls?: boolean
  fullHeight?: boolean
}

// Scroll-snap carousel with optional autoplay, arrows and dots.
export function Slider({ label, children, autoPlayMs = 0, dots = false, arrows = true, perView = 'basis-full', editorialControls = false, fullHeight = false }: SliderProps) {
  const track = useRef<HTMLUListElement>(null)
  const paused = useRef(false)
  const [index, setIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(autoPlayMs > 0)
  const [isInView, setIsInView] = useState(false)
  const [isDocumentVisible, setIsDocumentVisible] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const count = children.length

  function go(next: number) {
    const el = track.current
    if (!el) return
    const target = (next + count) % count
    const item = el.children[target] as HTMLElement | undefined
    el.scrollTo({ left: item?.offsetLeft ?? 0, behavior: reducedMotion ? 'auto' : 'smooth' })
    setIndex(target)
  }

  useEffect(() => {
    const element = track.current?.parentElement
    if (!element || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting), { threshold: 0.1 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotionPreference = () => setReducedMotion(motionPreference.matches)
    const syncVisibility = () => setIsDocumentVisible(document.visibilityState === 'visible')
    syncMotionPreference()
    syncVisibility()
    motionPreference.addEventListener('change', syncMotionPreference)
    document.addEventListener('visibilitychange', syncVisibility)
    return () => {
      motionPreference.removeEventListener('change', syncMotionPreference)
      document.removeEventListener('visibilitychange', syncVisibility)
    }
  }, [])

  useEffect(() => {
    if (!autoPlayMs || count < 2 || !isPlaying || !isInView || !isDocumentVisible || reducedMotion) return
    const id = window.setInterval(() => { if (!paused.current) go(index + 1) }, autoPlayMs)
    return () => window.clearInterval(id)
  }, [autoPlayMs, count, index, isDocumentVisible, isInView, isPlaying, reducedMotion])

  function onScroll() {
    const el = track.current
    if (!el) return
    const first = el.children[0] as HTMLElement | undefined
    if (first?.offsetWidth) setIndex(Math.round(el.scrollLeft / first.offsetWidth))
  }

  return (
    <div
      className={`relative ${fullHeight ? 'h-full' : ''}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => { paused.current = true }}
      onMouseLeave={() => { paused.current = false }}
      onFocus={() => { paused.current = true }}
      onBlur={() => { paused.current = false }}
    >
      <ul ref={track} onScroll={onScroll} className={`flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${fullHeight ? 'h-full' : ''}`}>
        {children.map((child, i) => (
          <li key={i} data-active={index === i} className={`${perView} ${fullHeight ? 'h-full' : ''} min-w-0 shrink-0 snap-start`} aria-roledescription="slide" aria-label={`${i + 1} of ${count}`}>{child}</li>
        ))}
      </ul>
      {arrows && count > 1 && (
        editorialControls ? (
          <div className="absolute bottom-6 right-5 flex items-center gap-3 sm:bottom-8 sm:right-8">
            <button type="button" aria-label="Previous slide" onClick={() => go(index - 1)} className="grid size-11 place-items-center rounded-full border border-white/60 bg-white/90 text-[#15384d] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><ChevronLeft size={20} aria-hidden="true" /></button>
            <button type="button" aria-label="Next slide" onClick={() => go(index + 1)} className="grid size-11 place-items-center rounded-full border border-white/60 bg-white/90 text-[#15384d] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><ChevronRight size={20} aria-hidden="true" /></button>
          </div>
        ) : (
          <>
            <button type="button" aria-label="Previous" onClick={() => go(index - 1)} className="absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#033473] shadow hover:bg-white sm:grid"><ChevronLeft size={22} aria-hidden="true" /></button>
            <button type="button" aria-label="Next" onClick={() => go(index + 1)} className="absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#033473] shadow hover:bg-white sm:grid"><ChevronRight size={22} aria-hidden="true" /></button>
          </>
        )
      )}
      {dots && count > 1 && (
        <div className={editorialControls ? 'absolute bottom-6 left-5 flex gap-1 sm:bottom-8 sm:left-8 sm:gap-4' : 'absolute inset-x-0 bottom-3 flex justify-center gap-2'}>
          {children.map((_, i) => editorialControls ? (
            <button key={i} type="button" aria-label={`Show slide ${i + 1}`} aria-current={i === index} onClick={() => go(i)} className="group flex flex-col items-start gap-2 py-1">
              <span className={`relative block h-0.5 w-3 overflow-hidden rounded-full sm:w-16 ${i === index ? 'bg-[#b8e8f5]' : 'bg-white/45'}`} />
              <span className="text-xs font-medium text-white/85">{String(i + 1).padStart(2, '0')}</span>
            </button>
          ) : (
            <button key={i} type="button" aria-label={`Go to slide ${i + 1}`} aria-current={i === index} onClick={() => go(i)} className={`size-2.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/50'}`} />
          ))}
        </div>
      )}
      {autoPlayMs > 0 && count > 1 && (
        <button
          type="button"
          aria-label={reducedMotion ? 'Automatic slide rotation is disabled by the reduced motion preference' : isPlaying ? 'Pause automatic slide rotation' : 'Resume automatic slide rotation'}
          aria-pressed={isPlaying && !reducedMotion}
          disabled={reducedMotion}
          onClick={() => setIsPlaying((playing) => !playing)}
          className={`absolute grid size-10 place-items-center rounded-full border border-white/60 bg-white/90 text-[#15384d] shadow-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-70 ${editorialControls ? 'bottom-7 right-[9.5rem] sm:bottom-9 sm:right-[10.5rem]' : 'bottom-1.5 right-3 sm:bottom-2 sm:right-5'}`}
        >
          {isPlaying ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
        </button>
      )}
    </div>
  )
}
