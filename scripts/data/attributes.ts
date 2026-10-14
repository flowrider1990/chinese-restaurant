type Localized = { de: string; en: string }

/** EU Regulation 1169/2011, Annex II, with the letter codes common on German menus. */
export const allergens: [code: string, name: Localized][] = [
  ['A', { de: 'Glutenhaltiges Getreide', en: 'Cereals containing gluten' }],
  ['B', { de: 'Krebstiere', en: 'Crustaceans' }],
  ['C', { de: 'Eier', en: 'Eggs' }],
  ['D', { de: 'Fisch', en: 'Fish' }],
  ['E', { de: 'Erdnüsse', en: 'Peanuts' }],
  ['F', { de: 'Soja', en: 'Soybeans' }],
  ['G', { de: 'Milch (einschließlich Laktose)', en: 'Milk (including lactose)' }],
  ['H', { de: 'Schalenfrüchte', en: 'Tree nuts' }],
  ['I', { de: 'Sellerie', en: 'Celery' }],
  ['J', { de: 'Senf', en: 'Mustard' }],
  ['K', { de: 'Sesamsamen', en: 'Sesame seeds' }],
  ['L', { de: 'Schwefeldioxid und Sulfite', en: 'Sulphur dioxide and sulphites' }],
  ['M', { de: 'Lupinen', en: 'Lupin' }],
  ['N', { de: 'Weichtiere', en: 'Molluscs' }],
]

/** Additives used by the placeholder menu. Numbering follows the source menu's legend. */
export const additives: [code: string, name: Localized][] = [
  ['12', { de: 'Mit Süßungsmitteln', en: 'Contains sweeteners' }],
  ['15', { de: 'Koffeinhaltig', en: 'Contains caffeine' }],
  ['16', { de: 'Chininhaltig', en: 'Contains quinine' }],
  ['22', { de: 'Enthält Stärke', en: 'Contains starch' }],
  ['23', { de: 'Enthält Eiweiß (aus Eiern)', en: 'Contains egg protein' }],
]

export const dietaryTags = {
  vegetarian: { de: 'Vegetarisch', en: 'Vegetarian' },
  vegan: { de: 'Vegan', en: 'Vegan' },
} satisfies Record<string, Localized>

export type MenuData = {
  categories: {
    name: Localized
    description?: Localized
    items: {
      nr?: string
      nameOriginal?: string
      name: Localized
      description?: Localized
      price: number
      allergens: string[]
      additives?: string[]
      spiciness?: 'mild' | 'medium' | 'hot'
      tags?: (keyof typeof dietaryTags)[]
      options?: { label: Localized; priceDelta?: number }[]
      featured?: boolean
    }[]
  }[]
}
