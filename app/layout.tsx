import { Analytics } from '@vercel/analytics/next'
import { Outfit } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import type { CSSProperties } from 'react'
import { AppNotifications } from '@/components/ui/app-notifications'
import { getStoreAppearance } from '@/lib/data/site-content'
import { APP_PALETTES } from '@/lib/home-configuration'
import { StorefrontCartProvider } from '@/lib/hooks/use-storefront-cart'
import './globals.css'

export const dynamic = 'force-dynamic'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'ISK Lenses — Contact lenses in Pakistan', template: '%s — ISK Lenses' },
  description: 'Shop contact lenses online in Pakistan. Browse brands, colors and collections and order with cash on delivery.',
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#087ba5',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const appearance = await getStoreAppearance()
  const palette = APP_PALETTES[appearance.palette]
  const themeStyle = {
    '--isk-theme-ink': palette.ink,
    '--isk-theme-blue': palette.sky,
    '--isk-theme-primary': palette.primary,
    '--isk-theme-light': palette.light,
    '--isk-theme-surface': palette.surface,
    '--isk-theme-paper': palette.paper,
    '--isk-theme-muted': palette.muted,
    '--isk-theme-rule': palette.rule,
    '--foreground': palette.ink,
    '--primary': palette.primary,
    '--primary-foreground': '#ffffff',
    '--secondary': palette.surface,
    '--secondary-foreground': palette.ink,
    '--accent': palette.surface,
    '--accent-foreground': palette.ink,
    '--border': palette.rule,
    '--input': palette.rule,
    '--ring': palette.sky,
  } as CSSProperties
  return (
    <html
      lang="en"
      className={outfit.variable}
      style={themeStyle}
      data-button-style={appearance.button}
      data-textbox-style={appearance.textbox}
      data-menu-style={appearance.menu}
      data-navigation-style={appearance.navigation}
    >
      <body className="antialiased">
        <div hidden aria-hidden="true" dangerouslySetInnerHTML={{ __html: '<!--\nTHESIS: ISK Lenses makes real lens photography and shade comparisons the focus, not decorative color claims.\nOWN-WORLD: Clear sky-blue fields, deep ocean-blue actions, cool white surfaces, and untouched product colors.\nSTORY: Shoppers browse the catalog, compare genuine photos and details, add items to the bag, and continue through the existing checkout.\nFIRST VIEWPORT: Blue announcement strip, white logo/search row, category links, and the existing full-height image-led hero with its primary action left.\nFORM: Preserve the current responsive storefront and nine-panel snap homepage; this is a palette change guided by isklenses.com, not a layout replacement.\n-->' }} />
        <AppNotifications>
          <StorefrontCartProvider>{children}</StorefrontCartProvider>
        </AppNotifications>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
