export const CAROUSEL_VARIANTS = ['coverflow', 'fade-slide', 'infinite-loop', 'smooth-slide', 'continuous'] as const
export type CarouselVariant = (typeof CAROUSEL_VARIANTS)[number]

export const CAROUSEL_INTERVAL_MS = 3000

export function pickCarouselVariant(): CarouselVariant {
  return CAROUSEL_VARIANTS[Math.floor(Math.random() * CAROUSEL_VARIANTS.length)]
}
