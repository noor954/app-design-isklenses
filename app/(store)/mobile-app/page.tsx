import type { Metadata } from 'next'
import { ArrowDownToLine, Check, Smartphone } from 'lucide-react'
import { getAndroidRelease } from '@/lib/android-release'

export const metadata: Metadata = { title: 'ISK Lenses mobile app', description: 'Explore the ISK Lenses Android app and download the latest available release.' }

export default async function MobileAppPage() {
  const release = await getAndroidRelease()
  return (
    <main>
      <section className="bg-[#e8f6fb]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <h1 className="max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight text-[#15384d] sm:text-6xl">ISK Lenses, wherever you go.</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[#526b7b]">Explore lenses, find your shade, and shop the ISK collection from your Android phone.</p>
            {release.status === 'available' ? (
              <a href={release.downloadUrl} className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#006f9b] px-6 py-3 font-semibold text-white hover:bg-[#15384d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#006f9b]"><ArrowDownToLine size={20} aria-hidden="true" /> Download Android APK</a>
            ) : (
              <p role="status" className="mt-8 max-w-lg rounded-2xl border border-[#b8d4e0] bg-white px-5 py-4 text-sm leading-6 text-[#15384d]">{release.status === 'error' ? 'The download is temporarily unavailable. Please try again later.' : 'The Android app is not available for download yet. Please check back soon.'}</p>
            )}
            <p className="mt-3 text-sm text-[#526b7b]">For Android devices. The APK is installed outside Google Play.</p>
          </div>
          <div aria-hidden="true" className="mx-auto flex h-64 w-40 items-center justify-center rounded-[2rem] border-[7px] border-[#15384d] bg-white shadow-[0_20px_40px_rgba(21,56,77,.18)] sm:h-80 sm:w-48">
            <div className="text-center text-[#006f9b]"><Smartphone className="mx-auto" size={58} strokeWidth={1.4} /><p className="mt-3 text-xl font-bold">ISK Lenses</p></div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <h2 className="text-2xl font-bold text-[#15384d] sm:text-3xl">The store in your pocket</h2>
        <ul className="mt-6 grid gap-4 text-[#15384d] sm:grid-cols-3">
          {['Browse and search the lens catalog', 'Choose available lens options and shop', 'Get help from the store assistant'].map((feature) => <li key={feature} className="flex items-start gap-3"><Check size={20} className="mt-1 shrink-0 text-[#006f9b]" aria-hidden="true" /><span>{feature}</span></li>)}
        </ul>
        <div className="mt-12 max-w-3xl border-t border-[#cfe2eb] pt-8">
          <h2 className="text-xl font-bold text-[#15384d]">Installing on Android</h2>
          <p className="mt-3 leading-7 text-[#526b7b]">Download the APK, open it from your downloads, and follow Android’s installation prompts. You may need to allow your browser or file manager to install apps from this source. Only download the app from a source you trust.</p>
          <p className="mt-3 leading-7 text-[#526b7b]">This download is for Android only; an iPhone download is not offered here.</p>
        </div>
      </section>
    </main>
  )
}
