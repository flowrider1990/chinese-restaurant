import type { Metadata } from 'next'
import Link from 'next/link'
import { MediaImage } from '@/components/site/MediaImage'
import { dictionaries } from '@/i18n/dictionary'
import { pageMetadata } from '@/lib/seo'
import { href } from '@/i18n/routes'
import { getLocale, isLocale } from '@/i18n/server'
import { getPosts } from '@/lib/queries'

export async function generateMetadata({ params }: PageProps<'/[locale]/aktuelles'>): Promise<Metadata> {
  const { locale } = await params
  return isLocale(locale) ? pageMetadata({ key: 'news', locale, title: dictionaries[locale].news.title }) : {}
}

export default async function NewsPage({ searchParams }: PageProps<'/[locale]/aktuelles'>) {
  const { locale, t } = await getLocale()
  const raw = (await searchParams).page
  const page = Math.max(1, Number.parseInt(typeof raw === 'string' ? raw : '1', 10) || 1)
  const posts = await getPosts(locale, page)
  const dateFormat = new Intl.DateTimeFormat(t.dateLocale, { dateStyle: 'long', timeZone: 'Europe/Berlin' })
  const base = href('news', locale)

  return (
    <div className="news-page">
      <header className="page-head">
        <h1>{t.news.title}</h1>
      </header>
      {posts.docs.length === 0 ? (
        <p>{t.news.empty}</p>
      ) : (
        <ul className="post-list">
          {posts.docs.map((post) => (
            <li key={post.id}>
              <article className="post-card">
                {typeof post.heroImage === 'object' && post.heroImage && (
                  <MediaImage media={post.heroImage} size="card" sizes="(max-width: 48rem) 100vw, 20rem" />
                )}
                <div>
                  {post.publishedAt && (
                    <time dateTime={post.publishedAt}>{dateFormat.format(new Date(post.publishedAt))}</time>
                  )}
                  <h2>
                    <Link href={href('news', locale, post.slug ?? '')}>{post.title}</Link>
                  </h2>
                  {post.excerpt && <p>{post.excerpt}</p>}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
      {posts.totalPages > 1 && (
        <nav className="pagination" aria-label={t.news.page(posts.page ?? 1, posts.totalPages)}>
          {posts.hasPrevPage && <Link href={`${base}?page=${posts.prevPage}`}>{t.news.newer}</Link>}
          <span>{t.news.page(posts.page ?? 1, posts.totalPages)}</span>
          {posts.hasNextPage && <Link href={`${base}?page=${posts.nextPage}`}>{t.news.older}</Link>}
        </nav>
      )}
    </div>
  )
}
