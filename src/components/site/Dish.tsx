import type { Dictionary } from '@/i18n/dictionary'
import { formatPrice } from '@/lib/price'
import type { Attribute, MenuItem } from '@/payload-types'

const attrs = (item: MenuItem) =>
  (item.attributes ?? []).filter((a): a is Attribute => typeof a === 'object')

/**
 * One dish. Allergens and additives are always written out in full; the codes in the legend are
 * only a convenience. Options (protein choice, drink sizes) are listed with their final price.
 */
export function Dish({
  item,
  t,
  as: Heading = 'h3',
}: {
  item: MenuItem
  t: Dictionary
  as?: 'h2' | 'h3'
}) {
  const list = attrs(item)
  const allergens = list.filter((a) => a.kind === 'allergen')
  const additives = list.filter((a) => a.kind === 'additive')
  const dietary = list.filter((a) => a.kind === 'dietary' || a.kind === 'other')
  const is = (name: string) => dietary.some((a) => a.name.toLowerCase() === name.toLowerCase())
  // Dietary tags are matched by their German or English name.
  const vegan = is(t.menu.tags.vegan) || is('vegan')
  const vegetarian = vegan || is(t.menu.tags.vegetarian) || is('vegetarisch') || is('vegetarian')
  const price = (cents: number) => formatPrice(cents, t.dateLocale)
  const options = item.options ?? []
  const unavailable = item.availability !== 'available'

  return (
    <li
      className="dish"
      data-vegetarian={vegetarian || undefined}
      data-vegan={vegan || undefined}
      data-spicy={item.spiciness || undefined}
      data-allergens={allergens.map((a) => a.id).join(' ') || undefined}
      data-unavailable={unavailable || undefined}
    >
      {item.menuNumber ? (
        <span className="plate">
          <span className="visually-hidden">{t.menu.number} </span>
          {item.menuNumber}
        </span>
      ) : (
        <span className="plate plate--empty" aria-hidden="true" />
      )}
      <div className="dish__body">
        <Heading className="dish__name">
          {item.name}
          {item.nameOriginal && (
            <span className="dish__original" lang="zh">
              {' '}
              {item.nameOriginal}
            </span>
          )}
        </Heading>
        {item.description && <p className="dish__desc">{item.description}</p>}
        {(vegetarian || item.spiciness || unavailable) && (
          <p className="dish__tags">
            {unavailable && (
              <span className="tag tag--state">
                {item.availability === 'sold_out' ? t.menu.soldOut : t.menu.unavailable}
              </span>
            )}
            {vegan ? (
              <span className="tag">{t.menu.tags.vegan}</span>
            ) : (
              vegetarian && <span className="tag">{t.menu.tags.vegetarian}</span>
            )}
            {item.spiciness && (
              <Spice level={item.spiciness} label={t.menu.spice[item.spiciness]} />
            )}
          </p>
        )}
        {(allergens.length > 0 || additives.length > 0) && (
          <p className="dish__allergens">
            {allergens.length > 0 && (
              <>
                {t.menu.contains}: {allergens.map((a) => a.name).join(', ')}.{' '}
              </>
            )}
            {additives.length > 0 && (
              <>
                {t.menu.additives}: {additives.map((a) => a.name).join(', ')}.
              </>
            )}
          </p>
        )}
      </div>
      {options.length > 1 && options.some((o) => !o.priceDelta) ? (
        <ul className="dish__prices">
          {options.map((o) => (
            <li key={o.id ?? o.label}>
              <span>{o.label}</span>{' '}
              <span className="dish__price">{price(item.price + (o.priceDelta ?? 0))}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="dish__prices">
          <span className="dish__price">{price(item.price)}</span>
          {options.map((o) => (
            <span key={o.id ?? o.label} className="dish__option">
              {o.label}{' '}
              {o.priceDelta
                ? `${o.priceDelta > 0 ? '+' : '−'}${price(Math.abs(o.priceDelta))}`
                : ''}
            </span>
          ))}
        </div>
      )}
    </li>
  )
}

function Spice({ level, label }: { level: 'mild' | 'medium' | 'hot'; label: string }) {
  const count = { mild: 1, medium: 2, hot: 3 }[level]
  return (
    <span className="spice">
      <span className="spice__dots" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <i key={n} data-on={n <= count || undefined} />
        ))}
      </span>
      {label}
    </span>
  )
}
