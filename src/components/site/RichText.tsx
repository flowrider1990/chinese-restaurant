import { RichText as LexicalRichText } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

/** CMS rich text with the site's typography. */
export function RichText({ data, className }: { data: unknown; className?: string }) {
  if (!data) return null
  return <LexicalRichText data={data as SerializedEditorState} className={['prose', className].filter(Boolean).join(' ')} />
}
