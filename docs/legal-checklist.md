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
- [ ] Payment method marks (Visa, Mastercard, PayPal): currently one-colour glyphs from Simple Icons (CC0 files, but the marks are the owners' trademarks). Before launch, check them against the acceptance-mark rules of the restaurant's card terminal/payment provider, or replace them with the official marks they supply. girocard and cash use generic icons with text.
- [ ] Every photo and font needs a recorded licence. Self-host the fonts, with no requests to Google.
- [ ] AI-generated food images (`docs/image-prompts.md`): label them as symbol images, check the EU AI Act transparency duties (Art. 50) and the generator's commercial licence, and make sure they do not mislead about the real dishes (UWG). Prefer real photos for launch.

## Consumer information

- [ ] Prices include VAT (PAngV). Drink sizes are shown next to their prices.
- [ ] No unsupported claims (e.g. "ohne Glutamat") unless the restaurant confirms them.

## Privacy and consent

- [ ] No third-party requests when viewing any page. The map is a self-hosted drawing from OpenStreetMap data (`pnpm map:generate`); Google Maps is only a link. Check this in the browser's network panel.
- [ ] OpenStreetMap attribution stays visible below the map (ODbL).
- [ ] Assess whether a consent banner is needed, for the full deployed stack.
- [ ] Order links lead to third parties. Mention this in the privacy policy.
- [ ] Reservations: privacy policy section (purpose incl. recognising frequent guests within the retention period, legal basis, 30-day deletion), checked against current sources.
- [ ] Resend: data processing agreement signed; EU/US transfer basis checked; sender domain verified (SPF/DKIM).
- [ ] Daily cleanup (`/api/reservations/cleanup`) scheduled on the hosting with a secret `CRON_SECRET`; verified once in production.
- [ ] Spam: if fake requests appear, add rate limiting at the hosting level.

## Accessibility

- [ ] axe run on every public route, and a keyboard-only walk-through.
