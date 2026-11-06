import type { Metadata } from 'next'
import { ContentPage } from '@/components/storefront/content-page'
import { getSiteChrome } from '@/lib/data/site-content'
import { MessageCircle } from 'lucide-react'

export const metadata: Metadata = { title: 'Contact us' }

export default async function Page() {
  const { contact, whatsappSupportUrl } = await getSiteChrome()
  const hasContact = Boolean(contact.phone || contact.email || contact.whatsapp || contact.address || contact.facebook || contact.instagram)
  return (
    <ContentPage title="Contact us" intro="Questions about a product or an order? Get in touch with the store.">
      {hasContact ? (
        <ul className="!list-none !pl-0 grid gap-4 sm:grid-cols-2">
          {contact.phone && <li className="rounded-2xl bg-[#eef3fa] p-6"><h2>Call</h2><a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>{contact.phone}</a></li>}
          <li className="rounded-2xl bg-[#eef3fa] p-6"><h2>WhatsApp</h2><a href={whatsappSupportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#087c47] px-4 font-semibold !text-white no-underline hover:bg-[#06683b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15384d]"><MessageCircle size={18} aria-hidden="true" /> Connect on WhatsApp</a></li>
          {contact.email && <li className="rounded-2xl bg-[#eef3fa] p-6"><h2>Email</h2><a href={`mailto:${contact.email}`}>{contact.email}</a></li>}
          {contact.address && <li className="rounded-2xl bg-[#eef3fa] p-6"><h2>Address</h2><p>{contact.address}</p></li>}
          {contact.facebook && <li className="rounded-2xl bg-[#eef3fa] p-6"><h2>Facebook</h2><a href={contact.facebook} target="_blank" rel="noopener noreferrer">Visit our page</a></li>}
          {contact.instagram && <li className="rounded-2xl bg-[#eef3fa] p-6"><h2>Instagram</h2><a href={contact.instagram} target="_blank" rel="noopener noreferrer">Visit our profile</a></li>}
        </ul>
      ) : (
        <a href={whatsappSupportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#087c47] px-4 font-semibold !text-white no-underline hover:bg-[#06683b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15384d]"><MessageCircle size={18} aria-hidden="true" /> Connect on WhatsApp</a>
      )}
      <section>
        <h2>When you contact us</h2>
        <p>Please include your order reference (shown on the confirmation page) and the phone number used at checkout so we can find your order quickly.</p>
      </section>
    </ContentPage>
  )
}
