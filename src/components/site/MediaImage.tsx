import Image from 'next/image'
import type { Media } from '@/payload-types'

type Size = 'thumb' | 'card' | 'hero' | 'og'

/** A CMS image through next/image, using a generated size when one exists. */
export function MediaImage({
  media,
  size,
  sizes,
  preload,
  eager,
  className,
}: {
  media: Media
  size?: Size
  sizes: string
  /** The page's LCP image: preloaded in <head> and fetched with high priority. One per page. */
  preload?: boolean
  /** Load immediately, but without preload or high priority (e.g. later carousel slides). */
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
  // React preloads every non-lazy image unless its priority is "low", so eager images say so.
  const loading = preload
    ? ({ preload: true, fetchPriority: 'high' } as const)
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
