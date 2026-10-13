# Restaurant website + integrated CMS — foundation plan

Approved plan, copied into the repo on 2026-10-13. The original lived only in the Claude Code
plans folder.

## Status (2026-10-13)

| Phase | State |
|---|---|
| 1 Scaffold | Done. Turso connection spike passed (see `docs/architecture.md`) |
| 2 Content model + admin | Built. `pnpm verify` passes (typecheck, lint, 17 tests, build). Open items below |
| 3 Design system + shell | Next |
| 4–6 | Not started |

**Phase 2 open items**
- Create the first admin account at `/admin` (the dev DB has 0 users).
- The real menu JSON from the owner: align `menu-items` (incl. `options` for e.g. chicken/beef/tofu) and replace the seeded example dishes.
- Price field: the error text only shows as a tooltip on hover. Make it visible directly at the field.
- Variant rows in the admin show "Option 01", "Option 02" instead of their labels.
- `scripts/seed.ts` still has Vietnamese example dishes and the claim "Vietnamesische und chinesische Küche".

**Changes since approval**
- The cuisine is now **Chinese**, not Vietnamese/Chinese Asian fusion. Before Phase 3, rework the
  design direction in §8: the herb-green accent was chosen to lean Vietnamese, and the "no red/gold/dragon
  clichés" rule needs a deliberately chosen visual direction for a Chinese restaurant.
- Make the cuisine type for the `Restaurant` JSON-LD a CMS field, not hard-coded.
- Folder, package and Turso dev DB are renamed to `chinese-restaurant`. Paths below that mention `asia-restaurant` are historical.
- Nothing is committed yet. Everything is on `feature/foundation`.

## Context

New project in an empty directory (`C:\Users\flori\dev\asia-restaurant`, not yet a git repo). Goal: a production-quality restaurant website (Vietnamese/Chinese-led Asian fusion) with an on-site CMS so non-technical editors can run the menu, posts, images and restaurant info. No ordering/checkout, no customer accounts, no payments. The delivery CTA points to an external URL that is configured later. This document is the pre-implementation plan the brief asked for. Nothing gets built until it is reviewed.

---

## 1. Requirements check (from the brief)

| Area | Must have |
|---|---|
| Public pages | Landing, Menu, About/Restaurant, News overview + post pages, Imprint, Privacy |
| Landing | Hero + image carousel, name + positioning line, phone (tap-to-call), address, current opening hours, Order/Delivery CTA (external URL), Menu CTA, menu highlights, latest post (only if one exists), short intro |
| Menu | Items with name, description, price, optional image, category, allergens/dietary, extra attributes/components, availability, sort order. Categories are CMS-managed: create, rename, reorder, assign |
| CMS | Integrated (no external headless SaaS). Admin auth. CRUD + publish/unpublish + reorder for items. CRUD + reorder for categories. Reusable attributes. Posts with draft/publish + image upload. Editable restaurant info: phone, address, hours, order URL, socials |
| Stack | Next.js App Router, TypeScript, SQLite-compatible DB (Turso preferred), Drizzle if appropriate. Images stored outside SQLite |
| Quality | Mobile-first, semantic HTML, a11y + keyboard, image optimisation, SEO + OG, clean URLs, loading/error states |
| Exclusions | No Supabase, no external auth provider, no payments, no customer accounts, no ordering backend |

---

## 2. Recommended CMS approach: Payload CMS 3, embedded in the Next.js app

**Recommendation:** Payload 3 installed *inside* the same Next.js App Router app, using `@payloadcms/db-sqlite` (libSQL, so it works with Turso), `@payloadcms/storage-vercel-blob` for media, and the Lexical rich-text editor.

