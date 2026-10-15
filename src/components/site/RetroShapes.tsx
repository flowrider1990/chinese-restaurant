/**
 * Small 80s/90s-style shapes (squiggle, zigzag, rings, triangle, dot grid) scattered over a dark
 * green surface. Purely decorative: hidden from assistive tech and never catches clicks.
 * Positions live in site.css (.retro--hero / .retro--footer).
 */
export function RetroShapes({ variant }: { variant: 'hero' | 'footer' }) {
  return (
    <div className={`retro retro--${variant}`} aria-hidden="true">
      <svg className="retro__shape retro__squiggle" viewBox="0 0 68 24" fill="none">
        <path d="M3 12 Q 11 2 19 12 T 35 12 T 51 12 T 67 12" />
      </svg>
      <svg className="retro__shape retro__zigzag" viewBox="0 0 56 24" fill="none">
        <polyline points="3,20 12,5 21,20 30,5 39,20 48,5 54,15" />
      </svg>
      <svg className="retro__shape retro__ring" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="15" />
      </svg>
      <svg className="retro__shape retro__triangle" viewBox="0 0 40 36" fill="none">
        <polygon points="20,4 37,32 3,32" />
      </svg>
      <svg className="retro__shape retro__dots" viewBox="0 0 44 44">
        {[0, 1, 2, 3].flatMap((row) =>
          [0, 1, 2, 3].map((col) => (
            <circle key={`${row}-${col}`} cx={5 + col * 11} cy={5 + row * 11} r="2.4" />
          )),
        )}
      </svg>
      <svg className="retro__shape retro__half" viewBox="0 0 40 20">
        <path d="M2 20 A 18 18 0 0 1 38 20 Z" />
      </svg>
    </div>
  )
}
