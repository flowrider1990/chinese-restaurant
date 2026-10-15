# Architecture

One Next.js App Router app with Payload CMS embedded (`/admin`, `/api`), backed by
SQLite-compatible libSQL: a local file in dev, Turso in preview/production.

## Pinned stack

| Package | Version |
| --- | --- |
| Node | 22.14.0 (`.nvmrc`) |
| pnpm | 11.18.0 (`packageManager`) |
| next | 16.3.8 (Payload 3.90.2 peer range: `>=16.3.3 <17`) |
| payload, @payloadcms/* | 3.90.2 |
| @payloadcms/db-sqlite → @libsql/client | 3.90.2 → 0.14.0 (drizzle-orm 0.45.2, bundled by the adapter) |

Payload 4 was in beta at setup time (2026-10) and is deliberately not used.

## Database

- Adapter: `@payloadcms/db-sqlite` with `push: false`. Every schema change is a versioned
  migration in `src/migrations/` (`pnpm migrate:create <name>`, then `pnpm migrate`).
- `DATABASE_URL` is `file:./data/local.db` locally or `libsql://…turso.io` for Turso, with
  `DATABASE_AUTH_TOKEN` for Turso only. Each environment gets its own database.

## Connection spike (Phase 1 gate)

`pnpm migrate && pnpm spike:db` migrates, writes, reads back and deletes one document through
the Local API, then prints the target and versions.

| Target | Result |
| --- | --- |
| Local libSQL file | Passed 2026-10-13 (migrate, write/read/delete, `next build`) |
| Turso dev DB (aws-eu-west-1) | Passed 2026-10-13 (migrate 2.5 s, write/read/delete, `next build`; `payload_migrations` holds the initial migration, `users` is empty afterwards) |

## Turso

- The CLI runs in WSL (`~/.turso/turso`, account `flowrider1990`). It has no native Windows build.
- `chinese-restaurant` is the **development** database (created 2026-10-13 as a copy of the
  original `asia-restaurant` dev DB; Turso has no rename). Preview and production each get their
  own database (e.g. `chinese-restaurant-preview`, `chinese-restaurant-prod`) with their own tokens.
- Region is `aws-eu-west-1` (Ireland), so the Vercel functions region should be `dub1` (Dublin)
  to keep DB round trips short.
- The dev token sits in `.env` (git-ignored). It is a full-access token with no expiry; revoke
  and reissue it with `turso db tokens invalidate chinese-restaurant` if it ever leaks.

## Languages

- German (default) and English from the start, with more languages later via a language
  switcher.
- Payload `localization` is enabled before the first content schema exists. Adding it later
  would mean a data migration of every localized field.
- Content that is localized: names, descriptions, texts, slugs, SEO fields, alt text. Content
  that is not localized: prices, availability, sort order, images, phone, address.
- Routing: a `[locale]` segment. German is served without a prefix (`/speisekarte`), English
  under `/en/…` (`/en/menu`), with `hreflang` alternates.

## Public site (Phase 3)

- `src/app/(frontend)/[locale]/` is the site's root layout; the CMS keeps its own root layout in
  `(payload)`. `src/proxy.ts` rewrites German URLs (no prefix) onto `/de/…` and English URLs
  (`/en/menu`) onto the German page folders (`/en/speisekarte`); `/de/…` redirects to the
  unprefixed URL. Localized path segments live in `src/i18n/routes.ts`, interface text in
  `src/i18n/dictionary.ts`.
- Header, footer and the mobile action bar read the restaurant's details only through
  `getRestaurantInfo()` in `src/lib/queries.ts`.
- "Open now" is computed in the browser from `src/lib/opening-hours.ts`, so cached pages never
  show a stale status.
- Order links without a URL are shown as "coming soon" text, never as a link.
- The restaurant map is `public/map/restaurant.svg`, drawn by `pnpm map:generate` from OpenStreetMap
  data (one Overpass query, ODbL, attribution under the map). Viewing it contacts no third party.
  Re-run the script when the coordinates in the site settings change. Map tiles from
  tile.openstreetmap.org are not used: their policy forbids offline use.
- Design tokens are at the top of `src/app/(frontend)/[locale]/site.css`: enamel white, ink blue,
  cobalt accent, light jade surface, chili only for spice markers. Fonts (Bricolage Grotesque,
  Instrument Sans, both OFL) are self-hosted through `next/font`; Chinese text uses system fonts.
- Light/dark: follows the device by default; the header toggle stores `theme` in localStorage and
  sets `data-theme` on `<html>` before the first paint (inline script in the layout). Every dark
  colour rule therefore exists twice: under `prefers-color-scheme: dark` (guarded by
  `:not([data-theme='light'])`) and under `[data-theme='dark']`. The map has a light and a dark SVG.
- Menu filters (`MenuFilter`): one dietary choice plus any number of allergens to leave out; dishes
  carry `data-allergens` codes.
- `pnpm demo:post` adds a second demo post with a title image and an inline image (needs
  `pnpm images:import` first).
- `pnpm typecheck` runs `next typegen` first, because route types (`LayoutProps`) are generated.

## SEO and caching (Phase 5)

- Public pages are prerendered. Every save or delete in the CMS (collections and globals) calls
  `revalidatePath('/(frontend)/[locale]', 'layout')` (`src/lib/revalidate.ts`), so changes are live
  on the next visit. The path must be the route file path including the route group; the public
  URL does not work because of the proxy rewrite. Verified 2026-10-14 against a production build:
  a price edit through the API appeared on `/speisekarte` and `/en/menu` on the next visit.
- Posts are prerendered too (`generateStaticParams` per language); posts published later render on
  their first visit. A page rendered on request streams its metadata into `<body>` instead of
  `<head>`, so public pages must stay static.
- No `loading.tsx` under `[locale]` (removed 2026-10-15): a loading boundary sends the response
  before the page has run, so `notFound()` could only answer with status 200 (soft 404) and the
  page content ended up after the footer in the raw HTML. Unknown paths and posts now return 404.
- `src/lib/seo.ts`: canonical URLs, hreflang (de, en, x-default), Open Graph/Twitter cards,
  `Restaurant` JSON-LD from the same `getRestaurantInfo()` object as the visible pages. The menu
  page adds `Menu` JSON-LD (its `@id` is the restaurant's `hasMenu`), posts add `NewsArticle`
  (author and publisher: the restaurant).
- Titles and meta descriptions: per page from the dictionary (`seo` in `src/i18n/dictionary.ts`);
  the site settings' SEO description is the fallback (posts without a short text). Pages whose
  text is still a placeholder (English imprint and privacy) are `noindex` and left out of the
  sitemap (`isPlaceholder` in `src/lib/seo.ts`).
- Images: only a page's LCP image gets `preload` (`MediaImage`), one per page. Other images that
  must load at once use `eager`, which also sets `fetchPriority="low"`: React otherwise adds a
  preload for every non-lazy image.
- Default social image: `/og-image` and `/en/og-image` (route handler). A "Standard-Vorschaubild"
  in the site settings or a post's hero image replaces it.
- `sitemap.xml` (all pages in both languages, published posts, x-default German, lastModified from
  the CMS content of each page) and `robots.txt` (blocks `/admin` and `/api`). Base URL from
  `NEXT_PUBLIC_SITE_URL`.
- The proxy redirects (308) German segments under `/en` (`/en/speisekarte` → `/en/menu`).
- Deferred by decision (2026-10-14, no hosting chosen yet): the Vercel Blob storage adapter for
  images. Uploads are stored on the local disk until hosting is decided. Required before any
  serverless deployment, because serverless functions have no persistent disk.

## Reservations (2026-10-14)

Spec: `docs/superpowers/specs/2026-10-14-reservations-design.md`.

- Request model: guests send a request on `/reservieren` (`/en/reserve`); staff confirm or decline
  in the admin (Reservierungen). No capacity or table logic.
- `src/lib/reservation-rules.ts`: pure rules (bookable dates and times, request checks), shared by
  the form and the server. The server (`src/lib/reservation-submit.ts`, called by the Server Action)
  re-checks everything, ignores filled honeypots and duplicates within 10 minutes.
- Settings in the global "Einstellungen → Reservierungen": mode (form / external link / off), rule
  numbers, notification address, retention days. Read through `readReservationSettings()`.
- Mails (`src/lib/reservation-mails.ts`): website request → restaurant + guest receipt; status
  change to confirmed/declined → guest. Staff entries and saves without a status change send
  nothing. A failed send is logged and never undoes the save. Resend is used when
  `RESEND_API_KEY` is set (`EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`); otherwise mails go to the
  server log.
- Retention: `anonymiseExpiredReservations()` removes name, e-mail, phone, note and message after
  `retentionDays` (default 30). Run daily via `GET /api/reservations/cleanup` with
  `Authorization: Bearer <CRON_SECRET>`, or `pnpm reservations:cleanup`. Scheduling waits for the
  hosting decision.
- With mode off or external, `/reservieren` renders the not-found page (noindex, status 404).

## Vouchers (2026-10-14)

Spec: `docs/superpowers/specs/2026-10-14-vouchers-design.md`.

- Flow: `/gutscheine` (`/en/vouchers`) form → Server Action creates a pending voucher and a Stripe
  Checkout Session (amount checked on the server) → redirect to Stripe → success URL
  `/gutscheine?session_id=…` shows the thank-you state from our own database. The signed webhook
  marks the voucher paid exactly once, sets code and validity, and sends the mails.
- Units: `src/lib/voucher-rules.ts` (pure checks), `voucher-code.ts` (`XC-XXXX-XXXX`),
  `stripe.ts` (client), `voucher-checkout.ts`, `voucher-webhook.ts`, `voucher-fulfilment.ts`,
  `voucher-pdf.ts`, `voucher-mails.ts`; collection `src/collections/Vouchers.ts`.
- Units of money: integer cents, like prices. Amounts 10-300 EUR, whole euros. Valid until 31
  December of the third year after purchase (Europe/Berlin).
- Webhook: `POST /api/vouchers/stripe-webhook` (collection endpoint, raw body, signature checked).
  Locally run `stripe listen --events checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed --forward-to localhost:3000/api/vouchers/stripe-webhook`
  (the CLI requires `--events`), and put the printed secret (`stripe listen --print-secret`) into
  `STRIPE_WEBHOOK_SECRET`. Without the secret the endpoint answers 500; a bad signature gives 400.
- Test keys only: `src/lib/stripe.ts` refuses a key that does not start with `sk_test_`.
- Env vars (server only, never `NEXT_PUBLIC_`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Mails: buyer mail with PDF, plus a notice to the restaurant's notification address. If the buyer
  mail fails the voucher stays paid and the restaurant notice carries an "Achtung" line so staff
  pass the code on manually.
- Staff redeem in the admin by appending redemption rows; earlier rows cannot be changed. Staff
  can cancel a paid voucher (refund is done in the Stripe dashboard) and delete expired ones, or
  pending ones older than one hour (a pending voucher's Stripe page stays payable for 31 minutes).
- Migration `20261014_172131_vouchers` adds the `vouchers` tables; run `pnpm migrate` (also on
  Turso) before deploying.
- Privacy text: `scripts/seed.ts` contains a placeholder section "7. Gutscheinkauf und Zahlung (Stripe)",
  but the seed does not overwrite existing CMS content. The dev/production CMS privacy page needs this
  section pasted in manually (see `docs/legal-checklist.md`).
- `src/lib/stripe.ts` deliberately has no `import 'server-only'`: the module is reachable from the Payload
  config (CLI scripts would break) and is only imported by server modules.
- Deleting a staff user sets the "by" field of their redemptions to empty (`ON DELETE set null`).
- Verified live on 2026-10-14 with the Stripe CLI in test mode: purchase, webhook `[200]`, voucher
  paid with code and validity 31 Dec 2029, thank-you page, cancel via the Stripe back link leaves a
  pending voucher. Still open as manual checks: buyer mail with PDF arriving (needs a real recipient
  address), restaurant notice, partial redemption and staff delete in the admin (needs the first admin
  account; the dev DB has none yet).

## Content model (Phase 2)

| Admin group | Type | Purpose |
| --- | --- | --- |
| Speisekarte | `menu-items` | Dishes: number, name, original (Chinese) name, description, price (cents), category, image, attributes, spiciness (mild/medium/hot), options (label + surcharge, also used for sizes such as 0,2 l / 0,4 l), published, availability, featured. Drag & drop order |
| Speisekarte | `menu-categories` | Editor-defined categories, drag & drop order, per-language slug |
| Speisekarte | `attributes` | Reusable allergens, additives and dietary/other tags. `kind` separates legally required allergens and additives; the full `name` is authoritative, `code` is optional display shorthand |
| Inhalte | `posts` | News with drafts/published, per-language slug, `publishedAt` auto-set on first publish |
| Inhalte | `media` | Images (alt text required), WebP size variants, focal point, max 15 MB |
| Administration | `users` | Single admin role, login lockout after 5 failed attempts (15 min) |
| Einstellungen | `site-settings` | **Only** source of name, address, phone, order links (provider Lieferando/Wolt/other; URL optional, without URL the provider is shown as a notice, not a link), socials, default SEO |
| Einstellungen | `opening-hours` | **Only** source of weekly hours (multiple slots per day) and exceptions |
| Seiten | `home`, `about`, `legal` | Page content; legal texts are seeded as marked placeholders |

- Prices are integer cents and edited as "12,90" through `src/components/admin/PriceField.tsx`.
- Public read rules: unpublished dishes and draft posts are hidden from anonymous requests.
  All writes require login.
- The admin UI is German (English switchable). Content languages are DE (default, fallback) and EN.

## Seed and tests

- `pnpm seed` fills an **empty** database with fictional data: the restaurant "Xiao Chu" in
  Berlin-Friedrichshain (fictional address, phone from the film/TV range, fictional imprint),
  opening hours, one post, and the menu from `scripts/data/menu.json`.
- `scripts/data/menu.json` is the menu import format (categories → items with DE/EN names,
  cents, allergen/additive codes, spiciness, dietary tags, options). The placeholder menu follows
  a real Berlin restaurant's public menu as realistic test data; allergen codes are not verified.
  The restaurant's own menu replaces it in the same format.
- To rebuild the dev database: `pnpm payload migrate:fresh --forceAcceptWarning`, then `pnpm seed`.
  This drops all data; only for dev databases.
- `pnpm images:import` loads the placeholder photos from `data/images-incoming/` (git-ignored) into
  the media library: `hero-*.jpg` become the home slider, `restaurant.jpg` the restaurant page image,
  `<category-slug>.jpg` the category image.
  Alt texts come from `ALT-TEXTE.txt` (German) and the script (English); every image is captioned
  "Symbolbild (KI-generiert)". Re-running reuses files already in the library.
- `pnpm test` runs unit tests (including a consistency check of `menu.json`) and integration
  tests. Integration tests use a throwaway `data/test.db` and never touch the dev or Turso
  database.

## Known issues

- `pnpm migrate:create` generates `ALTER TABLE … ADD … REFERENCES media(id)` without
  `ON DELETE set null` when an upload field is added to an existing table. Without it, deleting an
  image that is still in use fails with a foreign-key error. Add `ON DELETE set null` by hand to
  every new upload/relationship column (done for the category and restaurant-page images; covered
  by an integration test).

- Running the initial migration against Turso has failed twice right after a fresh/empty
  database (2026-10-13 and 2026-10-14, at a `users_sessions` index). Re-running
  `migrate:fresh` succeeded both times. Not reproduced locally; watch for it when creating the
  preview and production databases.
