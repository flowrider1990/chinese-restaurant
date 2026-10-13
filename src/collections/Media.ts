import type { CollectionConfig } from 'payload'
import { anyone, editorWrite } from '@/access'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Bild', plural: 'Bilder' },
  admin: { group: 'Inhalte', useAsTitle: 'alt' },
  access: { read: anyone, ...editorWrite },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Alternativtext',
      required: true,
      localized: true,
      admin: {
        description: 'Kurze Beschreibung des Bildinhalts für Screenreader und Suchmaschinen.',
      },
    },
    { name: 'caption', type: 'text', label: 'Bildunterschrift', localized: true },
    {
      name: 'credit',
      type: 'text',
      label: 'Bildnachweis / Lizenz',
      admin: { description: 'Fotograf:in oder Quelle und Lizenz, falls nicht selbst erstellt.' },
    },
  ],
  upload: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    focalPoint: true,
    // Store a downscaled original; camera files rarely need more than 2560px.
    resizeOptions: { width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true },
    imageSizes: [
      { name: 'thumb', width: 400, height: 300, position: 'centre' },
      { name: 'card', width: 800, height: 600, position: 'centre' },
      { name: 'hero', width: 1920, height: 1080, position: 'centre', withoutEnlargement: true },
      { name: 'og', width: 1200, height: 630, position: 'centre' },
    ],
    formatOptions: { format: 'webp', options: { quality: 82 } },
    adminThumbnail: 'thumb',
  },
}
