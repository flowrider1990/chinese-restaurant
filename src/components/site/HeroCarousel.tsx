'use client'

import { useRef, useState, type ReactNode } from 'react'

/**
 * Scroll-snap carousel with previous/next buttons. No autoplay; swiping, the buttons and the
 * keyboard (Tab into the list, arrow keys scroll it) all work.
 */
export function HeroCarousel({
  slides,
  labels,
}: {
  slides: { key: string; content: ReactNode }[]
  labels: { region: string; prev: string; next: string; /** e.g. "Bild {n} von {of}" */ slide: string }
}) {
  const list = useRef<HTMLUListElement>(null)
  const slideLabel = (n: number) => labels.slide.replace('{n}', String(n)).replace('{of}', String(slides.length))
  const [index, setIndex] = useState(0)

  const go = (to: number) => {
    const el = list.current
    if (!el) return
    const next = (to + slides.length) % slides.length
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
    setIndex(next)
  }

  return (
    <section className="carousel" aria-roledescription="carousel" aria-label={labels.region}>
      <ul
        ref={list}
        className="carousel__list"
        tabIndex={0}
        onScroll={(e) => {
          const el = e.currentTarget
          setIndex(Math.round(el.scrollLeft / el.clientWidth))
        }}
      >
        {slides.map((s, i) => (
          <li key={s.key} aria-roledescription="slide" aria-label={slideLabel(i + 1)}>
            {s.content}
          </li>
        ))}
      </ul>
      {slides.length > 1 && (
        <div className="carousel__controls">
          <button type="button" className="icon-btn" onClick={() => go(index - 1)} aria-label={labels.prev}>
            ‹
          </button>
          <span aria-live="polite" className="carousel__count">
            {slideLabel(index + 1)}
          </span>
          <button type="button" className="icon-btn" onClick={() => go(index + 1)} aria-label={labels.next}>
            ›
          </button>
        </div>
      )}
    </section>
  )
}
