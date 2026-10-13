/**
 * Seeds placeholder content so the site and admin have realistic structure.
 * Everything here is a placeholder: names, dishes, prices, allergen assignments, phone, address
 * and legal texts must be replaced with the restaurant's real data before go-live.
 *
 * Usage: pnpm seed   (refuses to run if menu categories already exist)
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

type Localized = { de: string; en: string }

const payload = await getPayload({ config })

const existing = await payload.count({ collection: 'menu-categories' })
if (existing.totalDocs > 0) {
  console.error('Seed aborted: menu categories already exist. Seeding only runs on an empty database.')
  process.exit(1)
}

// --- Lexical rich text helpers ---------------------------------------------------------------

const text = (value: string) => ({
  type: 'text',
  text: value,
  format: 0,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})
const block = (type: 'paragraph' | 'heading', value: string) => ({
  type,
  ...(type === 'heading' ? { tag: 'h2' } : { textFormat: 0, textStyle: '' }),
  format: '' as const,
  indent: 0,
  version: 1,
  direction: 'ltr' as const,
  children: [text(value)],
})
/** Lines starting with "## " become h2 headings, everything else paragraphs. */
const richText = (lines: string[]) => ({
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    direction: 'ltr' as const,
    children: lines.map((l) => (l.startsWith('## ') ? block('heading', l.slice(3)) : block('paragraph', l))),
  },
})

// Create in German, then add English values for localized fields.
async function createLocalized<T extends Record<string, unknown>>(
  collection: 'attributes' | 'menu-categories' | 'menu-items' | 'posts',
  shared: T,
  de: Record<string, unknown>,
  en: Record<string, unknown>,
) {
  const doc = await payload.create({ collection, locale: 'de', data: { ...shared, ...de } as never })
  await payload.update({ collection, id: doc.id, locale: 'en', data: en as never })
  return doc.id
}

// --- Allergens (EU Regulation 1169/2011, Annex II) and dietary attributes --------------------

