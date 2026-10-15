import Image from 'next/image'
import type { Media } from '@/payload-types'

type Size = 'thumb' | 'card' | 'hero' | 'og'

/** A CMS image through next/image, using a generated size when one exists. */
export function MediaImage({
  media,
  size,
  sizes,
  lcp,
  eager,
  className,
}: {
  media: Media
  size?: Size
  sizes: string
  /** The page's LCP image: loaded at once with high priority. At most one per page. */
  lcp?: boolean
  /** Load immediately, but without high priority or preload (e.g. later carousel slides). */
  eager?: boolean
  className?: string
}) {
  const variant = size ? media.sizes?.[size] : undefined
  const src = variant?.url ?? media.url
  const width = variant?.width ?? media.width
  const height = variant?.height ?? media.height
  if (!src || !width || !height) return null
  const position =
    media.focalX != null && media.focalY != null ? `${media.focalX}% ${media.focalY}%` : undefined
  // The documented API (image.md: "loading=eager or fetchPriority=high instead of preload"). React
  // adds a <link rel="preload"> to <head> for every non-lazy image unless its priority is "low":
  // so the LCP image gets exactly one (with fetchpriority=high), other eager images none.
  const loading = lcp
    ? ({ loading: 'eager', fetchPriority: 'high' } as const)
    : eager
      ? ({ loading: 'eager', fetchPriority: 'low' } as const)
      : {}

  return (
    <Image
      className={className}
      src={src}
      alt={media.alt}
      width={width}
      height={height}
      sizes={sizes}
      {...loading}
      style={position ? { objectPosition: position } : undefined}
    />
  )
}
