'use client'

import Link from 'next/link'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

type Props = {
  phoneE164: string
  menuHref: string
  labels: { call: string; menu: string; order: string; close: string }
  /** Order options rendered on the server; the bar only shows them in a panel. */
  orderPanel: ReactNode | null
}

/** Sticky bottom bar on small screens: call, menu, order. */
export function MobileActionBar({ phoneE164, menuHref, labels, orderPanel }: Props) {
  const [open, setOpen] = useState(false)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="action-bar">
      {orderPanel && (
        <div id={id} className="action-bar__panel" hidden={!open}>
          {orderPanel}
          <button type="button" className="action-bar__close" onClick={() => setOpen(false)}>
            {labels.close}
          </button>
        </div>
      )}
      <div className="action-bar__buttons" data-count={orderPanel ? 3 : 2}>
        <a href={`tel:${phoneE164}`}>
          <Icon name="phone" />
          {labels.call}
        </a>
        <Link href={menuHref} className="action-bar__main">
          <Icon name="bowl" />
          {labels.menu}
        </Link>
        {orderPanel && (
          <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
            <Icon name="bag" />
            {labels.order}
          </button>
        )}
      </div>
    </div>
  )
}
