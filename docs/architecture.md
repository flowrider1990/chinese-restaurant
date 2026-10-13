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

## Content model (Phase 2)

| Admin group | Type | Purpose |
| --- | --- | --- |
| Speisekarte | `menu-items` | Dishes: number, name, description, price (cents), category, image, attributes, options (label + surcharge), published, availability, featured. Drag & drop order |
| Speisekarte | `menu-categories` | Editor-defined categories, drag & drop order, per-language slug |
| Speisekarte | `attributes` | Reusable allergens/dietary/other tags. `kind` separates legal allergens; the full `name` is authoritative, `code` is optional display shorthand |
| Inhalte | `posts` | News with drafts/published, per-language slug, `publishedAt` auto-set on first publish |
| Inhalte | `media` | Images (alt text required), WebP size variants, focal point, max 15 MB |
| Administration | `users` | Single admin role, login lockout after 5 failed attempts (15 min) |
| Einstellungen | `site-settings` | **Only** source of name, address, phone, order links, socials, default SEO |
| Einstellungen | `opening-hours` | **Only** source of weekly hours (multiple slots per day) and exceptions |
| Seiten | `home`, `about`, `legal` | Page content; legal texts are seeded as marked placeholders |

- Prices are integer cents and edited as "12,90" through `src/components/admin/PriceField.tsx`.
- Public read rules: unpublished dishes and draft posts are hidden from anonymous requests.
  All writes require login.
- The admin UI is German (English switchable). Content languages are DE (default, fallback) and EN.

## Seed and tests

- `pnpm seed` fills an **empty** database with placeholder content: the 14 EU allergens, 4
  dietary/other tags, 8 categories, 9 example dishes, 1 post and all globals. Every value is a
  placeholder; the real menu replaces the example dishes.
- `pnpm test` runs unit tests and integration tests. Integration tests use a throwaway
  `data/test.db` and never touch the dev or Turso database.
