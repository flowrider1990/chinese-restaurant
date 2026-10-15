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
try {
  await payload.db.migrate({ migrations: migrations as never })
  const done = await payload.find({ collection: 'payload-migrations', limit: 0, depth: 0 })
  payload.logger.info(
    `Migrations up to date (${done.totalDocs} recorded, ${migrations.length} known).`,
  )
  process.exit(0)
} catch (error) {
  payload.logger.error(
    `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exit(1)
}