Why:
- It is genuinely integrated. It runs in the same repo, the same deployment and the same database, with `/admin` as a route group. There is no separate CMS service, account or bill.
- The brief needs a lot of admin features: auth with login lockout, CRUD forms, validation, relationships, a media library with image resizing (sharp), drafts/publish for posts, rich text, drag-to-reorder (`orderable` collections in Payload 3.x, to be checked against the pinned version), and access control. Building all of that ourselves is the largest and riskiest part of the project, especially the auth. Payload covers it with maintained, MIT-licensed code.
- It uses **Drizzle internally** for its SQL adapters. In practice "Drizzle if appropriate" means Drizzle is present but managed by Payload. App code reads data through Payload's Local API (typed, server-only, no HTTP hop), not through hand-written Drizzle queries.
- The admin UI is accessible and keyboard-usable out of the box. Editors get a familiar CMS rather than a home-made form set.

Rejected alternative: a custom admin (Drizzle + Server Actions + an auth library). It is smaller on paper, but we would hand-build login/session security, uploads, image variants, rich text, reordering and drafts. That is more code to own and more security surface than Payload adds. File-based CMSs (Keystatic, Tina) do not fit a DB-backed menu with frequent price and availability edits.

Costs and risks to accept:
- Payload is a large dependency.
- Payload owns the schema, so migrations go through `payload migrate`.
- Upgrades follow Payload's release cadence.
- Payload is pinned to an exact version, and its docs are checked against that version during implementation (Next.js version compatibility in particular).

## 3. Is Turso (+ Drizzle) appropriate?

Yes:
- The data is small, read-heavy and low-write: a few hundred rows, edited a few times a week. SQLite is ideal for that.
- Turso gives hosted libSQL over HTTP, which suits serverless. Local dev uses a plain `file:./data/local.db` with the same adapter.

Caveats to handle:
- **Latency:** put the Turso DB in the same region as the Vercel functions (e.g. Frankfurt). Public pages are statically rendered and revalidated on publish (see §7), so visitors almost never hit the DB directly.
- **Environments:** separate Turso databases for dev/preview and production, with credentials scoped per Vercel environment.
- **Backups:** confirm Turso's point-in-time restore on the chosen plan, and add a documented `turso db shell .dump` backup step.
- **Pricing/product:** verify Turso's current plans and limits at setup time. Do not rely on recalled numbers.

## 4. Image storage

**Vercel Blob** through Payload's storage adapter:
- Payload's media collection stores only metadata (alt text, dimensions, focal point, URL) in SQLite.
- The binaries and the generated size variants go to Blob.
- The frontend serves images with `next/image`: responsive `sizes`, AVIF/WebP and lazy loading. Hero images use `priority`.
- `alt` is required at upload. Each image gets a focal point so crops work in the hero, cards and OG images.

**Upload size limit:** Vercel caps the request body that serverless functions accept (about 4.5 MB). Full-resolution restaurant photos often exceed that, so they must not fail silently:
- Enable the adapter's **`clientUploads: true`** mode, so the browser uploads directly to Blob and skips the function body limit. Check that this option exists in the pinned adapter version.
- Also enforce an explicit `upload.limits.fileSize` cap (e.g. 15 MB) and an accepted-MIME list (jpeg/png/webp/avif). Show an editor-facing error message that states the limit.
- Use `resizeOptions` to downscale stored originals to about 2560px on the long edge.
- Document the limits in `docs/content-editing.md`.
- Test in Phase 5 with a ≥10 MB camera JPEG on a Vercel preview deployment, not only locally.

Fallback if leaving Vercel: an S3-compatible adapter (Cloudflare R2) with the same collection and no data-model change. This is documented in `docs/images.md`.

---

## 5. Information architecture

Clean URLs. The examples use German paths; the final language decision is in §9.

```
/                     Landing
/speisekarte (/menu)  Full menu: sticky category nav, dietary filter, allergen legend
/restaurant           About: intro, interior gallery, team, address, hours, contact, map
/aktuelles (/news)    Post overview (published only, newest first, paginated)
/aktuelles/[slug]     Post page
/impressum            Imprint
/datenschutz          Privacy policy
/admin                Payload admin (noindex, auth required)
/sitemap.xml, /robots.txt
```

Global shell:
- Header: logo/name, nav, a **Call** button (`tel:`) and an **Order** button.
- Footer: address, hours summary, phone, socials, legal links.
- On mobile, a sticky bottom bar with Call, Order and Menu.
- The Order CTA renders only when an order URL is set. Otherwise it falls back to Call. External order links open in a new tab and are marked as external.

