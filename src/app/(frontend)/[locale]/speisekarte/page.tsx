import type { Metadata } from 'next'
import { CategoryNav } from '@/components/site/CategoryNav'
import { Dish } from '@/components/site/Dish'
import { MenuFilter } from '@/components/site/MenuFilter'
import { dictionaries } from '@/i18n/dictionary'
import { getLocale, isLocale } from '@/i18n/server'
import { getMenu } from '@/lib/queries'

export async function generateMetadata({ params }: PageProps<'/[locale]/speisekarte'>): Promise<Metadata> {
  const { locale } = await params
  return isLocale(locale) ? { title: dictionaries[locale].menu.title } : {}
}

export default async function MenuPage() {
  const { locale, t } = await getLocale()
  const { sections, legend } = await getMenu(locale)
  const allergens = legend.filter((a) => a.kind === 'allergen')
  const additives = legend.filter((a) => a.kind === 'additive')

  return (
    <div className="menu-page">
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
                mild: t.menu.filterMild,
              }}
            />
          </div>

          <div id="menu" className="menu">
            {sections.map((s) => (
              <section key={s.id} id={s.slug} className="menu-section" aria-labelledby={`${s.slug}-title`}>
                <h2 id={`${s.slug}-title`}>{s.name}</h2>
                {s.description && <p className="menu-section__note">{s.description}</p>}
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
              <div className="legend__cols">
                {allergens.length > 0 && (
                  <div>
                    <h3>{t.menu.allergens}</h3>
                    <dl>
                      {allergens.map((a) => (
                        <div key={a.id}>
                          <dt>{a.code}</dt>
                          <dd>{a.name}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
                {additives.length > 0 && (
                  <div>
                    <h3>{t.menu.additives}</h3>
                    <dl>
                      {additives.map((a) => (
                        <div key={a.id}>
                          <dt>{a.code}</dt>
                          <dd>{a.name}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
