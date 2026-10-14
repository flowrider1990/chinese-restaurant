import type { Metadata } from 'next'
import { MapConsent } from '@/components/site/MapConsent'
import { MediaImage } from '@/components/site/MediaImage'
import { RichText } from '@/components/site/RichText'
import { VisitInfo } from '@/components/site/VisitInfo'
import { dictionaries } from '@/i18n/dictionary'
import { getLocale, isLocale } from '@/i18n/server'
import type { Media } from '@/payload-types'
import { getAbout, getRestaurantInfo } from '@/lib/queries'

export async function generateMetadata({ params }: PageProps<'/[locale]/restaurant'>): Promise<Metadata> {
  const { locale } = await params
  return isLocale(locale) ? { title: dictionaries[locale].restaurant.title } : {}
}

const isMedia = (m: unknown): m is Media => typeof m === 'object' && m !== null

export default async function RestaurantPage() {
  const { locale, t } = await getLocale()
  const [info, about] = await Promise.all([getRestaurantInfo(locale), getAbout(locale)])
  const gallery = (about.gallery ?? []).map((g) => g.image).filter(isMedia)
  const team = (about.team ?? []).filter((m) => m.name || isMedia(m.image))
  // Coordinates are the most precise map query; the address is the fallback.
  const query = info.geo
    ? `${info.geo[1]},${info.geo[0]}`
    : `${info.address.street}, ${info.address.postalCode} ${info.address.city}`
  const mapsUrl = info.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
  const today = new Date().toISOString().slice(0, 10)
  const dateFormat = new Intl.DateTimeFormat(t.dateLocale, { dateStyle: 'medium', timeZone: 'Europe/Berlin' })
  const upcoming = (info.hours.exceptions ?? []).filter((e) => (e.to ?? e.from).slice(0, 10) >= today)

  return (
    <div className="restaurant-page">
      <header className="page-head">
        <h1>
          {info.name}
          {info.nameNative && (
            <span className="page-head__native" lang="zh">
              {' '}
              {info.nameNative}
            </span>
          )}
        </h1>
        {info.tagline && <p>{info.tagline}</p>}
      </header>

      {about.intro && <RichText data={about.intro} className="section lead-text" />}

      {gallery.length > 0 && (
        <section className="section" aria-labelledby="gallery">
          <h2 id="gallery" className="section__title">
            {t.restaurant.gallery}
          </h2>
          <ul className="gallery">
            {gallery.map((m) => (
              <li key={m.id}>
                <MediaImage media={m} size="card" sizes="(max-width: 48rem) 100vw, 33vw" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {team.length > 0 && (
        <section className="section" aria-labelledby="team">
          <h2 id="team" className="section__title">
            {t.restaurant.team}
          </h2>
          <ul className="team">
            {team.map((m) => (
              <li key={m.id ?? m.name}>
                {isMedia(m.image) && <MediaImage media={m.image} size="thumb" sizes="12rem" />}
                {m.name && <p className="team__name">{m.name}</p>}
                {m.role && <p>{m.role}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section" aria-labelledby="visit">
        <h2 id="visit" className="section__title">
          {t.restaurant.visit}
        </h2>
        <VisitInfo info={info} t={t} headingLevel="h3" />
        {upcoming.length > 0 && (
          <div className="exceptions">
            <h3>{t.restaurant.exceptions}</h3>
            <ul>
              {upcoming.map((e, i) => (
                <li key={i}>
                  {dateFormat.format(new Date(e.from))}
                  {e.to && ` – ${dateFormat.format(new Date(e.to))}`}:{' '}
                  {e.closed ? t.restaurant.closed : e.slots?.map((s) => `${s.open}–${s.close}`).join(', ')}
                  {e.note && ` (${e.note})`}
                </li>
              ))}
            </ul>
          </div>
        )}
        <MapConsent
          query={query}
          mapsUrl={mapsUrl}
          labels={{ ...t.map, external: t.externalLink }}
        />
      </section>
    </div>
  )
}