## 6. Content model (Payload collections and globals)

**Collections**
- `users`: admin/editor accounts. Payload auth with `maxLoginAttempts` and lockout. No public signup; only logged-in admins can create users. Single role for now.
- `media`: upload collection with `alt` (required), optional caption/credit, focal point, and size variants (thumb, card, hero, og 1200×630).
- `menu-categories`: `name`, `slug`, `description?`, `orderable` sort. Fully editor-defined; no hard-coded enum anywhere.
- `menu-items`:
  - `name`, `menuNumber?` (common on Asian menus), `description` (short)
  - `price` as **integer cents**
  - `image?` → media, `category` → menu-categories (required)
  - `attributes` → attributes (hasMany)
  - `options[]`: array of `{label, priceDelta?}` for choices like "chicken / beef / tofu" or add-ons
  - `availability`: `available | sold_out | unavailable`
  - `published` (checkbox; unpublished items are hidden)
  - `featured` (feeds "highlights")
  - `orderable` sort within category
- `attributes`:
  - `name`, `kind`: `allergen | dietary | other`
  - `code?`, `icon?`, `description?`, sort
  - **The full `name` (e.g. "Erdnüsse", "Krebstiere") is the canonical, authoritative value.** It is always shown in the menu legend and in the item's allergen list, accessible to screen readers.
  - `code?` (A–N or any other shorthand) and `icon?` are optional presentation metadata. They are never shown on their own without the full name being available on the same page.
  - Reusable across dishes. The `kind` field already separates legally relevant allergens from dietary tags (vegan, spicy…), so the legal list can be rendered and validated separately later.
- `posts`:
  - `title`, `slug` (auto from title, editable, unique), `excerpt`, `content` (Lexical rich text with inline images), `heroImage`, `publishedAt`
  - Payload **drafts** (`_status: draft | published`) with preview.

**Globals**
- `site-settings`: restaurant name, tagline/positioning, phone, email, structured address, map link + coordinates, `orderLinks[]` (`{label, url}`, so more than one delivery provider can be added later), `socialLinks[]`, default SEO description + OG image.
- `opening-hours`:
  - `weekly[]`: day plus one or more `{open, close}` slots, which allows split lunch/dinner service.
  - `exceptions[]`: `{from, to, closed | slots, note}` for holidays and temporary changes.
  - Timezone constant `Europe/Berlin` (configurable).
- `home`: hero slides (`{image, alt override?, caption?}`), intro text, optional manual highlights (otherwise `featured` items are used).
- `about`: intro rich text, interior gallery, team entries (`{image, name?, role?}`).
- `legal`: imprint and privacy rich text, seeded with clearly marked placeholders such as `[BETREIBER NAME EINTRAGEN]`. No invented company data.

**NAP single source of truth:** the restaurant name, address and phone live only in `site-settings`, and the opening hours live only in `opening-hours`. Every visible place reads from those globals through one `getRestaurantInfo()` helper in `lib/queries.ts`:
- header, footer, mobile bar
- landing info block, about page
- imprint placeholder references
- metadata and `Restaurant` JSON-LD

No other collection or global gets its own phone, address or hours field, and none of these values are hard-coded in components. A unit test checks that the JSON-LD builder and the visible components get their values from the same object.

**Supporting logic**
- `lib/opening-hours.ts` is a pure function: `getStatus(hours, now)` → `open / closed / opens at / closes at`, with exceptions taking priority. It is unit-tested because it is the one piece of real logic.
- "Open now" is computed in a small client component, so cached pages never show stale status.
- Prices are formatted with `Intl.NumberFormat('de-DE', {currency:'EUR'})`, with a note that all prices include VAT.

## 7. Rendering, caching and SEO

- Public pages are Server Components that read via Payload's Local API, using static rendering plus **on-demand revalidation**. Payload `afterChange`/`afterDelete` hooks call `revalidateTag`/`revalidatePath` for the affected pages, so a price edit goes live within seconds and visitors do not hit the DB.
- `generateMetadata` on every route:
  - Open Graph/Twitter cards built from settings and post hero images.
  - Canonical URLs.
  - `sitemap.ts` and `robots.ts`, with `/admin` disallowed and set to noindex.
