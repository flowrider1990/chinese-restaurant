'use client'

import { useSyncExternalStore } from 'react'
import { Icon } from './Icon'

type Theme = 'light' | 'dark'

const media = () => window.matchMedia('(prefers-color-scheme: dark)')

/** The theme in effect: the visitor's choice (data-theme), otherwise the device setting. */
function current(): Theme {
  const chosen = document.documentElement.getAttribute('data-theme')
  if (chosen === 'light' || chosen === 'dark') return chosen
  return media().matches ? 'dark' : 'light'
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const mq = media()
  mq.addEventListener('change', onChange)
  return () => {
    observer.disconnect()
    mq.removeEventListener('change', onChange)
  }
}

/** Light/dark switch. The choice is remembered in this browser only. */
export function ThemeToggle({ labels }: { labels: { toDark: string; toLight: string } }) {
  // null during server rendering: the server cannot know the visitor's theme.
  const theme = useSyncExternalStore(subscribe, current, () => null)
  if (!theme) return <span className="icon-btn theme-toggle" aria-hidden="true" />

  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  const label = next === 'dark' ? labels.toDark : labels.toLight
  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => {
        document.documentElement.setAttribute('data-theme', next)
        try {
          localStorage.setItem('theme', next)
        } catch {
          // Storage blocked (private mode): the choice lasts until the page is left.
        }
      }}
    >
      <Icon name={next === 'dark' ? 'moon' : 'sun'} size={18} />
    </button>
  )
}
