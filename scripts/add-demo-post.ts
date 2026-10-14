/**
 * Adds a second demo post ("Dim Sum am Wochenende") with a title image and one image inside the
 * text, and a title image for the first seeded post. Uses the placeholder photos already in the media library (pnpm images:import), so run that
 * first. Safe to re-run: an existing post with the same slug is left alone.
 *
 * Usage: pnpm demo:post
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const SLUG_DE = 'dim-sum-am-wochenende'

const payload = await getPayload({ config })

const existing = await payload.count({
  collection: 'posts',
  where: { slug: { equals: SLUG_DE } },
  locale: 'de',
})
// The first seeded post has no title image; give it one so the news cards look complete.
async function giveFirstPostAnImage() {
  const first = await payload.find({
    collection: 'posts',
    where: { slug: { equals: 'neu-in-friedrichshain' } },
    locale: 'de',
    limit: 1,
    depth: 0,
  })
  const doc = first.docs[0]
  if (doc && !doc.heroImage) {
    await payload.update({
      collection: 'posts',
      id: doc.id,
      data: { heroImage: await mediaId('hero-table') },
    })
  }
}

if (existing.totalDocs > 0) {
  await giveFirstPostAnImage()
  console.log('Demo post already exists.')
  process.exit(0)
}

async function mediaId(name: string) {
  const res = await payload.find({
    collection: 'media',
    where: { filename: { equals: `${name}.webp` } },
    limit: 1,
  })
  if (!res.docs[0])
    throw new Error(`Image "${name}" is not in the media library. Run pnpm images:import first.`)
  return res.docs[0].id
}
const hero = await mediaId('hero-wok')
const inline = await mediaId('restaurant')

const text = (value: string) => ({
  type: 'text',
  text: value,
  format: 0,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})
const paragraph = (value: string) => ({
  type: 'paragraph',
  format: '',
  indent: 0,
  version: 1,
  direction: 'ltr',
  textFormat: 0,
  textStyle: '',
  children: [text(value)],
})
const heading = (value: string) => ({
  type: 'heading',
  tag: 'h2',
  format: '',
  indent: 0,
  version: 1,
  direction: 'ltr',
  children: [text(value)],
})
const image = (id: number) => ({
  type: 'upload',
  relationTo: 'media',
  value: id,
  fields: null,
  format: '',
  version: 3,
})
const doc = (children: unknown[]) => ({
  root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children },
})

const post = await payload.create({
  collection: 'posts',
  locale: 'de',
  data: {
    title: 'Dim Sum am Wochenende',
    _status: 'published',
    publishedAt: new Date().toISOString(),
    heroImage: hero,
    excerpt:
      'Beispielbeitrag: Samstags und sonntags gibt es ab 12 Uhr frische Dim Sum aus dem Dampfkorb.',
    content: doc([
      paragraph(
        'Beispielbeitrag mit fiktivem Inhalt. Samstags und sonntags falten wir ab dem Morgen Teigtaschen, mittags kommen sie frisch aus dem Dampfkorb auf den Tisch.',
      ),
      heading('Am besten zu mehreren'),
      paragraph(
        'Dim Sum schmecken am besten geteilt: bestellt ein paar Körbe für die Mitte und probiert euch durch.',
      ),
      image(inline),
      paragraph('Reservieren könnt ihr online oder telefonisch.'),
    ]) as never,
  },
})
await payload.update({
  collection: 'posts',
  id: post.id,
  locale: 'en',
  data: {
    title: 'Weekend dim sum',
    excerpt:
      'Sample post: on Saturdays and Sundays, fresh dim sum from the steamer basket from noon.',
    content: doc([
      paragraph(
        'Sample post with fictional content. On Saturdays and Sundays we fold dumplings from the morning; at lunchtime they come to the table fresh from the steamer basket.',
      ),
      heading('Best shared'),
      paragraph(
        'Dim sum are best shared: order a few baskets for the middle of the table and try them all.',
      ),
      image(inline),
      paragraph('Book a table online or by phone.'),
    ]) as never,
  },
})
await giveFirstPostAnImage()
console.log(`Created demo post ${post.id}.`)
process.exit(0)
