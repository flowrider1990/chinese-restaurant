import type { Metadata } from 'next'
import Link from 'next/link'
import { PostCard } from '@/components/site/PostCard'
import { dictionaries } from '@/i18n/dictionary'
import { pageMetadata } from '@/lib/seo'
import { href } from '@/i18n/routes'
import { getLocale, isLocale } from '@/i18n/server'
import { getPosts } from '@/lib/queries'

export async function generateMetadata({ params }: PageProps<'/[locale]/aktuelles'>): Promise<Metadata> {
  const { locale } = await params
  return isLocale(locale)
    ? pageMetadata({
        key: 'news',
        locale,
        title: dictionaries[locale].news.title,
        description: dictionaries[locale].seo.description.news,
      })
    : {}
}

export default async function NewsPage({ searchParams }: PageProps<'/[locale]/aktuelles'>) {
  const { locale, t } = await getLocale()
  const raw = (await searchParams).page
  const page = Math.max(1, Number.parseInt(typeof raw === 'string' ? raw : '1', 10) || 1)
  const posts = await getPosts(locale, page)
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
              <PostCard post={post} href={href('news', locale, post.slug ?? '')} dateLocale={t.dateLocale} />
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
