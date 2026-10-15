/**
 * Uploads the local media folder to Vercel Blob, so a database copied from development (whose
 * media rows point at files that only exist locally) works with Blob storage in production.
 *
 * Each file lands at the pathname the Payload Blob adapter derives for it: media has no
 * collection prefix and these rows have no `prefix`/`_objectKey`, so the pathname is the
 * (sanitised) file name at the store root, without a random suffix. Files already in the store
 * are skipped, so the script is safe to re-run.
 *
 * Usage: pnpm media:to-blob [dir] [--dry-run]
 *   dir        folder to upload (default: media)
 *   --dry-run  list what would be uploaded without contacting the store (no token needed)
 * The token comes from BLOB_READ_WRITE_TOKEN (shell, .env.local or .env); it is never printed.
 */
import { list, put } from '@vercel/blob'
import { config } from 'dotenv'
import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'
import { sanitizeFilename } from 'payload/shared'

// `vercel env pull` writes the Blob token to .env.local; .env is the project's usual file.
config({ path: ['.env.local', '.env'] })

/** Same as the adapter's default (1 year); the file names are immutable per upload. */
const CACHE_MAX_AGE = 60 * 60 * 24 * 365

const contentTypes: Record<string, string> = {
  '.avif': 'image/avif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

async function existingPathnames(token: string): Promise<Set<string>> {
  const found = new Set<string>()
  let cursor: string | undefined
  do {
    const page = await list({ token, cursor, limit: 1000 })
    for (const blob of page.blobs) found.add(blob.pathname)
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  return found
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const dir = path.resolve(args.find((a) => !a.startsWith('--')) ?? 'media')
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!dryRun && !token) {
    console.error('BLOB_READ_WRITE_TOKEN is not set. Refusing to run (use --dry-run to preview).')
    process.exit(1)
  }
  if (token && !/^vercel_blob_rw_[a-z\d]+_[a-z\d]+$/i.test(token)) {
    console.error('BLOB_READ_WRITE_TOKEN does not look like a Vercel Blob read-write token.')
    process.exit(1)
  }

  const files = readdirSync(dir).filter((f) => statSync(path.join(dir, f)).isFile())
  const existing = dryRun ? new Set<string>() : await existingPathnames(token!)
  let uploaded = 0
  let skipped = 0
  const unsupported: string[] = []
  const renamed: string[] = []

  for (const file of files) {
    const contentType = contentTypes[path.extname(file).toLowerCase()]
    if (!contentType) {
      unsupported.push(file)
      continue
    }
    const pathname = sanitizeFilename(file)
    if (pathname !== file) renamed.push(`${file} -> ${pathname}`)
    if (existing.has(pathname)) {
      skipped++
      continue
    }
    if (dryRun) {
      console.log(`would upload ${pathname}`)
    } else {
      await put(pathname, readFileSync(path.join(dir, file)), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: CACHE_MAX_AGE,
        contentType,
        token,
      })
    }
    uploaded++
  }

  console.log(
    `${dryRun ? 'Dry run: ' : ''}${files.length} files in ${dir}: ` +
      `${uploaded} ${dryRun ? 'to upload' : 'uploaded'}, ${skipped} already in the store, ` +
      `${unsupported.length} skipped (not an image).`,
  )
  if (unsupported.length) console.log(`Not uploaded: ${unsupported.join(', ')}`)
  if (renamed.length)
    console.warn(
      `Pathname differs from the file name (check the media rows): ${renamed.join(', ')}`,
    )
}

main().catch((err: unknown) => {
  // Error messages from @vercel/blob do not contain the token.
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
