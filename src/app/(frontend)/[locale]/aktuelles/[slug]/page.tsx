import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { MediaImage } from '@/components/site/MediaImage'
import { RichText } from '@/components/site/RichText'
import { href } from '@/i18n/routes'
import { getLocale, isLocale } from '@/i18n/server'
import { getPost, getRestaurantInfo } from '@/lib/queries'
import { absolute, jsonLdScript, pageMetadata } from '@/lib/seo'

export async function generateMetadata({ params }: PageProps<'/[locale]/aktuelles/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const found = await getPost(locale, decodeURIComponent(slug))
  if (!found) return {}
  const { post, slugs } = found
  const image = typeof post.heroImage === 'object' && post.heroImage ? (post.heroImage.sizes?.og?.url ?? post.heroImage.url) : null
  return pageMetadata({ key: 'news', locale, rest: slugs, title: post.title, description: post.excerpt, image, type: 'article' })
}

export default async function PostPage({ params }: PageProps<'/[locale]/aktuelles/[slug]'>) {
  const { locale, t } = await getLocale()
  const { slug } = await params
  const found = await getPost(locale, decodeURIComponent(slug))
  if (!found) notFound()
  const { post, slugs } = found
  // A slug from another language (e.g. after switching language) leads to this language's URL.
  if (slugs[locale] && slugs[locale] !== decodeURIComponent(slug)) permanentRedirect(href('news', locale, slugs[locale]))

  const info = await getRestaurantInfo(locale)
  const dateFormat = new Intl.DateTimeFormat(t.dateLocale, { dateStyle: 'long', timeZone: 'Europe/Berlin' })
  const hero = typeof post.heroImage === 'object' && post.heroImage ? post.heroImage : null
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post.title,
    ...(post.excerpt && { description: post.excerpt }),
    ...(post.publishedAt && { datePublished: post.publishedAt }),
    dateModified: post.updatedAt,
    ...(hero?.url && { image: absolute(hero.url) }),
    inLanguage: locale,
    mainEntityOfPage: absolute(href('news', locale, slugs[locale])),
    publisher: { '@type': 'Restaurant', name: info.name, '@id': `${absolute('/')}/#restaurant` },
  }

  return (
    <article className="post">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      <header className="page-head">
        <Link href={href('news', locale)} className="post__back">
          {t.news.back}
        </Link>
        <h1>{post.title}</h1>
        {post.publishedAt && <time dateTime={post.publishedAt}>{dateFormat.format(new Date(post.publishedAt))}</time>}
      </header>
      {hero && <MediaImage media={hero} size="hero" sizes="(max-width: 72rem) 100vw, 72rem" priority className="post__image" />}
      <RichText data={post.content} />
    </article>
  )
}
