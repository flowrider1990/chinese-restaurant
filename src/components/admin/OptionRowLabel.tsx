'use client'

import { useRowLabel } from '@payloadcms/ui'
import { formatPrice } from '@/lib/price'

type OptionRow = { label?: string | null; priceDelta?: number | null }

/** Shows "Rind (+2,00 €)" instead of "Option 01" in the collapsed options list. */
export const OptionRowLabel = () => {
  const { data, rowNumber } = useRowLabel<OptionRow>()
  const label = data?.label?.trim() || `Option ${String((rowNumber ?? 0) + 1).padStart(2, '0')}`
  const delta = data?.priceDelta
  if (typeof delta !== 'number' || delta === 0) return <span>{label}</span>
  return (
    <span>
      {label} ({delta > 0 ? '+' : '−'}
      {formatPrice(Math.abs(delta))})
    </span>
  )
}