- JSON-LD: `Restaurant` (address, phone, hours, menu URL), `Menu`/`MenuSection` on the menu page, `NewsArticle` on posts.
- `loading.tsx` skeletons, `error.tsx` and `not-found.tsx` per segment. Images have blur placeholders.

## 8. Design direction (brief only; detailed during the design phase)

Contemporary, warm and relaxed. Food photography carries the look.
- Palette: warm off-white "rice paper" base, deep ink/charcoal text, one fresh accent (Vietnamese-herb green), and a secondary warm clay/chili tone used sparingly. No red/gold, dragons, lanterns or brush-stroke clichés.
- Typography: one characterful contemporary sans, optionally with a modern serif for headings. Fonts are **self-hosted** via `next/font`, so no request goes to Google's servers (a GDPR pitfall in Germany).
- Carousel: CSS scroll-snap plus prev/next buttons and dot controls, keyboard operable, no autoplay (or pausable autoplay, per WCAG 2.2.2), and it respects `prefers-reduced-motion`. No carousel library.
- Menu page: sticky horizontal category chips (anchor links), a dietary filter (vegan/vegetarian/spicy) as a progressive enhancement, allergens on each item by full name (optional codes are an addition, not a replacement), and a legend. Sold-out items stay visible but muted.
- Map: **click-to-load**. It shows a static placeholder (address + "Open in Google Maps" link). The Google Maps iframe loads only after an explicit user action, with a notice that data then goes to Google. This prevents Google requests before that interaction. It does **not** settle whether a consent banner is needed: that depends on every technology on the deployed site (embeds, fonts, hosting/CDN, any analytics, admin cookies), and is decided in the legal sweep against current authoritative sources.

---

## 9. Missing requirements and decisions (need answers or accepted defaults)

1. **Language(s): DECIDED.** DE (default) + EN from the start, with more languages later via a language switcher. Payload `localization` is enabled in Phase 2 before the first content migration. Routes use a `[locale]` segment: DE without a prefix, EN under `/en`, with localized path names and `hreflang`.
   - Also decided: Germany/EU jurisdiction, placeholder name and images, a single admin role.
   - Menu options/price variants: the user will supply a JSON of the real menu data set. The `menu-items` shape (incl. `options`) is aligned to it before its migration is finalized.
2. **Jurisdiction:** assumed Germany/EU. This drives the imprint (§5 DDG), the privacy policy (GDPR), allergen info (EU FIC 1169/2011 + German LMIDV) and pricing display (PAngV, prices incl. VAT).
3. **Restaurant name, logo, brand assets, real photos:** placeholders until provided. Dev imagery must be properly licensed placeholders, and this is noted in the legal checklist.
4. **Delivery provider(s):** one order URL or several (e.g. Lieferando + Wolt)? The model supports both.
5. **Price variants:** are protein/size choices with different prices needed? Modelled as `options` with `priceDelta`. Confirm the shape.
6. **Editors:** how many people, and is a single role enough? *Default: single admin role.*
7. **Hosting:** Vercel (hosting) + Turso (DB) + Vercel Blob (images) + Cloudflare DNS, per the standard baseline. Confirm the accounts and region.
8. **Out of scope unless requested:** reservations (link or phone only), contact form, newsletter, analytics, menu PDF. Leaving out analytics and forms keeps the privacy policy and consent setup minimal.

## 10. Project structure

