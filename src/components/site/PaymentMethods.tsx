import type { Dictionary } from '@/i18n/dictionary'

/**
 * Brand glyphs from Simple Icons 13.21.0 (CC0; the marks remain trademarks of their owners).
 * Shown in the text colour, without a background. See docs/legal-checklist.md before launch.
 */
const brand = {
  visa: 'M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z',
  mastercard:
    'M11.343 18.031c.058.049.12.098.181.146-1.177.783-2.59 1.238-4.107 1.238C3.32 19.416 0 16.096 0 12c0-4.095 3.32-7.416 7.416-7.416 1.518 0 2.931.456 4.105 1.238-.06.051-.12.098-.165.15C9.6 7.489 8.595 9.688 8.595 12c0 2.311 1.001 4.51 2.748 6.031zm5.241-13.447c-1.52 0-2.931.456-4.105 1.238.06.051.12.098.165.15C14.4 7.489 15.405 9.688 15.405 12c0 2.31-1.001 4.507-2.748 6.031-.058.049-.12.098-.181.146 1.177.783 2.588 1.238 4.107 1.238C20.68 19.416 24 16.096 24 12c0-4.094-3.32-7.416-7.416-7.416zM12 6.174c-.096.075-.189.15-.28.231C10.156 7.764 9.169 9.765 9.169 12c0 2.236.987 4.236 2.551 5.595.09.08.185.158.28.232.096-.074.189-.152.28-.232 1.563-1.359 2.551-3.359 2.551-5.595 0-2.235-.987-4.236-2.551-5.595-.09-.08-.184-.156-.28-.231z',
  paypal:
    'M7.016 19.198h-4.2a.562.562 0 0 1-.555-.65L5.093.584A.692.692 0 0 1 5.776 0h7.222c3.417 0 5.904 2.488 5.846 5.5-.006.25-.027.5-.066.747A6.794 6.794 0 0 1 12.071 12H8.743a.69.69 0 0 0-.682.583l-.325 2.056-.013.083-.692 4.39-.015.087zM19.79 6.142c-.01.087-.01.175-.023.261a7.76 7.76 0 0 1-7.695 6.598H9.007l-.283 1.795-.013.083-.692 4.39-.134.843-.014.088H6.86l-.497 3.15a.562.562 0 0 0 .555.65h3.612c.34 0 .63-.249.683-.585l.952-6.031a.692.692 0 0 1 .683-.584h2.126a6.793 6.793 0 0 0 6.707-5.752c.306-1.95-.466-3.744-1.89-4.906z',
}

/** Generic line icons for methods without a brand glyph. */
const generic = {
  cash: 'M3 7h18v10H3zM7 7a4 4 0 0 1-4 4M17 7a4 4 0 0 0 4 4M7 17a4 4 0 0 0-4-4M17 17a4 4 0 0 1 4-4M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  girocard: 'M3 6h18v12H3zM3 10h18M6 15h5',
}

function Glyph({ path, fill, label }: { path: string; fill: boolean; label: string }) {
  return (
    <svg
      className="payment__icon"
      role="img"
      aria-label={label}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>{label}</title>
      <path d={path} />
    </svg>
  )
}

type Method = 'cash' | 'girocard' | 'creditcard' | 'paypal'

/** Accepted payment methods as icons; cash and girocard keep a short text, brands are self-explanatory. */
export function PaymentMethods({ methods, t }: { methods: Method[]; t: Dictionary }) {
  if (methods.length === 0) return null
  return (
    <div className="payment">
      <span className="payment__label">{t.payment}:</span>
      <ul className="payment__list">
        {methods.map((m) => (
          <li key={m}>
            {m === 'creditcard' ? (
              <>
                <Glyph path={brand.visa} fill label="Visa" />
                <Glyph path={brand.mastercard} fill label="Mastercard" />
              </>
            ) : m === 'paypal' ? (
              <Glyph path={brand.paypal} fill label="PayPal" />
            ) : (
              <>
                <Glyph path={generic[m]} fill={false} label={t.paymentMethods[m]} />
                <span aria-hidden="true">{t.paymentMethods[m]}</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
