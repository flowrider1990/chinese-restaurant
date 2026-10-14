import { describe, expect, it } from 'vitest'
import { additives, allergens, dietaryTags, type MenuData } from '../../scripts/data/attributes'
import menuJson from '../../scripts/data/menu.json' with { type: 'json' }

const menu = menuJson as MenuData
const items = menu.categories.flatMap((c) => c.items)

describe('seed menu data', () => {
  it('only references known allergen, additive and dietary codes', () => {
    const allergenCodes = new Set(allergens.map(([code]) => code))
    const additiveCodes = new Set(additives.map(([code]) => code))
    for (const item of items) {
      for (const code of item.allergens) expect(allergenCodes, item.name.de).toContain(code)
      for (const code of item.additives ?? []) expect(additiveCodes, item.name.de).toContain(code)
      for (const tag of item.tags ?? []) expect(Object.keys(dietaryTags), item.name.de).toContain(tag)
    }
  })

  it('has integer cent prices, both languages and unique menu numbers', () => {
    const numbers = items.flatMap((i) => (i.nr ? [i.nr] : []))
    expect(new Set(numbers).size).toBe(numbers.length)
    for (const item of items) {
      expect(Number.isInteger(item.price) && item.price > 0, item.name.de).toBe(true)
      expect(item.name.de && item.name.en, item.name.de).toBeTruthy()
      for (const o of item.options ?? []) {
        expect(o.label.de && o.label.en, item.name.de).toBeTruthy()
        if (o.priceDelta !== undefined) expect(Number.isInteger(o.priceDelta)).toBe(true)
      }
    }
  })

  it('never tags a dish vegan without also tagging it vegetarian', () => {
    for (const item of items.filter((i) => i.tags?.includes('vegan'))) {
      expect(item.tags, item.name.de).toContain('vegetarian')
    }
  })
})
