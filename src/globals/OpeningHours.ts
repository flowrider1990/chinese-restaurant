import { revalidateGlobal } from '@/lib/revalidate'
import type { GlobalConfig } from 'payload'
import { anyone, authenticated } from '@/access'
import { timeField } from '@/fields/time'

const slotsField = {
  name: 'slots',
  type: 'array' as const,
  label: 'Zeitfenster',
  labels: { singular: 'Zeitfenster', plural: 'Zeitfenster' },
  admin: { description: 'Mehrere Zeitfenster für z. B. Mittag und Abend.' },
  fields: [
    {
      type: 'row' as const,
      fields: [timeField('open', 'Öffnet'), timeField('close', 'Schließt')],
    },
  ],
}

export const OpeningHours: GlobalConfig = {
  slug: 'opening-hours',
  label: 'Öffnungszeiten',
  admin: { group: 'Einstellungen' },
  access: { read: anyone, update: authenticated },
  hooks: { afterChange: [revalidateGlobal] },
  fields: [
    {
      name: 'weekly',
      type: 'array',
      label: 'Reguläre Öffnungszeiten',
      labels: { singular: 'Tag', plural: 'Tage' },
      admin: { description: 'Nicht aufgeführte Tage gelten als Ruhetag.' },
      fields: [
        {
          name: 'day',
          type: 'select',
          label: 'Wochentag',
          required: true,
          options: [
            { label: 'Montag', value: 'mon' },
            { label: 'Dienstag', value: 'tue' },
            { label: 'Mittwoch', value: 'wed' },
            { label: 'Donnerstag', value: 'thu' },
            { label: 'Freitag', value: 'fri' },
            { label: 'Samstag', value: 'sat' },
            { label: 'Sonntag', value: 'sun' },
          ],
        },
        { ...slotsField, minRows: 1, required: true },
      ],
    },
    {
      name: 'exceptions',
      type: 'array',
      label: 'Abweichende Zeiten (Feiertage, Urlaub, Sonderöffnungen)',
      labels: { singular: 'Ausnahme', plural: 'Ausnahmen' },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'from',
              type: 'date',
              label: 'Von',
              required: true,
              admin: { width: '50%', date: { pickerAppearance: 'dayOnly' } },
            },
            {
              name: 'to',
              type: 'date',
              label: 'Bis (einschließlich)',
              admin: {
                width: '50%',
                date: { pickerAppearance: 'dayOnly' },
                description: 'Leer lassen für einen einzelnen Tag.',
              },
            },
          ],
        },
        { name: 'closed', type: 'checkbox', label: 'Geschlossen', defaultValue: true },
        {
          ...slotsField,
          admin: { ...slotsField.admin, condition: (_, siblingData) => !siblingData?.closed },
        },
        {
          name: 'note',
          type: 'text',
          label: 'Hinweis',
          localized: true,
          admin: { placeholder: 'z. B. Betriebsurlaub, Neujahr' },
        },
      ],
    },
    {
      name: 'timezone',
      type: 'text',
      label: 'Zeitzone',
      defaultValue: 'Europe/Berlin',
      required: true,
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}
