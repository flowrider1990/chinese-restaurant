import {
  RichText as LexicalRichText,
  type JSXConvertersFunction,
} from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { Media } from '@/payload-types'
import { MediaImage } from './MediaImage'

/**
 * Images in the text go through next/image (resized, modern formats, lazy) instead of the original
 * file. The original is used as the source: the generated sizes are crops (4:3, 16:9, …) and would
 * cut the image off. Width: the text column (.prose, 65ch, about 43rem) at most.
 */
const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  upload: (args) => {
    const { node } = args
    // Uploads in rich text can only point at the media collection.
    const media = (typeof node.value === 'object' ? node.value : null) as Media | null
    if (!media?.mimeType?.startsWith('image/')) {
      return typeof defaultConverters.upload === 'function' ? defaultConverters.upload(args) : null
    }
    const alt = (node.fields?.alt as string | undefined) || media.alt
    return (
      <MediaImage media={{ ...media, alt }} sizes="(max-width: 48rem) calc(100vw - 2rem), 44rem" />
    )
  },
})

/** CMS rich text with the site's typography. */
export function RichText({ data, className }: { data: unknown; className?: string }) {
  if (!data) return null
  return (
    <LexicalRichText
      data={data as SerializedEditorState}
      converters={converters}
      className={['prose', className].filter(Boolean).join(' ')}
    />
  )
}
