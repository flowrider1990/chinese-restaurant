import { notFound } from 'next/navigation'

/** Any path without its own page renders the localized not-found page inside the site layout. */
export default function CatchAll() {
  notFound()
}
