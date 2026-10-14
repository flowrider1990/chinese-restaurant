import Link from 'next/link'
import type { Post } from '@/payload-types'
import { MediaImage } from './MediaImage'

/**
 * A news post as one clickable card: image, date, title, excerpt. The title is the link; it covers
 * the whole card, so the card has a single tab stop and a clear link name.
 */
export function PostCard({
  post,
  href,
  dateLocale,
  headingLevel: H = 'h2',
}: {
  post: Post
  href: string
  dateLocale: string
  headingLevel?: 'h2' | 'h3'
}) {
  const image = typeof post.heroImage === 'object' && post.heroImage ? post.heroImage : null
  const date = post.publishedAt
    ? new Intl.DateTimeFormat(dateLocale, { dateStyle: 'long', timeZone: 'Europe/Berlin' }).format(
        new Date(post.publishedAt),
      )
    : null

  return (
    <article className="post-card">
      {image ? (
        <MediaImage
          media={image}
          size="card"
          sizes="(max-width: 48rem) 100vw, 24rem"
          className="post-card__image"
        />
      ) : (
        <div className="post-card__image post-card__image--empty" aria-hidden="true" />
      )}
      <div className="post-card__body">
        {date && post.publishedAt && <time dateTime={post.publishedAt}>{date}</time>}
        <H className="post-card__title">
          <Link href={href} className="post-card__link">
            {post.title}
          </Link>
        </H>
        {post.excerpt && <p>{post.excerpt}</p>}
      </div>
    </article>
  )
}
