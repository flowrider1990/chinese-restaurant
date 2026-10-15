import type { Metadata } from 'next'
import Link from 'next/link'
import { Dish } from '@/components/site/Dish'
import { HeroCarousel } from '@/components/site/HeroCarousel'
import { MediaImage } from '@/components/site/MediaImage'
import { OpenStatus } from '@/components/site/OpenStatus'
import { OrderOptions } from '@/components/site/OrderOptions'
import { PostCard } from '@/components/site/PostCard'
import { RichText } from '@/components/site/RichText'
import { VisitInfo } from '@/components/site/VisitInfo'
import { dictionaries } from '@/i18n/dictionary'
import { href } from '@/i18n/routes'
import { getLocale, isLocale } from '@/i18n/server'
import { getHome, getPosts, getReservationLink, getRestaurantInfo } from '@/lib/queries'
import { jsonLdScript, pageMetadata, restaurantJsonLd } from '@/lib/seo'

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const { seo } = dictionaries[locale]
  const info = await getRestaurantInfo(locale)
  return pageMetadata({
    key: 'home',
    locale,
    absoluteTitle: `${info.name} – ${seo.homeTitle}`,
    description: seo.description.home,
  })
}

export default async function HomePage() {
  const { locale, t } = await getLocale()
  const [info, home, posts, reserve] = await Promise.all([
    getRestaurantInfo(locale),
    getHome(locale),
    getPosts(locale, 1, 1),
    getReservationLink(locale),
  ])
  const latest = posts.docs[0]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(restaurantJsonLd(info, locale, reserve))}
      />
      <section className="hero">
        <div className="hero__text">
          <h1>{info.tagline ?? info.name}</h1>
          <OpenStatus hours={info.hours} locale={locale} />
          <div className="hero__actions">
            <Link className="btn btn--primary" href={href('menu', locale)}>
              {t.nav.menu}
            </Link>
            {reserve &&
              (reserve.external ? (
                <a
                  className="btn btn--outline"
                  href={reserve.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.reserve.cta}
                  <span className="visually-hidden"> {t.externalLink}</span>
                </a>
              ) : (
                <Link className="btn btn--outline" href={reserve.href}>
                  {t.reserve.cta}
                </Link>
              ))}
            <a className="btn btn--outline hero__call" href={`tel:${info.phoneE164}`}>
              {t.call}
            </a>
          </div>
          {info.orderLinks.length > 0 && <OrderOptions links={info.orderLinks} t={t} />}
        </div>
        {home.slides.length > 0 ? (
          <HeroCarousel
            labels={{ region: info.name, ...t.carousel }}
            slides={home.slides.map((s, i) => {
              const slide = (loading: 'lcp' | 'eager' | 'lazy') => (
                <figure className="hero__figure">
                  <MediaImage
                    media={s.image}
                    size="hero"
                    sizes="(max-width: 48rem) 100vw, 50vw"
                    lcp={loading === 'lcp'}
                    eager={loading === 'eager'}
                  />
                  {(s.caption || s.image.caption) && (
                    <figcaption>{s.caption ?? s.image.caption}</figcaption>
                  )}
                </figure>
              )
              const last = i === home.slides.length - 1
              return {
                key: s.id ?? String(i),
                // Only the first slide is the LCP image; the others load right away, without priority.
                content: slide(i === 0 ? 'lcp' : 'eager'),
                // The loop's copies of the first and last slide: no priority, loaded lazily.
                ...((i === 0 || last) && { copy: slide('lazy') }),
              }
            })}
          />
        ) : (
          <div className="hero__media" aria-hidden="true" />
        )}
      </section>

      <section className="band" aria-label={t.openingHours}>
        <VisitInfo info={info} t={t} />
        <Link href={href('restaurant', locale)}>{t.home.directions}</Link>
      </section>

      {home.highlights.length > 0 && (
        <section className="section" aria-labelledby="highlights">
          <h2 id="highlights" className="section__title">
            {t.home.highlights}
          </h2>
          <ul className="dishes">
            {home.highlights.map((item) => (
              <Dish key={item.id} item={item} t={t} />
            ))}
          </ul>
          <Link className="btn btn--outline" href={href('menu', locale)}>
            {t.home.fullMenu}
          </Link>
        </section>
      )}

      {home.intro && (
        <section className="section section--split">
          <RichText data={home.intro} className="lead-text" />
          <Link href={href('restaurant', locale)}>{t.home.aboutLink}</Link>
        </section>
      )}

      {latest && (
        <section className="section" aria-labelledby="latest">
          <h2 id="latest" className="section__title">
            {t.home.latestPost}
          </h2>
          <PostCard
            post={latest}
            href={href('news', locale, latest.slug ?? '')}
            dateLocale={t.dateLocale}
            headingLevel="h3"
          />
        </section>
      )}
    </>
  )
}
