'use client'

import { useEffect, useState } from 'react'
import { getStatus, type Hours, type Status } from '@/lib/opening-hours'
import type { Locale } from '@/i18n/locales'
import { dictionaries } from '@/i18n/dictionary'

/**
 * "Open until 15:00" / "Closed, opens …". Computed in the browser so cached pages never show a
 * stale status; renders nothing until mounted.
 */
export function OpenStatus({ hours, locale }: { hours: Hours; locale: Locale }) {
  const [status, setStatus] = useState<Status | null>(null)

  useEffect(() => {
    const update = () => setStatus(getStatus(hours))
    update()
    const timer = setInterval(update, 60_000)
    return () => clearInterval(timer)
  }, [hours])

  if (!status) return <p className="open-status" aria-hidden="true" />
  const t = dictionaries[locale]
  const text = status.open
    ? t.openUntil(status.closesAt)
    : !status.opensAt
      ? t.closed
      : status.opensAt.today
        ? t.opensToday(status.opensAt.time)
        : t.opensOn(t.daysLong[status.opensAt.day], status.opensAt.time)

  return (
    <p className="open-status" data-open={status.open}>
      {text}
    </p>
  )
}