```
asia-restaurant/
  src/
    app/
      (frontend)/            layout, page, speisekarte/, restaurant/, aktuelles/[slug]/,
                             impressum/, datenschutz/, loading/error/not-found, sitemap.ts, robots.ts
      (payload)/             generated by Payload (admin + API routes)
    collections/             Users, Media, MenuCategories, MenuItems, Attributes, Posts
    globals/                 SiteSettings, OpeningHours, Home, About, Legal
    components/              Header, Footer, MobileActionBar, HeroCarousel, OpeningHours,
                             OpenNowBadge, MenuNav, MenuItemCard, AllergenLegend, MapConsent,
                             PostCard, RichText, OrderButton
    lib/                     payload.ts (getPayload), queries.ts, opening-hours.ts, format.ts,
                             revalidate.ts, seo.ts
    payload.config.ts
    migrations/
  scripts/seed.ts            placeholder content: EU-14 allergens, categories, sample dishes, one post
  tests/                     vitest (opening-hours, format), playwright smoke (mobile + desktop)
  docs/                      architecture.md, images.md, legal-checklist.md, content-editing.md
  .env.example               DATABASE_URL, DATABASE_AUTH_TOKEN, PAYLOAD_SECRET, BLOB_READ_WRITE_TOKEN, NEXT_PUBLIC_SITE_URL (fake values)
```

Package scripts:
- `dev`, `build`, `typecheck`, `lint`, `test`, `test:e2e`, `seed`, `migrate`
- **`verify`** = typecheck + lint + test + build

Node version pinned via `.nvmrc` + `engines`, and the lockfile is committed.

## 11. Implementation phases

1. **Scaffold:**
   - `git init`, then work on a `feature/foundation` branch.
   - Install Payload via `create-payload-app` (blank template, SQLite).
   - Pin versions after checking current Payload/Next compatibility docs.
   - **Connection spike before any schema work:** with the exact pinned versions of Payload + `@payloadcms/db-sqlite` + libSQL client, connect to a real Turso dev database (URL + auth token). Then run `payload migrate`, write and read one doc via the Local API, and build once. Record the working version combination in `docs/architecture.md`. If it fails, stop and resolve it before Phase 2.
   - Strict TS, ESLint, Vitest, Playwright, `verify` script, `.gitignore` (covering `.env*`, local db, `.next`), `.env.example`.
2. **Content model + admin:**
   - All collections and globals, access control, `orderable` sorting, slug hooks and validation.
   - Initial migration and seed script.
   - Check that editors can do every task from the brief in `/admin`.
3. **Design system + shell:** tokens, fonts, layout, header/footer/mobile action bar, Order/Call CTA logic.
4. **Public pages:** landing, menu, about (gallery + map consent), news overview/post, legal pages, all fed from the CMS.
5. **Images, SEO and caching:** Blob adapter, image sizes, `next/image`, metadata/OG, sitemap/robots, JSON-LD, revalidation hooks, loading/error/404 states.
6. **Hardening + preview deploy:**
   - a11y pass (axe), keyboard walk-through, 375px/1280px visual checks.
   - Security review of admin/access control.
   - Legal pitfall sweep and the `docs/legal-checklist.md` checklist.
   - Turso preview DB, Vercel preview environment with scoped env vars.
   - Production goes live only after real operator data replaces the placeholders.

## 12. Verification

- `npm run verify` (typecheck, lint, unit tests, production build) must pass at the end of each phase.
- Unit tests: opening-hours status (split shifts, exceptions, after-midnight closing, DST change), price formatting.
- Playwright smoke at 375px and 1280px:
  - Landing shows phone/address/hours/CTAs.
  - Menu renders categories in CMS order.
  - An unpublished item is hidden.
  - A draft post is not public.
  - `/admin` redirects to login.
- Manual end-to-end in the dev server: edit a price, reorder a category and publish a post in `/admin`, then confirm the change appears on the public page after revalidation.
- Accessibility: axe on every public route, keyboard-only navigation of the carousel, menu nav and map consent.
- Upload test: a ≥10 MB JPEG uploads successfully on a Vercel preview, and an oversized or invalid file shows a clear error.
- NAP consistency: the name/address/phone/hours in the visible pages and in the `Restaurant` JSON-LD match the CMS values. Change the phone in `/admin` and confirm every location updates.
- Legal sweep before any public launch:
  - imprint/privacy placeholders resolved
  - self-hosted fonts
  - no third-party request before the map click (checked in the network panel)
  - consent requirement assessed for the full deployed tech stack
  - allergen info complete with full names
  - image licences recorded
