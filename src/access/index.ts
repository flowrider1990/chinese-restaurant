import type { Access, FieldAccess } from 'payload'

/** Single admin role: any logged-in user of the `users` collection is an editor. */
export const authenticated: Access = ({ req }) => Boolean(req.user)
export const authenticatedField: FieldAccess = ({ req }) => Boolean(req.user)

export const anyone: Access = () => true

/** Public sees `published: true` docs; editors see everything. */
export const publishedOrAuthenticated: Access = ({ req }) =>
  req.user ? true : { published: { equals: true } }

/** For collections with Payload drafts: public sees only the published version. */
export const draftsPublishedOrAuthenticated: Access = ({ req }) =>
  req.user ? true : { _status: { equals: 'published' } }

/** Editor-only CRUD with public read. */
export const editorWrite = {
  create: authenticated,
  update: authenticated,
  delete: authenticated,
}
