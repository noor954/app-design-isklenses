'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Bot, LoaderCircle, MessageCircle, Send, X } from 'lucide-react'

type Settings = { enabled: boolean; welcomeMessage: string }
type LinkItem = { label: string; href: string }
type Message = { id: number; role: 'assistant' | 'shopper'; text: string; links?: LinkItem[] }

export function ChatbotWidget() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(0)

  useEffect(() => {
    let active = true
    fetch('/api/chatbot/settings', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Chat is unavailable right now.')
        if (active) setSettings(body.data as Settings)
      })
      .catch(() => {
        if (active) setSettings({ enabled: false, welcomeMessage: '' })
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (settings?.enabled && messages.length === 0) {
      setMessages([{ id: nextId.current++, role: 'assistant', text: settings.welcomeMessage }])
    }
  }, [messages.length, settings])

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = question.trim()
    if (!text || sending) return
    setMessages((current) => [...current, { id: nextId.current++, role: 'shopper', text }])
    setQuestion('')
    setSending(true)
    setError('')
    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'The assistant could not answer right now.')
      const answer = body.data as { answer: string; links?: LinkItem[] }
      setMessages((current) => [...current, {
        id: nextId.current++,
        role: 'assistant',
        text: answer.answer,
        links: answer.links,
      }])
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'The assistant could not answer right now.')
    } finally {
      setSending(false)
    }
  }

  if (!settings?.enabled) return null

  return (
    <div className="fixed bottom-24 right-4 z-40 sm:bottom-24 sm:right-6" aria-label="ISK Lenses store assistant">
      {open && (
        <section
          role="dialog"
          aria-label="Store assistant"
          className="mb-3 flex h-[min(34rem,calc(100dvh-12rem))] w-[calc(100vw-2rem)] max-w-[24rem] flex-col overflow-hidden rounded-2xl border border-[#cfe2eb] bg-white shadow-[0_16px_48px_rgba(21,56,77,.22)]"
        >
          <header className="flex items-center justify-between gap-3 bg-[#15384d] px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-[#087ba5]"><Bot size={19} aria-hidden="true" /></span>
              <div>
                <h2 className="text-sm font-bold">ISK Lenses assistant</h2>
                <p className="text-xs text-white/75">Store FAQs and published listings</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="grid size-9 place-items-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
              <X size={18} />
            </button>
          </header>
          <div ref={listRef} role="log" aria-live="polite" aria-relevant="additions text" className="flex-1 space-y-3 overflow-y-auto bg-[#f7fcff] p-4">
            {messages.map((message) => (
              <div key={message.id} className={`max-w-[90%] ${message.role === 'shopper' ? 'ml-auto' : ''}`}>
                <p className={`whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${message.role === 'shopper' ? 'rounded-br-sm bg-[#006f9b] text-white' : 'rounded-bl-sm border border-[#cfe2eb] bg-white text-[#15384d]'}`}>
                  {message.text}
                </p>
                {message.links && message.links.length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 px-2">
                    {message.links.map((item) => (
                      <li key={`${message.id}-${item.href}`}>
                        {item.href.startsWith('https://wa.me/') ? (
                          <a href={item.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-full bg-[#087c47] px-3 text-xs font-semibold text-white hover:bg-[#06683b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15384d]">
                            {item.label}
                          </a>
                        ) : (
                          <Link href={item.href} className="text-xs font-semibold text-[#006f9b] underline underline-offset-2 hover:text-[#15384d]">
                            {item.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {sending && <p className="flex items-center gap-2 text-xs text-[#526b7b]"><LoaderCircle size={14} className="animate-spin" /> Checking store information…</p>}
            {error && <p role="alert" className="rounded-lg bg-[#fff0f1] px-3 py-2 text-xs text-[#9b2636]">{error}</p>}
          </div>
          <form onSubmit={(event) => void sendMessage(event)} className="flex items-center gap-2 border-t border-[#cfe2eb] bg-white p-3">
            <label htmlFor="store-chat-question" className="sr-only">Ask about products or store FAQs</label>
            <input
              id="store-chat-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={200}
              placeholder="Ask a store question…"
              disabled={sending}
              className="min-w-0 flex-1 rounded-full border border-[#b8d4e0] px-4 py-2.5 text-sm text-[#15384d] placeholder:text-[#526b7b] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#087ba5] disabled:bg-[#f7fcff]"
            />
            <button type="submit" disabled={sending || !question.trim()} aria-label="Send question" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#006f9b] text-white hover:bg-[#087ba5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087ba5] disabled:cursor-not-allowed disabled:opacity-50">
              <Send size={17} aria-hidden="true" />
            </button>
          </form>
          <p className="px-4 pb-3 text-xs leading-4 text-[#526b7b]">Uses public store information only. Some replies may use an AI service; don’t share personal, order, payment, or health details.</p>
        </section>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'Close store assistant' : 'Open store assistant'}
        className="ml-auto grid size-14 place-items-center rounded-full bg-[#006f9b] text-white shadow-[0_8px_24px_rgba(21,56,77,.24)] transition hover:-translate-y-0.5 hover:bg-[#087ba5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#15384d]"
      >
        {open ? <X size={23} aria-hidden="true" /> : <MessageCircle size={24} aria-hidden="true" />}
      </button>
    </div>
  )
}
