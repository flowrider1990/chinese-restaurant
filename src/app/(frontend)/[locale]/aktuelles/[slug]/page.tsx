import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { LanguageAlternates } from '@/components/site/LanguageSwitch'
import { MediaImage } from '@/components/site/MediaImage'
import { RichText } from '@/components/site/RichText'
import { href } from '@/i18n/routes'
import { getLocale, isLocale } from '@/i18n/server'
import { getPost, getRestaurantInfo, payloadClient } from '@/lib/queries'
import { jsonLdScript, newsArticleJsonLd, pageMetadata } from '@/lib/seo'

/**
 * Published posts are rendered at build time, so their metadata is in <head> instead of being
 * streamed into <body>. Posts published later render on their first visit (dynamicParams stays
 * true); every save of a post refreshes the site (src/lib/revalidate.ts).
 */
export async function generateStaticParams({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) return []
  const payload = await payloadClient()
  const posts = await payload.find({
    collection: 'posts',
    locale: params.locale,
    pagination: false,
    depth: 0,
    draft: false,
    overrideAccess: false,
    select: { slug: true },
  })
  return posts.docs.filter((p) => p.slug).map((p) => ({ slug: p.slug as string }))
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/aktuelles/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const found = await getPost(locale, decodeURIComponent(slug))
  if (!found) return {}
  const { post, slugs } = found
  const image =
    typeof post.heroImage === 'object' && post.heroImage
      ? (post.heroImage.sizes?.og?.url ?? post.heroImage.url)
      : null
  return pageMetadata({
    key: 'news',
    locale,
    rest: slugs,
    title: post.title,
    description: post.excerpt,
    image,
    type: 'article',
    publishedTime: post.publishedAt,
  })
}

export default async function PostPage({ params }: PageProps<'/[locale]/aktuelles/[slug]'>) {
  const { locale, t } = await getLocale()
  const { slug } = await params
  const found = await getPost(locale, decodeURIComponent(slug))
  if (!found) notFound()
  const { post, slugs } = found
  // A slug from another language (e.g. after switching language) leads to this language's URL.
  if (slugs[locale] && slugs[locale] !== decodeURIComponent(slug))
    permanentRedirect(href('news', locale, slugs[locale]))

  const info = await getRestaurantInfo(locale)
  const dateFormat = new Intl.DateTimeFormat(t.dateLocale, {
    dateStyle: 'long',
    timeZone: 'Europe/Berlin',
  })
  const hero = typeof post.heroImage === 'object' && post.heroImage ? post.heroImage : null
  const jsonLd = newsArticleJsonLd(info, locale, {
    title: post.title,
    slug: slugs[locale],
    excerpt: post.excerpt,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    imageUrl: hero?.url,
  })

  return (
    <article className="post">
      <LanguageAlternates
        paths={Object.fromEntries(
          Object.entries(slugs).map(([l, s]) => [l, href('news', l as typeof locale, s)]),
        )}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      <header className="page-head">
        <Link href={href('news', locale)} className="post__back">
          {t.news.back}
        </Link>
        <h1>{post.title}</h1>
        {post.publishedAt && (
          <time dateTime={post.publishedAt}>{dateFormat.format(new Date(post.publishedAt))}</time>
        )}
      </header>
      {hero && (
        <MediaImage
          media={hero}
          size="hero"
          sizes="(max-width: 72rem) calc(100vw - 2rem), 68rem"
          preload
          className="post__image"
        />
      )}
      <RichText data={post.content} />
    </article>
  )
}
