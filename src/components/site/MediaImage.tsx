import Image from 'next/image'
import type { Media } from '@/payload-types'

type Size = 'thumb' | 'card' | 'hero' | 'og'

/** A CMS image through next/image, using a generated size when one exists. */
export function MediaImage({
  media,
  size,
  sizes,
  priority,
  eager,
  className,
}: {
  media: Media
  size?: Size
  sizes: string
  priority?: boolean
  /** Load immediately without preload priority (e.g. later carousel slides). */
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

  return (
    <Image
      className={className}
      src={src}
      alt={media.alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      loading={priority ? undefined : eager ? 'eager' : undefined}
      style={position ? { objectPosition: position } : undefined}
    />
  )
}
