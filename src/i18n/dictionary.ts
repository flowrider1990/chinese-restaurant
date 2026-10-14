import type { Day } from '@/lib/opening-hours'
import type { Locale } from './locales'

/** Interface text that is not editable in the CMS. */
const de = {
  nav: { menu: 'Speisekarte', restaurant: 'Restaurant', news: 'Aktuelles', imprint: 'Impressum', privacy: 'Datenschutz' },
  navLabel: 'Hauptnavigation',
  openMenu: 'Menü öffnen',
  closeMenu: 'Menü schließen',
  close: 'Schließen',
  skipToContent: 'Zum Inhalt springen',
  call: 'Anrufen',
  order: 'Bestellen',
  orderVia: 'Bestellen über',
  orderSoon: 'Bald auch über diese Lieferdienste:',
  externalLink: '(öffnet eine externe Seite)',
  languageLabel: 'Sprache',
  address: 'Adresse',
  openingHours: 'Öffnungszeiten',
  contact: 'Kontakt',
  closedDay: 'Ruhetag',
  openUntil: (time: string) => `Geöffnet bis ${time}`,
  opensToday: (time: string) => `Geschlossen, öffnet heute um ${time}`,
  opensOn: (day: string, time: string) => `Geschlossen, öffnet ${day} um ${time}`,
  closed: 'Geschlossen',
  days: { mon: 'Mo', tue: 'Di', wed: 'Mi', thu: 'Do', fri: 'Fr', sat: 'Sa', sun: 'So' } satisfies Record<Day, string>,
  daysLong: {
    mon: 'Montag', tue: 'Dienstag', wed: 'Mittwoch', thu: 'Donnerstag', fri: 'Freitag', sat: 'Samstag', sun: 'Sonntag',
  } satisfies Record<Day, string>,
  and: 'und',
  social: 'Social Media',
  notFoundTitle: 'Diese Seite gibt es nicht',
  notFoundText: 'Vielleicht hilft die Speisekarte weiter.',
  toHome: 'Zur Startseite',
}

const en: typeof de = {
  nav: { menu: 'Menu', restaurant: 'Restaurant', news: 'News', imprint: 'Legal notice', privacy: 'Privacy' },
  navLabel: 'Main navigation',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  close: 'Close',
  skipToContent: 'Skip to content',
  call: 'Call',
  order: 'Order',
  orderVia: 'Order via',
  orderSoon: 'Coming soon on these delivery services:',
  externalLink: '(opens an external site)',
  languageLabel: 'Language',
  address: 'Address',
  openingHours: 'Opening hours',
  contact: 'Contact',
  closedDay: 'Closed',
  openUntil: (time) => `Open until ${time}`,
  opensToday: (time) => `Closed, opens today at ${time}`,
  opensOn: (day, time) => `Closed, opens ${day} at ${time}`,
  closed: 'Closed',
  days: { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' },
  daysLong: {
    mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
  },
  and: 'and',
  social: 'Social media',
  notFoundTitle: 'This page does not exist',
  notFoundText: 'The menu might be what you are looking for.',
  toHome: 'Go to the home page',
}

export type Dictionary = typeof de
export const dictionaries: Record<Locale, Dictionary> = { de, en }
