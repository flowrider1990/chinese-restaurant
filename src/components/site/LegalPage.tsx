import { RichText } from './RichText'

/** Imprint and privacy: a title and the CMS text. */
export function LegalPage({ title, content }: { title: string; content: unknown }) {
  return (
    <article className="legal">
      <header className="page-head">
        <h1>{title}</h1>
      </header>
      <RichText data={content} />
    </article>
  )
}
