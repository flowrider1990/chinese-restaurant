import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Benutzer', plural: 'Benutzer' },
  admin: {
    useAsTitle: 'email',
    group: 'Administration',
  },
  auth: {
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    tokenExpiration: 8 * 60 * 60,
  },
  // No public sign-up: only logged-in admins can manage accounts.
  // (Payload's "create first user" screen still works on an empty users table.)
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [{ name: 'name', type: 'text', label: 'Name' }],
}
