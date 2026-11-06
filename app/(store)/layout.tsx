import { getSiteChrome } from '@/lib/data/site-content'
import { RuntimeErrorNotice } from '@/components/ui/app-notifications'
import { StoreFooter } from '@/components/storefront/shell/store-footer'
import { StoreFooterRoute } from '@/components/storefront/shell/store-footer-route'
import { StoreHeader } from '@/components/storefront/shell/store-header'
import { getStorefrontBrands } from '@/lib/data/catalog'
import { ChatbotWidget } from '@/components/storefront/chatbot-widget'
import { MessageCircle } from 'lucide-react'

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [chrome, brands] = await Promise.all([getSiteChrome(), getStorefrontBrands()])
  const linkedBrands = brands.filter((brand) => brand.productCount > 0)
  return (
    <div className="storefront-sky min-h-screen bg-[#f6fbff] text-[#080b10]">
      <RuntimeErrorNotice message={chrome.loadError} />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
      <StoreHeader chrome={chrome} />
      <div id="main">{children}</div>
      <StoreFooterRoute><StoreFooter chrome={chrome} brands={linkedBrands} /></StoreFooterRoute>
      <a
        href={chrome.whatsappSupportUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Connect on WhatsApp"
        className="fixed bottom-24 left-4 z-40 grid size-14 place-items-center rounded-full bg-[#087c47] text-white shadow-[0_8px_24px_rgba(21,56,77,.24)] transition hover:-translate-y-0.5 hover:bg-[#06683b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#15384d] motion-reduce:transition-none sm:left-6"
      >
        <MessageCircle size={25} aria-hidden="true" />
      </a>
      <ChatbotWidget />
    </div>
  )
}
