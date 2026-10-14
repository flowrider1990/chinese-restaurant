# Legal release checklist

Things to check before any public release. Each item must be checked against current
authoritative sources for Germany/EU at release time, not from this list alone.

## Fictional and borrowed development data (must be gone before launch)

- [ ] Restaurant name "Xiao Chu", address, phone, e-mail and opening hours are fictional. Replace them with the real data.
- [ ] The imprint has a fictional operator, register entry and VAT ID. Replace it with the operator's real details and have it checked (§ 5 DDG).
- [ ] The privacy policy is a placeholder. Write and review it for the deployed stack (hosting, Turso, Blob, map, external links).
- [ ] The placeholder menu (`scripts/data/menu.json`) follows another restaurant's public menu (wei-house.de). It must not go live. Replace it with the restaurant's own menu.
- [ ] Allergen and additive assignments in the placeholder menu are unverified. The real menu needs the restaurant's own, checked allergen data (EU FIC 1169/2011, LMIDV) and additive labelling.

## Trademarks and assets

- [ ] Lieferando and Wolt names and logos. Use only the official partner assets and follow their brand guidelines. Until then, show the text names only.
- [ ] Every photo and font needs a recorded licence. Self-host the fonts, with no requests to Google.

## Consumer information

- [ ] Prices include VAT (PAngV). Drink sizes are shown next to their prices.
- [ ] No unsupported claims (e.g. "ohne Glutamat") unless the restaurant confirms them.

## Privacy and consent

- [ ] No third-party requests before the map click. Check this in the browser's network panel.
- [ ] Assess whether a consent banner is needed, for the full deployed stack.
- [ ] Order links lead to third parties. Mention this in the privacy policy.

## Accessibility

- [ ] axe run on every public route, and a keyboard-only walk-through.
