'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

const noop = () => () => {}

type Filter = 'all' | 'vegetarian' | 'vegan' | 'spicy' | 'mild'

const matches: Record<Filter, (dish: HTMLElement) => boolean> = {
  all: () => true,
  vegetarian: (d) => d.hasAttribute('data-vegetarian'),
  vegan: (d) => d.hasAttribute('data-vegan'),
  spicy: (d) => d.hasAttribute('data-spicy'),
  mild: (d) => !d.hasAttribute('data-spicy'),
}

/**
 * Menu filters: one dietary choice plus any number of allergens to leave out. Marks non-matching
 * dishes with data-hidden and sections without visible dishes with data-empty; CSS does the rest.
 * Without JavaScript the full menu stays visible and the filters are not shown.
 */
export function MenuFilter({
  target,
  label,
  options,
  allergens,
  labels,
}: {
  target: string
  label: string
  options: Record<Filter, string>
  /** Allergens that appear on the menu: id (as in data-allergens) and full name. */
  allergens: { code: string; name: string }[]
  labels: { without: string; reset: string; note: string }
}) {
  // False during server rendering, true in the browser.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )
  const [filter, setFilter] = useState<Filter>('all')
  const [excluded, setExcluded] = useState<string[]>([])

  useEffect(() => {
    const menu = document.getElementById(target)
    if (!menu) return
    for (const dish of menu.querySelectorAll<HTMLElement>('.dish')) {
      const codes = (dish.dataset.allergens ?? '').split(' ').filter(Boolean)
      const visible = matches[filter](dish) && !codes.some((c) => excluded.includes(c))
      dish.toggleAttribute('data-hidden', !visible)
    }
    for (const section of menu.querySelectorAll<HTMLElement>('.menu-section')) {
      section.toggleAttribute('data-empty', !section.querySelector('.dish:not([data-hidden])'))
    }
  }, [filter, excluded, target])

  if (!mounted) return null
  const toggle = (code: string) =>
    setExcluded((list) => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code]))

  return (
    <div className="menu-filters">
      <div className="menu-filter" role="group" aria-label={label}>
        <span className="menu-filter__label" aria-hidden="true">
          {label}:
        </span>
        {(Object.keys(options) as Filter[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {options[key]}
          </button>
        ))}
      </div>
      {allergens.length > 0 && (
        // Uncontrolled: the panel stays open while the visitor un-toggles or resets.
        <details className="menu-filter menu-filter--allergens">
          <summary>
            {labels.without}
            {excluded.length > 0 && ` (${excluded.length})`}
          </summary>
          <div className="menu-filter__options" role="group" aria-label={labels.without}>
            {allergens.map((a) => (
              <button
                key={a.code}
                type="button"
                aria-pressed={excluded.includes(a.code)}
                onClick={() => toggle(a.code)}
              >
                {a.name}
              </button>
            ))}
            {excluded.length > 0 && (
              <button type="button" className="menu-filter__reset" onClick={() => setExcluded([])}>
                {labels.reset}
              </button>
            )}
          </div>
          <p className="menu-filter__note">{labels.note}</p>
        </details>
      )}
    </div>
  )
}
