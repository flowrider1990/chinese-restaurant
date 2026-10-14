'use client'

import { useRef, useState, type ReactNode } from 'react'

/**
 * Scroll-snap carousel. Arrows and dots sit on the image; no autoplay. Swiping, the buttons and the
 * keyboard (Tab into the list, arrow keys scroll it) all work.
 */
export function HeroCarousel({
  slides,
  labels,
}: {
  slides: { key: string; content: ReactNode }[]
  labels: {
    region: string
    prev: string
    next: string
    /** e.g. "Bild {n} von {of}" */ slide: string
  }
}) {
  const list = useRef<HTMLUListElement>(null)
  const slideLabel = (n: number) =>
    labels.slide.replace('{n}', String(n)).replace('{of}', String(slides.length))
  const [index, setIndex] = useState(0)

  const go = (to: number) => {
    const el = list.current
    if (!el) return
    const next = (to + slides.length) % slides.length
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: next * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
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
        <>
          <button
            type="button"
            className="carousel__arrow carousel__arrow--prev"
            onClick={() => go(index - 1)}
            aria-label={labels.prev}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            className="carousel__arrow carousel__arrow--next"
            onClick={() => go(index + 1)}
            aria-label={labels.next}
          >
            <span aria-hidden="true">›</span>
          </button>
          <div className="carousel__dots">
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                aria-label={slideLabel(i + 1)}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <p className="visually-hidden" aria-live="polite">
            {slideLabel(index + 1)}
          </p>
        </>
      )}
    </section>
  )
}
