import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { resendAdapter } from '@payloadcms/email-resend'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { de } from '@payloadcms/translations/languages/de'
import { en } from '@payloadcms/translations/languages/en'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Attributes } from './collections/Attributes'
import { Media } from './collections/Media'
import { MenuCategories } from './collections/MenuCategories'
import { MenuItems } from './collections/MenuItems'
import { Posts } from './collections/Posts'
import { Reservations } from './collections/Reservations'
import { Users } from './collections/Users'
import { OpeningHours } from './globals/OpeningHours'
import { ReservationSettings } from './globals/ReservationSettings'
import { About, Home, Legal } from './globals/Pages'
import { SiteSettings } from './globals/SiteSettings'
import { defaultLocale, locales } from './i18n/locales'
import { mailConfigProblem } from './lib/mail-config'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/** Server-side upload cap. Larger photos must be exported smaller before uploading. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: { titleSuffix: ' – CMS' },
  },
  collections: [MenuItems, MenuCategories, Attributes, Posts, Media, Reservations, Users],
  globals: [SiteSettings, OpeningHours, ReservationSettings, Home, About, Legal],
  localization: {
    locales: locales.map((l) => ({ code: l.code, label: l.label })),
    defaultLocale,
    fallback: true,
  },
  i18n: {
    supportedLanguages: { de, en },
    fallbackLanguage: 'de',
  },
  upload: {
    limits: { fileSize: MAX_UPLOAD_BYTES },
    abortOnLimit: true,
    responseOnLimit: 'Die Datei ist zu groß (maximal 15 MB). Bitte verkleinert hochladen.',
  },
  editor: lexicalEditor(),
  // Real mails only with a Resend key; otherwise Payload writes them to the server log.
  ...(process.env.RESEND_API_KEY && {
    email: resendAdapter({
      apiKey: process.env.RESEND_API_KEY,
      defaultFromAddress: process.env.EMAIL_FROM_ADDRESS || 'reservierung@example.com',
      defaultFromName: process.env.EMAIL_FROM_NAME || 'Restaurant',
    }),
  }),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URL || '',
      // Required for Turso (libsql://…); unused for a local file DB.
      authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    },
    // Schema changes go through versioned migrations in every environment, never dev auto-push.
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  sharp,
  onInit: async (payload) => {
    const problem = mailConfigProblem(process.env)
    if (problem) payload.logger.error(problem)
  },
  plugins: [],
})
