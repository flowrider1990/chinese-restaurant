import type { GlobalConfig } from 'payload'
import { authenticated } from '@/access'
import { revalidateGlobal } from '@/lib/revalidate'
import { DEFAULT_RULES } from '@/lib/reservation-rules'

const minutesField = (name: string, label: string, defaultValue: number, description: string) => ({
  name,
  type: 'number' as const,
  label,
  required: true,
  defaultValue,
  min: 0,
  admin: { description, width: '50%' },
})

export const ReservationSettings: GlobalConfig = {
  slug: 'reservation-settings',
  label: 'Reservierungen',
  admin: { group: 'Einstellungen' },
  // Read by the server only (Local API); the public REST API does not expose it.
  access: { read: authenticated, update: authenticated },
  hooks: { afterChange: [revalidateGlobal] },
  fields: [
    {
      name: 'mode',
      type: 'select',
      label: 'Reservierung über',
      required: true,
      defaultValue: 'form',
      options: [
        { label: 'Eigenes Formular auf der Website', value: 'form' },
        { label: 'Externen Anbieter (Link)', value: 'external' },
        { label: 'Aus (keine Online-Reservierung)', value: 'off' },
      ],
    },
    {
      name: 'externalUrl',
      type: 'text',
      label: 'Link zum externen Anbieter',
      admin: { condition: (_, s) => s?.mode === 'external' },
      validate: (
        value: string | null | undefined,
        { siblingData }: { siblingData: { mode?: string } },
      ) => {
        if (siblingData.mode !== 'external') return true
        try {
          return (
            new URL(value ?? '').protocol === 'https:' || 'Bitte eine https://-Adresse angeben.'
          )
        } catch {
          return 'Bitte eine vollständige Adresse angeben, z. B. https://…'
        }
      },
    },
    {
      type: 'row',
      fields: [
        minutesField(
          'slotMinutes',
          'Zeitraster (Minuten)',
          DEFAULT_RULES.slotMinutes,
          'Abstand der wählbaren Uhrzeiten.',
        ),
        minutesField(
          'leadTimeMinutes',
          'Vorlauf (Minuten)',
          DEFAULT_RULES.leadTimeMinutes,
          'Frühestens so viele Minuten ab jetzt.',
        ),
      ],
    },
    {
      type: 'row',
      fields: [
        minutesField(
          'lastBookingBeforeCloseMinutes',
          'Letzte Reservierung vor Schluss (Minuten)',
          DEFAULT_RULES.lastBookingBeforeCloseMinutes,
          'Gilt für jedes Zeitfenster (mittags, abends).',
        ),
        minutesField('horizonDays', 'Wie weit im Voraus (Tage)', DEFAULT_RULES.horizonDays, ''),
      ],
    },
    {
      type: 'row',
      fields: [
        minutesField(
          'maxPartySize',
          'Maximale Personenzahl online',
          DEFAULT_RULES.maxPartySize,
          'Größere Gruppen werden gebeten anzurufen.',
        ),
        minutesField(
          'retentionDays',
          'Personendaten löschen nach (Tagen)',
          30,
          'Name, E-Mail, Telefon und Anmerkung werden danach entfernt.',
        ),
      ],
    },
    {
      name: 'notificationEmail',
      type: 'email',
      label: 'Neue Anfragen senden an',
      admin: { description: 'Leer lassen, um die E-Mail-Adresse des Restaurants zu verwenden.' },
    },
  ],
}
