'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/ui/notifications'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error, 'This page could not be loaded. Please try again.', {
      phase: 'next-error-boundary',
      digest: error.digest,
    })
  }, [error])

  return (
    <main className="grid min-h-[60vh] place-items-center px-5 py-16 text-center">
      <div className="max-w-lg">
        <h1 className="text-3xl font-bold tracking-tight text-[#15384d]">This page ran into a problem</h1>
        <p className="mt-3 text-sm leading-6 text-[#526b7b]">Your page could not be displayed. Try again, or return to the home page.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="rounded-full bg-[#006f9b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#005b81]">Try again</button>
          <a href="/" className="rounded-full border border-[#cfe2eb] px-5 py-3 text-sm font-semibold text-[#15384d] hover:bg-[#e8f6fb]">Go to home</a>
        </div>
      </div>
    </main>
  )
}
