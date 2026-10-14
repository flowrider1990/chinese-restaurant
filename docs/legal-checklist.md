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

- [ ] Lieferando and Wolt logos (`public/brands/`) come from the providers' press kits (newsroom.justeattakeaway.com, press.wolt.com, 2026-10-14), which state no licence ("all rights reserved"). Before launch, confirm the restaurant is a listed partner and use the logos under the partner brand guidelines (or the partner-portal assets).
- [ ] Uber Eats: the co-marketing asset page could not be read automatically (it loads only in a browser). The logo is not included yet; the site shows the name as text.
- [ ] Payment method marks (PayPal, Visa, Mastercard): use only the official acceptance marks from the payment providers, under their rules. Currently shown as text only.
- [ ] Every photo and font needs a recorded licence. Self-host the fonts, with no requests to Google.

## Consumer information

- [ ] Prices include VAT (PAngV). Drink sizes are shown next to their prices.
- [ ] No unsupported claims (e.g. "ohne Glutamat") unless the restaurant confirms them.

## Privacy and consent

- [ ] No third-party requests when viewing any page. The map is a self-hosted drawing from OpenStreetMap data (`pnpm map:generate`); Google Maps is only a link. Check this in the browser's network panel.
- [ ] OpenStreetMap attribution stays visible below the map (ODbL).
- [ ] Assess whether a consent banner is needed, for the full deployed stack.
- [ ] Order links lead to third parties. Mention this in the privacy policy.

## Accessibility

- [ ] axe run on every public route, and a keyboard-only walk-through.
