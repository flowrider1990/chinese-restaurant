/**
 * Media files go to Vercel Blob only on Vercel (or when MEDIA_ON_BLOB=1 is set explicitly), so
 * local experiments never write into the demo's Blob store even if a token is in .env.local.
 * Without Blob, uploads stay in the local `media/` folder and are served from /api/media/file/….
 */
export function mediaOnBlob(env: Record<string, string | undefined>): boolean {
  return Boolean(env.BLOB_READ_WRITE_TOKEN) && (Boolean(env.VERCEL) || env.MEDIA_ON_BLOB === '1')
}
