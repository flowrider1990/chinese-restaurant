/**
 * Imports the placeholder images from data/images-incoming/ (git-ignored) into the media library
 * and assigns them: hero-*.jpg → home page slider, <category-slug>.jpg → that menu category.
 * German alt texts come from ALT-TEXTE.txt in the same folder, English ones from the table below.
 * Every image is captioned as an AI-generated symbol image.
 *
 * Usage: pnpm images:import   (safe to re-run: files already in the library are reused)
 */
import 'dotenv/config'
import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const DIR = 'data/images-incoming'
const CAPTION = { de: 'Symbolbild (KI-generiert)', en: 'Illustrative image (AI-generated)' }

const altEn: Record<string, string> = {
  'hero-table': 'A shared table with dumplings, kung pao chicken, greens, mapo tofu and rice.',
  'hero-wok': 'Noodles and vegetables tossed in a wok over an open flame.',
  suppen: 'Hot and sour soup with tofu, wood ear mushrooms and egg in an enamel bowl.',
  'kalte-vorspeisen': 'Cucumber salad, green beans and smoked tofu on three small plates.',
  'warme-vorspeisen-dim-sum': 'Har gow and xiaolongbao in a bamboo steamer with black vinegar and ginger.',
  huhn: 'Kung pao chicken with peanuts, dried chilies and spring onions.',
  schwein: 'Braised pork belly with bok choy in an enamel bowl.',
  ente: 'Crispy sliced duck with spring onions and a dark sauce.',
  rind: 'Stir-fried beef with broccoli in a light sauce.',
  'fisch-garnelen': 'Shrimp with Sichuan pepper, chili, garlic and lime.',
  'vegetarisch-vegan': 'Aubergine in a garlic chili sauce with spring onions.',
  'reis-nudeln': 'Fried rice and fried noodles with vegetables in two bowls.',
  desserts: 'Fried sticky rice balls with vanilla ice cream and sesame.',
  'softdrinks-saefte': 'Mango and cherry juice in two chilled glasses.',
  'tee-kaffee': 'Jasmine tea in a glass teapot with porcelain cups and an espresso.',
  'bier-wein': 'A pale lager and a white wine next to a bowl of edamame.',
}

if (!existsSync(DIR)) {
  console.error(`${DIR} does not exist. Put the images there first.`)
  process.exit(1)
}

const altDe = new Map(
  readFileSync(path.join(DIR, 'ALT-TEXTE.txt'), 'utf-8')
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter(([file, text]) => file && text)
    .map(([file, text]) => [path.parse(file).name, text]),
)

const payload = await getPayload({ config })
const files = readdirSync(DIR).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))

async function upload(file: string) {
  const key = path.parse(file).name
  const existing = await payload.find({ collection: 'media', where: { filename: { equals: file } }, limit: 1 })
  if (existing.docs[0]) return existing.docs[0].id
  const alt = altDe.get(key)
  if (!alt) throw new Error(`No German alt text for ${file} in ALT-TEXTE.txt`)
  const doc = await payload.create({
    collection: 'media',
    locale: 'de',
    filePath: path.join(DIR, file),
    data: { alt, caption: CAPTION.de, credit: 'KI-generiert (Platzhalter)' },
  })
  await payload.update({
    collection: 'media',
    id: doc.id,
    locale: 'en',
    data: { alt: altEn[key] ?? alt, caption: CAPTION.en },
  })
  return doc.id
}

const heroIds: number[] = []
let assigned = 0
for (const file of files.sort()) {
  const key = path.parse(file).name
  const id = await upload(file)
  if (key.startsWith('hero')) {
    heroIds.push(id)
    continue
  }
  const category = await payload.find({
    collection: 'menu-categories',
    locale: 'de',
    where: { slug: { equals: key } },
    limit: 1,
  })
  if (!category.docs[0]) {
    console.warn(`No menu category with the slug "${key}" – ${file} stays in the library only.`)
    continue
  }
  await payload.update({ collection: 'menu-categories', id: category.docs[0].id, data: { image: id } })
  assigned++
}

if (heroIds.length) {
  // hero-table first: it shows the most dishes.
  heroIds.sort((a, b) => a - b)
  await payload.updateGlobal({ slug: 'home', data: { heroSlides: heroIds.map((image) => ({ image })) } })
}

console.log(`Imported ${files.length} images: ${heroIds.length} hero slides, ${assigned} category images.`)
process.exit(0)
