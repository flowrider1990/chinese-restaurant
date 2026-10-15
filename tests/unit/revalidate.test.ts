import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { revalidatePath } from 'next/cache'
import type { PayloadRequest } from 'payload'
import { revalidateGlobal } from '@/lib/revalidate'

describe('site revalidation', () => {
  it('refreshes the public pages and the sitemap', () => {
    revalidateGlobal({ req: { context: {} } as PayloadRequest } as Parameters<
      typeof revalidateGlobal
    >[0])
    expect(revalidatePath).toHaveBeenCalledWith('/(frontend)/[locale]', 'layout')
    expect(revalidatePath).toHaveBeenCalledWith('/sitemap.xml')
  })
})
