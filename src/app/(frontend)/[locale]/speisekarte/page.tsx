import type { Metadata } from 'next'
import { CategoryNav } from '@/components/site/CategoryNav'
import { Dish } from '@/components/site/Dish'
import { MediaImage } from '@/components/site/MediaImage'
import { MenuFilter } from '@/components/site/MenuFilter'
import { dictionaries } from '@/i18n/dictionary'
import { absolute, jsonLdScript, pageMetadata } from '@/lib/seo'
import { href } from '@/i18n/routes'
import { getLocale, isLocale } from '@/i18n/server'
import { getMenu } from '@/lib/queries'

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/speisekarte'>): Promise<Metadata> {
  const { locale } = await params
  return isLocale(locale)
    ? pageMetadata({ key: 'menu', locale, title: dictionaries[locale].menu.title })
    : {}
}

export default async function MenuPage() {
  const { locale, t } = await getLocale()
  const { sections, legend } = await getMenu(locale)
  const allergens = legend.filter((a) => a.kind === 'allergen')
  const additives = legend.filter((a) => a.kind === 'additive')
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    url: absolute(href('menu', locale)),
    inLanguage: locale,
    hasMenuSection: sections.map((s) => ({
      '@type': 'MenuSection',
      name: s.name,
      ...(s.description && { description: s.description }),
      hasMenuItem: s.items.map((item) => ({
        '@type': 'MenuItem',
        name: item.name,
        ...(item.description && { description: item.description }),
        offers: { '@type': 'Offer', price: (item.price / 100).toFixed(2), priceCurrency: 'EUR' },
      })),
    })),
  }

  return (
    <div className="menu-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      <header className="page-head">
        <h1>{t.menu.title}</h1>
        <p>{t.menu.intro}</p>
      </header>

      {sections.length === 0 ? (
        <p>{t.menu.empty}</p>
      ) : (
        <>
          <div className="menu-tools">
            <CategoryNav
              label={t.menu.categories}
              items={sections.map((s) => ({ href: `#${s.slug}`, label: s.name }))}
              scrollLabels={{ prev: t.menu.scrollPrev, next: t.menu.scrollNext }}
            />
            <MenuFilter
              target="menu"
              label={t.menu.filter}
              options={{
                all: t.menu.filterAll,
                vegetarian: t.menu.filterVegetarian,
                vegan: t.menu.filterVegan,
                spicy: t.menu.filterSpicy,
                mild: t.menu.filterMild,
              }}
              allergens={allergens.map((a) => ({ code: a.code ?? String(a.id), name: a.name }))}
              labels={{
                without: t.menu.filterWithout,
                reset: t.menu.filterReset,
                note: t.menu.filterNote,
              }}
            />
          </div>

          <div id="menu" className="menu">
            {sections.map((s, index) => (
              <section
                key={s.id}
                id={s.slug}
                className="menu-section"
                aria-labelledby={`${s.slug}-title`}
              >
                <h2 id={`${s.slug}-title`}>{s.name}</h2>
                {s.description && <p className="menu-section__note">{s.description}</p>}
                {s.image && (
                  <figure className="menu-section__image">
                    <MediaImage
                      media={s.image}
                      sizes="(max-width: 72rem) 100vw, 72rem"
                      priority={index === 0}
                    />
                    {s.image.caption && <figcaption>{s.image.caption}</figcaption>}
                  </figure>
                )}
                <ul className="dishes">
                  {s.items.map((item) => (
                    <Dish key={item.id} item={item} t={t} />
                  ))}
                </ul>
                <p className="menu-section__empty">{t.menu.filterEmpty}</p>
              </section>
            ))}
          </div>

          {legend.length > 0 && (
            <section className="legend" aria-labelledby="legend-title">
              <h2 id="legend-title">{t.menu.legendTitle}</h2>
              <p>{t.menu.legendNote}</p>
              {/* Names only: dishes list their allergens in full, so letter codes would point nowhere. */}
              <dl className="legend__list">
                {allergens.length > 0 && (
                  <div>
                    <dt>{t.menu.allergens}</dt>
                    <dd>{allergens.map((a) => a.name).join(', ')}</dd>
                  </div>
                )}
                {additives.length > 0 && (
                  <div>
                    <dt>{t.menu.additives}</dt>
                    <dd>{additives.map((a) => a.name).join(', ')}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </>
      )}
    </div>
  )
}
