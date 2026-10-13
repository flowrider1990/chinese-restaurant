import type { TextField } from 'payload'
import { isValidTime } from '@/lib/time'

export const timeField = (name: string, label: string): TextField => ({
  name,
  type: 'text',
  label,
  required: true,
  admin: { placeholder: 'HH:MM', width: '50%' },
  validate: (value: string | null | undefined) =>
    isValidTime(value) || 'Uhrzeit im Format HH:MM (z. B. 11:30).',
})
