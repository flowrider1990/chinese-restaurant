'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

const noop = () => () => {}

type Filter = 'all' | 'vegetarian' | 'vegan' | 'spicy' | 'mild'

/**
 * Dietary filter. Sets data-filter on the menu element; CSS hides non-matching dishes. Without
 * JavaScript the full menu stays visible and the filter is not shown.
 */
export function MenuFilter({
  target,
  label,
  options,
}: {
  target: string
  label: string
  options: Record<Filter, string>
}) {
  // False during server rendering, true in the browser: the filter only appears with JavaScript.
  const mounted = useSyncExternalStore(noop, () => true, () => false)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    const el = document.getElementById(target)
    if (!el) return
    if (filter === 'all') el.removeAttribute('data-filter')
    else el.setAttribute('data-filter', filter)
  }, [filter, target])

  if (!mounted) return null
  return (
    <div className="menu-filter" role="group" aria-label={label}>
      <span className="menu-filter__label" aria-hidden="true">
        {label}:
      </span>
      {(Object.keys(options) as Filter[]).map((key) => (
        <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
          {options[key]}
        </button>
      ))}
    </div>
  )
}
