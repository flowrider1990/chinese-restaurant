import { revalidateGlobal } from '@/lib/revalidate'
import type { GlobalConfig } from 'payload'
import { anyone, authenticated } from '@/access'

/**
 * Single source of truth for the restaurant's name, address and phone (NAP).
 * Opening hours live in the `opening-hours` global. No other place stores these values.
 */
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Restaurant & Kontakt',
  admin: { group: 'Einstellungen' },
  access: { read: anyone, update: authenticated },
  hooks: { afterChange: [revalidateGlobal] },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Restaurant',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'name',
                  type: 'text',
                  label: 'Name des Restaurants',
                  required: true,
                  admin: { width: '60%' },
                },
                {
                  name: 'nameNative',
                  type: 'text',
                  label: 'Name in Originalschrift (optional)',
                  admin: {
                    width: '40%',
                    description: 'Z. B. „小厨“. Erscheint klein neben dem Namen.',
                  },
                },
              ],
            },
            {
              name: 'tagline',
              type: 'text',
              label: 'Kurzbeschreibung / Claim',
              localized: true,
              admin: { description: 'Ein Satz, z. B. für die Startseite und Suchmaschinen.' },
            },
            {
              name: 'cuisine',
              type: 'text',
              label: 'Küche (für Suchmaschinen)',
              localized: true,
              admin: { description: 'Z. B. „Chinesisch“ oder „Sichuan“. Mehrere durch Komma trennen.' },
            },
          ],
        },
        {
          label: 'Kontakt & Adresse',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'phone',
                  type: 'text',
                  label: 'Telefon (Anzeige)',
                  required: true,
                  admin: { width: '50%', placeholder: '030 1234567' },
                },
                {
                  name: 'phoneE164',
                  type: 'text',
                  label: 'Telefon international (für Anruf-Links)',
                  required: true,
                  admin: { width: '50%', placeholder: '+49301234567' },
                  validate: (value: string | null | undefined) =>
                    /^\+[1-9]\d{6,14}$/.test(value ?? '') ||
                    'Format: +49 und Nummer ohne Leerzeichen, z. B. +49301234567',
                },
              ],
            },
            { name: 'email', type: 'email', label: 'E-Mail' },
            {
              name: 'address',
              type: 'group',
              label: 'Adresse',
              fields: [
                { name: 'street', type: 'text', label: 'Straße und Hausnummer', required: true },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'postalCode',
                      type: 'text',
                      label: 'PLZ',
                      required: true,
                      admin: { width: '30%' },
                    },
                    {
                      name: 'city',
                      type: 'text',
                      label: 'Ort',
                      required: true,
                      admin: { width: '70%' },
                    },
                  ],
                },
                {
                  name: 'country',
                  type: 'text',
                  label: 'Land (ISO-Code)',
                  defaultValue: 'DE',
                  required: true,
                },
              ],
            },
            {
              name: 'geo',
              type: 'point',
              label: 'Koordinaten (für Karte und Suchmaschinen)',
            },
            {
              name: 'mapsUrl',
              type: 'text',
              label: 'Link zu Google Maps (oder anderem Kartendienst)',
              admin: { description: 'Wird als „In Google Maps öffnen“ verlinkt.' },
            },
          ],
        },
        {
          label: 'Bestellen, Bezahlen & Social Media',
          fields: [
            {
              name: 'orderLinks',
              type: 'array',
              label: 'Bestell- / Lieferlinks',
              labels: { singular: 'Bestelllink', plural: 'Bestelllinks' },
              admin: {
                description:
                  'Externer Lieferdienst oder Bestellseite. Ohne Eintrag zeigt die Website stattdessen „Anrufen“. Ohne URL erscheint der Dienst nur als Hinweis, nicht als Link.',
              },
              fields: [
                {
                  name: 'provider',
                  type: 'select',
                  label: 'Dienst',
                  required: true,
                  defaultValue: 'other',
                  options: [
                    { label: 'Lieferando', value: 'lieferando' },
                    { label: 'Wolt', value: 'wolt' },
                    { label: 'Uber Eats', value: 'ubereats' },
                    { label: 'Eigene Bestellseite / Sonstige', value: 'other' },
                  ],
                },
                {
                  name: 'label',
                  type: 'text',
                  label: 'Beschriftung',
                  required: true,
                  localized: true,
                  admin: { placeholder: 'Jetzt bestellen' },
                },
                {
                  name: 'url',
                  type: 'text',
                  label: 'URL (optional)',
                  validate: (value: string | null | undefined) => !value || validateHttpsUrl(value),
                },
              ],
            },
            {
              name: 'paymentMethods',
              type: 'select',
              hasMany: true,
              label: 'Zahlungsarten im Restaurant',
              admin: {
                description: 'Wird auf der Restaurant-Seite und in der Fußzeile angezeigt.',
              },
              options: [
                { label: 'Bargeld', value: 'cash' },
                { label: 'girocard (EC-Karte)', value: 'girocard' },
                { label: 'Kreditkarte (Visa, Mastercard)', value: 'creditcard' },
                { label: 'PayPal', value: 'paypal' },
              ],
            },
            {
              name: 'socialLinks',
              type: 'array',
              label: 'Social Media',
              fields: [
                {
                  name: 'platform',
                  type: 'select',
                  label: 'Plattform',
                  required: true,
                  options: [
                    { label: 'Instagram', value: 'instagram' },
                    { label: 'Facebook', value: 'facebook' },
                    { label: 'TikTok', value: 'tiktok' },
                    { label: 'Google', value: 'google' },
                    { label: 'Sonstige', value: 'other' },
                  ],
                },
                {
                  name: 'url',
                  type: 'text',
                  label: 'URL',
                  required: true,
                  validate: validateHttpsUrl,
                },
              ],
            },
          ],
        },
        {
          label: 'SEO',
          fields: [
            {
              name: 'seoDescription',
              type: 'textarea',
              label: 'Standard-Beschreibung für Suchmaschinen',
              localized: true,
              maxLength: 160,
            },
            {
              name: 'ogImage',
              type: 'upload',
              relationTo: 'media',
              label: 'Standard-Vorschaubild für Social Media',
            },
          ],
        },
      ],
    },
  ],
}

function validateHttpsUrl(value: string | null | undefined) {
  try {
    return new URL(value ?? '').protocol === 'https:' || 'Bitte eine https://-Adresse angeben.'
  } catch {
    return 'Bitte eine vollständige Adresse angeben, z. B. https://…'
  }
}
