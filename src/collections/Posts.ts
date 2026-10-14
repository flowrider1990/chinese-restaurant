import { collectionRevalidation } from '@/lib/revalidate'
import type { CollectionConfig } from 'payload'
import { draftsPublishedOrAuthenticated, editorWrite } from '@/access'
import { slugField } from '@/fields/slug'

export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: { singular: 'Beitrag', plural: 'Beiträge' },
  admin: {
    group: 'Inhalte',
    useAsTitle: 'title',
    defaultColumns: ['title', 'publishedAt', '_status'],
  },
  defaultSort: '-publishedAt',
  access: { read: draftsPublishedOrAuthenticated, ...editorWrite },
  hooks: collectionRevalidation,
  versions: {
    drafts: true,
    maxPerDoc: 20,
  },
  fields: [
    { name: 'title', type: 'text', label: 'Titel', required: true, localized: true },
    {
      name: 'excerpt',
      type: 'textarea',
      label: 'Kurztext',
      localized: true,
      maxLength: 280,
      admin: { description: 'Erscheint in der Übersicht und als Vorschautext in Suchmaschinen.' },
    },
    { name: 'heroImage', type: 'upload', relationTo: 'media', label: 'Titelbild' },
    { name: 'content', type: 'richText', label: 'Inhalt', localized: true },
    slugField('title'),
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Veröffentlichungsdatum',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Wird beim ersten Veröffentlichen automatisch gesetzt, wenn leer.',
      },
      hooks: {
        beforeChange: [
          ({ value, siblingData }) =>
            !value && siblingData?._status === 'published' ? new Date().toISOString() : value,
        ],
      },
    },
  ],
}
