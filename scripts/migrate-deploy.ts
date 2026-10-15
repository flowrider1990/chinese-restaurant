/**
 * Applies pending database migrations during the Vercel build (pnpm vercel-build).
 *
 * Why not `payload migrate`: on the first Vercel build it exited with status 0 without running or
 * logging anything, and the build then failed on a missing column. This script uses the same
 * migration list as the integration tests, logs what it applies and fails the build on any error.
 *
 * Usage: pnpm migrate:deploy
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { migrations } from '../src/migrations'

const payload = await getPayload({ config })
const fail = (message: string) => {
  payload.logger.error(message)
  process.exit(1)
}
try {
  // A dev-mode push leaves a batch -1 row; Payload's migrate then asks for confirmation and, with no
  // terminal to answer (Vercel), exits 0 without migrating. Fail the build instead.
  const pushed = await payload.find({
    collection: 'payload-migrations',
    where: { batch: { equals: -1 } },
    limit: 1,
    depth: 0,
  })
  if (pushed.totalDocs > 0)
    fail('Database was changed by a dev-mode push (batch -1). Resolve it locally.')

  await payload.db.migrate({ migrations: migrations as never })

  const done = await payload.find({ collection: 'payload-migrations', pagination: false, depth: 0 })
  const recorded = new Set(done.docs.map((m) => m.name))
  const missing = migrations.map((m) => m.name).filter((name) => !recorded.has(name))
  if (missing.length > 0) fail(`Migrations not applied: ${missing.join(', ')}`)
  payload.logger.info(`Migrations up to date (${migrations.length} applied).`)
  process.exit(0)
} catch (error) {
  fail(`Migration failed: ${error instanceof Error ? error.message : String(error)}`)
}
