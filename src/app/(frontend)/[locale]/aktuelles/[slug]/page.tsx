import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MediaImage } from '@/components/site/MediaImage'
import { RichText } from '@/components/site/RichText'
import { href } from '@/i18n/routes'
import { getLocale, isLocale } from '@/i18n/server'
import { getPost } from '@/lib/queries'

export async function generateMetadata({ params }: PageProps<'/[locale]/aktuelles/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const post = await getPost(locale, decodeURIComponent(slug))
  return post ? { title: post.title, description: post.excerpt ?? undefined } : {}
}

export default async function PostPage({ params }: PageProps<'/[locale]/aktuelles/[slug]'>) {
  const { locale, t } = await getLocale()
  const { slug } = await params
  const post = await getPost(locale, decodeURIComponent(slug))
  if (!post) notFound()
  const dateFormat = new Intl.DateTimeFormat(t.dateLocale, { dateStyle: 'long', timeZone: 'Europe/Berlin' })

  return (
    <article className="post">
      <header className="page-head">
        <Link href={href('news', locale)} className="post__back">
          {t.news.back}
        </Link>
        <h1>{post.title}</h1>
        {post.publishedAt && <time dateTime={post.publishedAt}>{dateFormat.format(new Date(post.publishedAt))}</time>}
      </header>
      {typeof post.heroImage === 'object' && post.heroImage && (
        <MediaImage media={post.heroImage} size="hero" sizes="(max-width: 72rem) 100vw, 72rem" priority className="post__image" />
      )}
      <RichText data={post.content} />
    </article>
  )
}