const allergens: [code: string, name: Localized][] = [
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
const dietary: [kind: 'dietary' | 'other', name: Localized][] = [
  ['dietary', { de: 'Vegetarisch', en: 'Vegetarian' }],
  ['dietary', { de: 'Vegan', en: 'Vegan' }],
  ['other', { de: 'Scharf', en: 'Spicy' }],
  ['other', { de: 'Neu', en: 'New' }],
]

const attr: Record<string, number> = {}
for (const [code, name] of allergens) {
  attr[code] = await createLocalized(
    'attributes',
    { kind: 'allergen', code },
    { name: name.de },
    { name: name.en },
  )
}
for (const [kind, name] of dietary) {
  attr[name.en.toLowerCase()] = await createLocalized('attributes', { kind }, { name: name.de }, { name: name.en })
}

// --- Categories ----------------------------------------------------------------------------

const categories: Record<string, Localized> = {
  starters: { de: 'Vorspeisen', en: 'Starters' },
  soups: { de: 'Suppen', en: 'Soups' },
  mains: { de: 'Hauptgerichte', en: 'Main dishes' },
  noodles: { de: 'Nudelgerichte', en: 'Noodles' },
  rice: { de: 'Reisgerichte', en: 'Rice dishes' },
  sushi: { de: 'Sushi', en: 'Sushi' },
  desserts: { de: 'Desserts', en: 'Desserts' },
  drinks: { de: 'Getränke', en: 'Drinks' },
}
const cat: Record<string, number> = {}
for (const [key, name] of Object.entries(categories)) {
  cat[key] = await createLocalized('menu-categories', {}, { name: name.de }, { name: name.en })
}

// --- Placeholder dishes (example data only; real menu comes from the restaurant) ------------

type Dish = {
  nr: string
  category: string
  price: number
  name: Localized
  description: Localized
  attributes: string[]
  options?: { label: Localized; priceDelta?: number }[]
  featured?: boolean
}

const dishes: Dish[] = [
  {
    nr: '1',
    category: 'starters',
    price: 650,
    name: { de: 'Sommerrollen', en: 'Summer rolls' },
    description: {
      de: 'Reispapier, Kräuter, Reisnudeln, Erdnuss-Hoisin-Dip',
      en: 'Rice paper, herbs, rice noodles, peanut hoisin dip',
    },
    attributes: ['E', 'F', 'vegan'],
    options: [
      { label: { de: 'mit Tofu', en: 'with tofu' } },
      { label: { de: 'mit Garnelen', en: 'with prawns' }, priceDelta: 150 },
    ],
    featured: true,
  },
  {
    nr: '2',
    category: 'starters',
    price: 750,
    name: { de: 'Gyoza (6 Stück)', en: 'Gyoza (6 pieces)' },
    description: { de: 'Gebratene Teigtaschen mit Gemüsefüllung', en: 'Pan-fried dumplings, vegetable filling' },
    attributes: ['A', 'F', 'K', 'vegetarian'],
  },
  {
    nr: '10',
    category: 'soups',
    price: 1390,
    name: { de: 'Phở Bò', en: 'Phở Bò' },
    description: {
      de: 'Rinderbrühe, Reisbandnudeln, Rindfleisch, Thai-Basilikum, Limette',
      en: 'Beef broth, rice noodles, beef, Thai basil, lime',
    },
    attributes: ['I'],
    featured: true,
  },
  {
    nr: '20',
    category: 'mains',
    price: 1490,
    name: { de: 'Gà Xào Sả Ớt', en: 'Lemongrass chili chicken' },
    description: { de: 'Mit Zitronengras, Chili und Jasminreis', en: 'With lemongrass, chili and jasmine rice' },
    attributes: ['F', 'spicy'],
    options: [
      { label: { de: 'Hähnchen', en: 'Chicken' } },
      { label: { de: 'Rind', en: 'Beef' }, priceDelta: 200 },
      { label: { de: 'Tofu', en: 'Tofu' }, priceDelta: -100 },
    ],
  },
  {
    nr: '30',
    category: 'noodles',
    price: 1290,
    name: { de: 'Bún Chay', en: 'Bún Chay' },
    description: {
      de: 'Reisnudeln, knuspriger Tofu, Kräuter, Erdnüsse, Sojadressing',
      en: 'Rice noodles, crispy tofu, herbs, peanuts, soy dressing',
    },
    attributes: ['E', 'F', 'vegan'],
    featured: true,
  },
  {
    nr: '40',
    category: 'rice',
    price: 1350,
    name: { de: 'Gebratener Reis Yangzhou-Art', en: 'Yangzhou fried rice' },
    description: { de: 'Mit Ei, Garnelen, Erbsen und Frühlingszwiebeln', en: 'With egg, prawns, peas and spring onions' },
    attributes: ['B', 'C', 'F'],
  },
  {
    nr: 'S1',
    category: 'sushi',
    price: 890,
    name: { de: 'Avocado-Maki (8 Stück)', en: 'Avocado maki (8 pieces)' },
    description: { de: 'Mit Sesam', en: 'With sesame' },
    attributes: ['K', 'vegan'],
  },
  {
    nr: '60',
    category: 'desserts',
    price: 650,
    name: { de: 'Chè Ba Màu', en: 'Chè Ba Màu' },
    description: { de: 'Bohnen, Pandan-Gelee, Kokosmilch', en: 'Beans, pandan jelly, coconut milk' },
    attributes: ['vegan'],
  },
  {
    nr: '70',
    category: 'drinks',
    price: 450,
    name: { de: 'Hausgemachte Limonade', en: 'Homemade lemonade' },
    description: { de: 'Limette, Zitronengras, Minze (0,4 l)', en: 'Lime, lemongrass, mint (0.4 l)' },
    attributes: ['vegan'],
  },
]

for (const d of dishes) {
  const doc = await payload.create({
    collection: 'menu-items',
    locale: 'de',
    data: {
      menuNumber: d.nr,
      name: d.name.de,
      description: d.description.de,
      price: d.price,
      category: cat[d.category],
      attributes: d.attributes.map((a) => attr[a]),
      options: d.options?.map((o) => ({ label: o.label.de, priceDelta: o.priceDelta })),
      published: true,
      availability: 'available',
      featured: Boolean(d.featured),
    },
  })
  await payload.update({
    collection: 'menu-items',
    id: doc.id,
    locale: 'en',
    data: {
      name: d.name.en,
      description: d.description.en,
      // Keep row ids so English labels attach to the same option rows.
      options: doc.options?.map((row, i) => ({ ...row, label: d.options![i].label.en })),
    },
  })
}

// --- Posts ---------------------------------------------------------------------------------

await createLocalized(
  'posts',
  { _status: 'published', publishedAt: new Date().toISOString() },
  {
    title: 'Wir eröffnen bald',
    excerpt: 'Platzhalter-Beitrag: Hier steht bald die Ankündigung zur Eröffnung.',
    content: richText(['Platzhalter-Beitrag. Bitte im CMS durch eine echte Ankündigung ersetzen.']),
  },
  {
    title: 'Opening soon',
    excerpt: 'Placeholder post: the opening announcement will appear here.',
    content: richText(['Placeholder post. Replace with a real announcement in the CMS.']),
  },
)

// --- Globals -------------------------------------------------------------------------------

await payload.updateGlobal({
  slug: 'site-settings',
  locale: 'de',
  data: {
    name: '[Restaurantname]',
    tagline: 'Vietnamesische und chinesische Küche, modern interpretiert.',
    // Fictional number from the range reserved for film/TV use in Germany (030 23125 xxx).
    phone: '030 23125 000',
    phoneE164: '+493023125000',
    email: 'kontakt@example.com',
    address: { street: '[Straße Hausnummer]', postalCode: '[PLZ]', city: '[Ort]', country: 'DE' },
    seoDescription:
      'Vietnamesische und chinesische Küche, modern interpretiert. Im Restaurant oder zum Mitnehmen.',
  },
})
await payload.updateGlobal({
  slug: 'site-settings',
  locale: 'en',
  data: {
    tagline: 'Vietnamese and Chinese cooking, freshly reinterpreted.',
    seoDescription: 'Vietnamese and Chinese cooking, freshly reinterpreted. Dine in or take away.',
  },
})

const lunchAndDinner = [
  { open: '11:30', close: '14:30' },
  { open: '17:30', close: '22:00' },
]
await payload.updateGlobal({
  slug: 'opening-hours',
  data: {
    timezone: 'Europe/Berlin',
    weekly: (['tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((day) => ({
      day,
      slots: lunchAndDinner,
    })),
    exceptions: [],
  },
})

