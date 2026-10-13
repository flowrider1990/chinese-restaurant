/**
 * Connection spike: proves the pinned Payload + db-sqlite + libSQL combination can
 * migrate, write and read against the configured DATABASE_URL (local file or Turso).
 * Usage: pnpm migrate && pnpm spike:db
 */
import 'dotenv/config'
import { randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const versionOf = (pkg: string) =>
  (JSON.parse(readFileSync(`node_modules/${pkg}/package.json`, 'utf8')) as { version: string }).version

const url = process.env.DATABASE_URL ?? ''
const target = url.startsWith('file:') ? `local file (${url})` : `remote (${new URL(url).host})`

const payload = await getPayload({ config })
const email = `spike-${Date.now()}@example.invalid`

const created = await payload.create({
  collection: 'users',
  data: { email, password: randomBytes(24).toString('hex') },
})
const found = await payload.find({ collection: 'users', where: { email: { equals: email } } })
await payload.delete({ collection: 'users', id: created.id })

if (found.docs[0]?.id !== created.id) throw new Error('Spike failed: written doc not read back')

console.log(
  JSON.stringify(
    {
      ok: true,
      target,
      payload: versionOf('payload'),
      dbSqlite: versionOf('@payloadcms/db-sqlite'),
      next: versionOf('next'),
    },
    null,
    2,
  ),
)
process.exit(0)
