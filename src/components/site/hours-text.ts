import type { Dictionary } from '@/i18n/dictionary'
import type { Day, Slot } from '@/lib/opening-hours'

export function formatSlots(slots: Slot[], t: Dictionary): string {
  if (slots.length === 0) return t.closedDay
  return slots.map((s) => `${s.open}–${s.close}`).join(` ${t.and} `)
}

export function formatDays(days: Day[], t: Dictionary): string {
  if (days.length === 1) return t.days[days[0]]
  if (days.length === 2) return `${t.days[days[0]]}, ${t.days[days[1]]}`
  return `${t.days[days[0]]}–${t.days[days.at(-1)!]}`
}
