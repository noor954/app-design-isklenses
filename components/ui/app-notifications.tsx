'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { SWRConfig } from 'swr'
import type { AppNotification } from '@/lib/ui/notifications'
import { notify, reportError, subscribeNotifications } from '@/lib/ui/notifications'

const autoDismissMs = 5000

function NotificationStack() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const timeoutIds = useRef(new Map<string, number>())

  useEffect(() => {
    const remove = (id: string) => setNotifications((current) => current.filter((item) => item.id !== id))
    const add = (notification: AppNotification) => {
      setNotifications((current) => current.some((item) => item.level === notification.level && item.message === notification.message)
        ? current
        : [...current.slice(-3), notification])
      if (notification.level !== 'error') {
        const timeoutId = window.setTimeout(() => {
          timeoutIds.current.delete(notification.id)
          remove(notification.id)
        }, autoDismissMs)
        timeoutIds.current.set(notification.id, timeoutId)
      }
    }
    const onWindowError = (event: ErrorEvent) => {
      const error = event.error ?? new Error(event.message || 'An unknown browser runtime error occurred.')
      reportError(error, 'Something went wrong. Please try again.', {
        phase: 'runtime',
        filename: event.filename || undefined,
        line: event.lineno || undefined,
        column: event.colno || undefined,
      })
    }
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportError(event.reason, 'A request could not be completed. Please try again.', { phase: 'runtime' })
    }
    const unsubscribe = subscribeNotifications(add)
    window.addEventListener('error', onWindowError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => {
      timeoutIds.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
      timeoutIds.current.clear()
      unsubscribe()
      window.removeEventListener('error', onWindowError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  function dismiss(id: string) {
    const timeoutId = timeoutIds.current.get(id)
    if (timeoutId) window.clearTimeout(timeoutId)
    timeoutIds.current.delete(id)
    setNotifications((current) => current.filter((item) => item.id !== id))
  }

  if (!notifications.length) return null
  return (
    <div role="region" aria-label="Notifications" className="fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:w-[min(26rem,calc(100vw-2rem))]">
      {notifications.map((item) => {
        const Icon = item.level === 'error' ? AlertCircle : item.level === 'warning' ? AlertTriangle : Info
        const styles = item.level === 'error'
          ? 'border-[#b4233e]/30 bg-white text-[#74232e]'
          : item.level === 'warning'
            ? 'border-[#a15c00]/30 bg-[#fffbeb] text-[#713f12]'
            : 'border-[#087ba5]/25 bg-white text-[#15384d]'
        return (
          <div
            key={item.id}
            role={item.level === 'error' ? 'alert' : 'status'}
            aria-live={item.level === 'error' ? 'assertive' : 'polite'}
            className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${styles}`}
          >
            <Icon size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm leading-5 [overflow-wrap:anywhere]">{item.message}</p>
            <button type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss notification" className="grid size-7 shrink-0 place-items-center rounded-full hover:bg-black/5">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function AppNotifications({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ onError: (error) => reportError(error, 'Unable to load this information. Try again.') }}>
      <NotificationStack />
      {children}
    </SWRConfig>
  )
}

export function RuntimeErrorNotice({ message }: { message?: string }) {
  useEffect(() => {
    if (message) notify('error', message)
  }, [message])
  return null
}
