import { randomInt } from 'crypto'

/** No 0/O, 1/I/L: codes are read aloud and typed from paper. 31 characters. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_PATTERN = /^XC-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/

const block = () =>
  Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')

/** e.g. "XC-7K4M-9QPA". 31^8 ≈ 8.5 · 10^11 combinations; uniqueness is checked before saving. */
export function generateCode(): string {
  return `XC-${block()}-${block()}`
}