await payload.updateGlobal({
  slug: 'home',
  locale: 'de',
  data: {
    intro: richText([
      'Platzhaltertext: Eine kurze Vorstellung des Restaurants – wer kocht, was die Küche ausmacht und warum man vorbeikommen sollte.',
    ]),
  },
})
await payload.updateGlobal({
  slug: 'home',
  locale: 'en',
  data: {
    intro: richText([
      'Placeholder text: a short introduction to the restaurant – who cooks, what defines the food and why people should drop by.',
    ]),
  },
})

await payload.updateGlobal({
  slug: 'about',
  locale: 'de',
  data: { intro: richText(['Platzhaltertext über das Restaurant, die Geschichte und das Team.']) },
})
await payload.updateGlobal({
  slug: 'about',
  locale: 'en',
  data: { intro: richText(['Placeholder text about the restaurant, its story and the team.']) },
})

// Structural placeholders only. Content must be written/checked for the actual operator.
await payload.updateGlobal({
  slug: 'legal',
  locale: 'de',
  data: {
    imprint: richText([
      '## Angaben gemäß § 5 DDG',
      '[NAME DES BETREIBERS / FIRMA UND RECHTSFORM]',
      '[STRASSE HAUSNUMMER], [PLZ] [ORT]',
      '## Vertreten durch',
      '[VERTRETUNGSBERECHTIGTE PERSON(EN) – nur bei juristischen Personen]',
      '## Kontakt',
      'Telefon: [TELEFON] · E-Mail: [E-MAIL]',
      '## Registereintrag',
      '[REGISTERGERICHT UND REGISTERNUMMER – falls vorhanden]',
      '## Umsatzsteuer-ID',
      '[USt-IdNr. gemäß § 27a UStG – falls vorhanden]',
      '## Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV',
      '[NAME, ANSCHRIFT – rechtlich prüfen, ob erforderlich]',
      '## Verbraucherstreitbeilegung',
      '[ANGABE GEMÄSS § 36 VSBG – rechtlich prüfen, ob erforderlich]',
    ]),
    privacy: richText([
      'PLATZHALTER – Diese Datenschutzerklärung muss vor der Veröffentlichung vollständig erstellt und rechtlich geprüft werden.',
      '## 1. Verantwortlicher',
      '[NAME, ANSCHRIFT, KONTAKT DES VERANTWORTLICHEN]',
      '## 2. Hosting und Server-Logfiles',
      '[HOSTING-ANBIETER, VERARBEITETE DATEN, RECHTSGRUNDLAGE, SPEICHERDAUER]',
      '## 3. Bilder und Datenbank',
      '[SPEICHERDIENSTE FÜR BILDER UND INHALTE, AUFTRAGSVERARBEITUNG]',
      '## 4. Karte (Google Maps, erst nach Klick)',
      '[BESCHREIBUNG DER ZWEI-KLICK-LÖSUNG, DATENÜBERMITTLUNG AN GOOGLE, RECHTSGRUNDLAGE]',
      '## 5. Externe Bestell- und Social-Media-Links',
      '[HINWEIS AUF WEITERLEITUNG ZU DRITTANBIETERN]',
      '## 6. Ihre Rechte',
      '[AUSKUNFT, BERICHTIGUNG, LÖSCHUNG, EINSCHRÄNKUNG, DATENÜBERTRAGBARKEIT, WIDERSPRUCH, BESCHWERDERECHT BEI DER AUFSICHTSBEHÖRDE]',
    ]),
  },
})
await payload.updateGlobal({
  slug: 'legal',
  locale: 'en',
  data: {
    imprint: richText([
      'PLACEHOLDER – English version of the legal notice. The German version is authoritative.',
    ]),
    privacy: richText([
      'PLACEHOLDER – English version of the privacy policy. Must be written and reviewed before publication.',
    ]),
  },
})

console.log(
  `Seeded: ${allergens.length + dietary.length} attributes, ${Object.keys(categories).length} categories, ${dishes.length} dishes, 1 post, 5 globals.`,
)
process.exit(0)
