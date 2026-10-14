import { revalidatePath } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook, PayloadRequest } from 'payload'

/**
 * Public pages are rendered statically. Any content change refreshes all of them on their next
 * visit: the site is small, so one site-wide refresh is simpler and safer than tracking which page
 * shows which dish, image or opening time.
 */
function revalidateSite(req: PayloadRequest) {
  // Scripts (seed, migrations) run outside Next.js and have nothing to refresh.
  if (req.context?.disableRevalidate) return
  try {
    // Route file path including the route group; the public URLs are rewritten onto it.
    revalidatePath('/(frontend)/[locale]', 'layout')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Outside a Next.js request (seed and other CLI scripts) there is no cache to refresh.
    if (message.includes('static generation store missing')) return
    req.payload.logger.warn(`Site revalidation failed: ${message}`)
  }
}

export const revalidateAfterChange: CollectionAfterChangeHook = ({ req }) => revalidateSite(req)
export const revalidateAfterDelete: CollectionAfterDeleteHook = ({ req }) => revalidateSite(req)
export const revalidateGlobal: GlobalAfterChangeHook = ({ req }) => revalidateSite(req)

/** Hooks for a content collection: refresh the public site after every save and delete. */
export const collectionRevalidation = {
  afterChange: [revalidateAfterChange],
  afterDelete: [revalidateAfterDelete],
}
