/**
 * Seeds placeholder content so the site and admin have realistic structure.
 * Everything here is fictional or placeholder data: the restaurant, its address, phone, imprint,
 * and the menu in scripts/data/menu.json. Replace all of it with the real data before go-live.
 *
 * Usage: pnpm seed   (refuses to run if menu categories already exist)
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { additives, allergens, dietaryTags, type MenuData } from './data/attributes'
import menuJson from './data/menu.json' with { type: 'json' }

const menu = menuJson as MenuData

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

// --- Allergens, additives and dietary tags -----------------------------------------------

const attr: Record<string, number> = {}
for (const [code, name] of allergens) {
  attr[code] = await createLocalized('attributes', { kind: 'allergen', code }, { name: name.de }, { name: name.en })
}
for (const [code, name] of additives) {
  attr[code] = await createLocalized('attributes', { kind: 'additive', code }, { name: name.de }, { name: name.en })
}
for (const [key, name] of Object.entries(dietaryTags)) {
  attr[key] = await createLocalized('attributes', { kind: 'dietary' }, { name: name.de }, { name: name.en })
}

// --- Menu (placeholder data from scripts/data/menu.json) -----------------------------------

const ref = (code: string) => {
  if (!(code in attr)) throw new Error(`Unknown attribute code in menu.json: ${code}`)
  return attr[code]
}

let dishCount = 0
for (const category of menu.categories) {
  const categoryId = await createLocalized(
    'menu-categories',
    {},
    { name: category.name.de, description: category.description?.de },
    { name: category.name.en, description: category.description?.en },
  )
  for (const d of category.items) {
    const doc = await payload.create({
      collection: 'menu-items',
      locale: 'de',
      data: {
        menuNumber: d.nr,
        nameOriginal: d.nameOriginal,
        name: d.name.de,
        description: d.description?.de,
        price: d.price,
        category: categoryId,
        attributes: [...d.allergens, ...(d.additives ?? []), ...(d.tags ?? [])].map(ref),
        spiciness: d.spiciness,
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
        description: d.description?.en,
        // Keep row ids so English labels attach to the same option rows.
        options: doc.options?.map((row, i) => ({ ...row, label: d.options![i].label.en })),
      },
    })
    dishCount++
  }
}

// --- Posts ---------------------------------------------------------------------------------

await createLocalized(
  'posts',
  { _status: 'published', publishedAt: new Date().toISOString() },
  {
    title: 'Neu in Friedrichshain',
    excerpt: 'Beispielbeitrag: Wok, Dampfkorb und viel Gemüse – ab sofort an der Simon-Dach-Straße.',
    content: richText([
      'Beispielbeitrag mit fiktivem Inhalt. Bitte im CMS durch eine echte Ankündigung ersetzen.',
    ]),
  },
  {
    title: 'New in Friedrichshain',
    excerpt: 'Sample post: wok, steamer baskets and plenty of vegetables – now on Simon-Dach-Straße.',
    content: richText(['Sample post with fictional content. Replace with a real announcement in the CMS.']),
  },
)

// --- Globals (fictional restaurant) ---------------------------------------------------------

await payload.updateGlobal({
  slug: 'site-settings',
  locale: 'de',
  data: {
    name: 'Xiao Chu',
    nameNative: '小厨',
    tagline: 'Chinesische Küche aus Wok und Dampfkorb in Friedrichshain.',
    cuisine: 'Chinesisch, Sichuan, Dim Sum',
    // Fictional number from the range reserved for film/TV use in Germany (030 23125 xxx).
    phone: '030 23125 456',
    phoneE164: '+493023125456',
    email: 'hallo@xiaochu.example',
    // Fictional house number on a real street.
    address: { street: 'Simon-Dach-Straße 99', postalCode: '10245', city: 'Berlin', country: 'DE' },
    geo: [13.4567, 52.5097],
    orderLinks: [
      { provider: 'lieferando', label: 'Bei Lieferando bestellen' },
      { provider: 'wolt', label: 'Bei Wolt bestellen' },
    ],
    paymentMethods: ['cash', 'girocard', 'creditcard', 'paypal'],
    seoDescription:
      'Chinesisches Restaurant in Berlin-Friedrichshain: Dim Sum, Wok-Gerichte und Sichuan-Küche. Im Restaurant, zum Mitnehmen oder geliefert.',
  },
})
const settings = await payload.findGlobal({ slug: 'site-settings', locale: 'de' })
await payload.updateGlobal({
  slug: 'site-settings',
  locale: 'en',
  data: {
    tagline: 'Chinese cooking from wok and steamer basket in Friedrichshain.',
    cuisine: 'Chinese, Sichuan, Dim sum',
    // Keep row ids so English labels attach to the same rows.
    orderLinks: settings.orderLinks?.map((row) => ({
      ...row,
      label: row.provider === 'wolt' ? 'Order on Wolt' : 'Order on Lieferando',
    })),
    seoDescription:
      'Chinese restaurant in Berlin-Friedrichshain: dim sum, wok dishes and Sichuan cooking. Dine in, take away or delivered.',
  },
})

const weekday = [
  { open: '11:30', close: '15:00' },
  { open: '17:00', close: '22:30' },
]
const weekend = [{ open: '12:00', close: '22:30' }]
await payload.updateGlobal({
  slug: 'opening-hours',
  data: {
    timezone: 'Europe/Berlin',
    weekly: [
      ...(['tue', 'wed', 'thu', 'fri'] as const).map((day) => ({ day, slots: weekday })),
      ...(['sat', 'sun'] as const).map((day) => ({ day, slots: weekend })),
    ],
    exceptions: [],
  },
})

await payload.updateGlobal({
  slug: 'home',
  locale: 'de',
  data: {
    intro: richText([
      'Beispieltext: Bei Xiao Chu – „kleine Küche“ – kochen wir, was wir selbst am liebsten essen: Dim Sum aus dem Dampfkorb, Gerichte aus dem Wok und Sichuan-Klassiker mit ordentlich Pfeffer. Komm vorbei, bring Freunde mit und teil dir alles.',
    ]),
  },
})
await payload.updateGlobal({
  slug: 'home',
  locale: 'en',
  data: {
    intro: richText([
      'Sample text: at Xiao Chu – "little kitchen" – we cook what we love to eat ourselves: dim sum from the steamer basket, dishes from the wok and Sichuan classics with plenty of pepper. Drop by, bring friends and share everything.',
    ]),
  },
})

await payload.updateGlobal({
  slug: 'about',
  locale: 'de',
  data: {
    intro: richText([
      'Beispieltext: Xiao Chu ist ein fiktives Restaurant. Hier steht später die Geschichte des Restaurants und des Teams.',
    ]),
  },
})
await payload.updateGlobal({
  slug: 'about',
  locale: 'en',
  data: {
    intro: richText([
      'Sample text: Xiao Chu is a fictional restaurant. The story of the restaurant and its team will go here.',
    ]),
  },
})

// Fictional operator data for development. Must be replaced and legally checked before go-live.
await payload.updateGlobal({
  slug: 'legal',
  locale: 'de',
  data: {
    imprint: richText([
      'FIKTIVE BEISPIELDATEN – vor der Veröffentlichung durch die echten Angaben des Betreibers ersetzen und rechtlich prüfen.',
      '## Angaben gemäß § 5 DDG',
      'Xiao Chu Gastronomie GmbH',
      'Simon-Dach-Straße 99, 10245 Berlin',
      '## Vertreten durch',
      'Geschäftsführerin: Lin Mei',
      '## Kontakt',
      'Telefon: 030 23125 456 · E-Mail: hallo@xiaochu.example',
      '## Registereintrag',
      'Amtsgericht Charlottenburg, HRB 000000 B',
      '## Umsatzsteuer-ID',
      'USt-IdNr. gemäß § 27a UStG: DE000000000',
      '## Verbraucherstreitbeilegung',
      'Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. [RECHTLICH PRÜFEN]',
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
      '## 6. Reservierungsanfragen',
      '[ZWECK: BEARBEITUNG DER RESERVIERUNG UND – INNERHALB DER AUFBEWAHRUNGSFRIST – ERKENNEN VON STAMMGÄSTEN; DATEN: NAME, E-MAIL, OPTIONAL TELEFON UND ANMERKUNG; RECHTSGRUNDLAGE PRÜFEN (VORVERTRAGLICHE MASSNAHMEN, BERECHTIGTES INTERESSE); LÖSCHUNG 30 TAGE NACH DEM RESERVIERUNGSDATUM; E-MAIL-VERSAND ÜBER RESEND (AUFTRAGSVERARBEITUNG, DRITTLANDÜBERMITTLUNG PRÜFEN)]',
      '## 7. Gutscheinkauf und Zahlung (Stripe)',
      '[DATEN: NAME, E-MAIL, OPTIONAL NAME DES BESCHENKTEN UND NACHRICHT, BETRAG; ZWECK: VERKAUF UND ZUSTELLUNG DES GUTSCHEINS (VERTRAGSERFÜLLUNG); RECHTSGRUNDLAGE: ART. 6 ABS. 1 LIT. B DSGVO; EMPFÄNGER: STRIPE PAYMENTS EUROPE LTD. ALS ZAHLUNGSDIENSTLEISTER (ZAHLUNGSDATEN WERDEN AUF DER SEITE VON STRIPE EINGEGEBEN, NICHT AUF UNSERER SEITE; DRITTLANDÜBERMITTLUNG PRÜFEN); E-MAIL-VERSAND ÜBER RESEND WIE BEI DEN RESERVIERUNGEN; SPEICHERUNG ALS GESCHÄFTSUNTERLAGEN (GESETZLICHE AUFBEWAHRUNGSFRISTEN PRÜFEN)]',
      '## 8. Ihre Rechte',
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
  `Seeded: ${Object.keys(attr).length} attributes, ${menu.categories.length} categories, ${dishCount} dishes, 1 post, 5 globals.`,
)
process.exit(0)
