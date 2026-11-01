'use client'

import { useEffect, useMemo, useState } from 'react'
import type { HomeSectionConfiguration } from '@/lib/home-configuration'

export function SectionProgress({ sections }: { sections: HomeSectionConfiguration[] }) {
  const [active, setActive] = useState(0)
  const visibleSections = useMemo(
    () => sections
      .filter((section) => section.enabled)
      .sort((left, right) => left.order - right.order),
    [sections],
  )

  useEffect(() => {
    const nodes = visibleSections.map(({ id }) => document.getElementById(id)).filter((node): node is HTMLElement => Boolean(node))
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (!visible) return
      const index = visibleSections.findIndex(({ id }) => id === visible.target.id)
      if (index >= 0) setActive(index)
    }, { root: document.getElementById('isk-home-scroll'), threshold: [0.2, 0.45, 0.7] })
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [visibleSections])

  if (visibleSections.length < 2) return null

  return (
    <nav aria-label="Homepage sections" className="fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-end gap-4 md:flex">
      <span className="mb-1 font-mono text-xs tracking-[0.18em] text-[#526b7b]" aria-live="polite">
        {String(active + 1).padStart(2, '0')} / {String(visibleSections.length).padStart(2, '0')}
      </span>
      {visibleSections.map(({ id, title }, index) => (
        <a
          key={id}
          href={`#${id}`}
          aria-label={`${title}, section ${index + 1} of ${visibleSections.length}`}
          aria-current={active === index ? 'location' : undefined}
          onClick={(event) => {
            event.preventDefault()
            const root = document.getElementById('isk-home-scroll')
            const target = document.getElementById(id)
            if (root && target) {
              root.scrollTo({
                top: target.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop,
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
              })
            }
          }}
          className={`h-2 rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#087ba5] ${active === index ? 'w-6 bg-[#087ba5]' : 'w-2 bg-[#15384d]/30 hover:bg-[#087ba5]'}`}
        />
      ))}
    </nav>
  )
}
