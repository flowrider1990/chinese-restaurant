'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * Scroll-snap carousel that loops endlessly. Arrows and dots sit on the image; no autoplay.
 * Swiping, the buttons and the keyboard (Tab into the list, arrow keys scroll it) all work.
 *
 * The loop: a copy of the last slide sits before the first and a copy of the first after the
 * last. Once scrolling stops on a copy, the list jumps without animation to the real slide, so
 * "next" on the last slide moves on to the first instead of rewinding. Without JavaScript the
 * copies are not rendered and the list is a plain scroll-snap row.
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
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined)
  const slideLabel = (n: number) =>
    labels.slide.replace('{n}', String(n)).replace('{of}', String(slides.length))
  const n = slides.length
  const [index, setIndex] = useState(0)
  // The copies are added after hydration, together with the scroll offset that hides the first one.
  const [looping, setLooping] = useState(false)

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- must run before paint, see below
    if (n > 1) setLooping(true)
  }, [n])
  useLayoutEffect(() => {
    // Runs before paint, so the copy of the last slide is never visible on load.
    const el = list.current
    if (looping && el) el.scrollTo({ left: el.clientWidth, behavior: 'instant' })
  }, [looping])

  /** Position in the list including the copies: 0 = copy of the last slide, 1 = first slide. */
  const position = (el: HTMLElement) => Math.round(el.scrollLeft / el.clientWidth)

  const scrollToPosition = (to: number) => {
    const el = list.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: to * el.clientWidth, behavior: reduce ? 'instant' : 'smooth' })
  }

  const onScroll = (el: HTMLElement) => {
    if (!looping) {
      setIndex(position(el))
      return
    }
    const p = position(el)
    setIndex((p - 1 + n) % n)
    // When scrolling has come to rest on a copy, swap in the real slide.
    clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      const at = position(el)
      if (at === 0) el.scrollTo({ left: n * el.clientWidth, behavior: 'instant' })
      if (at === n + 1) el.scrollTo({ left: el.clientWidth, behavior: 'instant' })
    }, 120)
  }

  const step = (by: number) => {
    const el = list.current
    if (!el) return
    if (looping) scrollToPosition(position(el) + by)
    else scrollToPosition((index + by + n) % n)
  }
  const goTo = (i: number) => scrollToPosition(looping ? i + 1 : i)

  const copy = (s: (typeof slides)[number], where: string) => (
    <li key={`${s.key}-${where}`} aria-hidden="true" inert>
      {s.content}
    </li>
  )

  return (
    <section className="carousel" aria-roledescription="carousel" aria-label={labels.region}>
      <ul
        ref={list}
        className="carousel__list"
        tabIndex={0}
        onScroll={(e) => onScroll(e.currentTarget)}
      >
        {looping && copy(slides[n - 1], 'before')}
        {slides.map((s, i) => (
          <li key={s.key} aria-roledescription="slide" aria-label={slideLabel(i + 1)}>
            {s.content}
          </li>
        ))}
        {looping && copy(slides[0], 'after')}
      </ul>
      {slides.length > 1 && (
        <>
          <button
            type="button"
            className="carousel__arrow carousel__arrow--prev"
            onClick={() => step(-1)}
            aria-label={labels.prev}
          >
            <Icon name="chevronLeft" size={34} />
          </button>
          <button
            type="button"
            className="carousel__arrow carousel__arrow--next"
            onClick={() => step(1)}
            aria-label={labels.next}
          >
            <Icon name="chevronRight" size={34} />
          </button>
          <div className="carousel__dots">
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                aria-label={slideLabel(i + 1)}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => goTo(i)}
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
