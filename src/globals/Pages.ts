import { revalidateGlobal } from '@/lib/revalidate'
import type { GlobalConfig } from 'payload'
import { anyone, authenticated } from '@/access'

const access = { read: anyone, update: authenticated }

export const Home: GlobalConfig = {
  slug: 'home',
  label: 'Startseite',
  admin: { group: 'Seiten' },
  access,
  hooks: { afterChange: [revalidateGlobal] },
  fields: [
    {
      name: 'heroSlides',
      type: 'array',
      label: 'Bilder im Slider',
      labels: { singular: 'Bild', plural: 'Bilder' },
      maxRows: 8,
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', label: 'Bild', required: true },
        { name: 'caption', type: 'text', label: 'Text auf dem Bild (optional)', localized: true },
      ],
    },
    {
      name: 'intro',
      type: 'richText',
      label: 'Kurze Vorstellung',
      localized: true,
    },
    {
      name: 'highlights',
      type: 'relationship',
      relationTo: 'menu-items',
      hasMany: true,
      label: 'Highlights (optional)',
      maxRows: 6,
      admin: {
        description:
          'Leer lassen, um automatisch die als „Highlight“ markierten Gerichte zu zeigen.',
      },
    },
  ],
}

export const About: GlobalConfig = {
  slug: 'about',
  label: 'Über uns / Restaurant',
  admin: { group: 'Seiten' },
  access,
  hooks: { afterChange: [revalidateGlobal] },
  fields: [
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Großes Bild oben (optional)',
      admin: { description: 'Z. B. der Gastraum. Querformat, wird breit unter der Überschrift gezeigt.' },
    },
    { name: 'intro', type: 'richText', label: 'Text', localized: true },
    {
      name: 'gallery',
      type: 'array',
      label: 'Bildergalerie (Restaurant & Interieur)',
      labels: { singular: 'Bild', plural: 'Bilder' },
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', label: 'Bild', required: true },
      ],
    },
    {
      name: 'team',
      type: 'array',
      label: 'Team',
      labels: { singular: 'Person', plural: 'Personen' },
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', label: 'Foto' },
        { name: 'name', type: 'text', label: 'Name' },
        { name: 'role', type: 'text', label: 'Rolle', localized: true },
      ],
    },
  ],
}

export const Legal: GlobalConfig = {
  slug: 'legal',
  label: 'Impressum & Datenschutz',
  admin: {
    group: 'Seiten',
    description:
      'Platzhalter in [ECKIGEN KLAMMERN] müssen vor der Veröffentlichung durch echte Angaben ersetzt werden.',
  },
  access,
  hooks: { afterChange: [revalidateGlobal] },
  fields: [
    { name: 'imprint', type: 'richText', label: 'Impressum', localized: true },
    { name: 'privacy', type: 'richText', label: 'Datenschutzerklärung', localized: true },
  ],
}
