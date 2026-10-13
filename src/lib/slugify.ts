const TRANSLITERATIONS: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }

/** URL-safe slug: lowercase ASCII, German umlauts transliterated, other diacritics stripped. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[äöüß]/g, (ch) => TRANSLITERATIONS[ch] ?? ch)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
