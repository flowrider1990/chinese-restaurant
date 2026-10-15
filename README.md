# Xiao Chu – restaurant website (demo)

Website and CMS for a fictional Chinese restaurant in Berlin-Friedrichshain. Restaurant, address and
texts are made up, the images are AI-generated, and the menu is a placeholder modelled on a real one.

Live demo: https://chinese-restaurant-berlin.vercel.app (CMS at `/admin`; kept out of search engines)

## What it does

- Home, menu with category navigation, diet filters and an allergen filter, restaurant page with a
  self-hosted map, news, imprint and privacy. German (default, no URL prefix) and English (`/en`).
- Table reservations as requests: guests send a request, staff confirm or decline in the admin, both
  sides get e-mails; personal data is removed 30 days after the reservation date.
- Gift vouchers: Stripe Checkout (test mode only), a signed webhook marks the voucher paid, the buyer
  gets a code and a PDF by e-mail, staff redeem amounts in the admin with an append-only history.
- Everything editable in the embedded Payload CMS: menu, opening hours, texts, images, settings.
- SEO: per-page metadata, hreflang, JSON-LD (Restaurant, Menu, NewsArticle), sitemap.

## Stack

Next.js 16 (App Router) with Payload CMS 3 embedded, libSQL / Turso, plain CSS (no Tailwind),
Resend for e-mail, Stripe for payments, Vercel for hosting with Vercel Blob for images. Node 22
(`.nvmrc`), pnpm 11 (`packageManager`).

## Where things are

| Path | What |
| --- | --- |
| `src/app/(frontend)/[locale]/` | Public pages. Folders use the German URL segment; `src/proxy.ts` maps `/en/...` onto them. |
| `src/app/(payload)/` | Payload admin and REST/GraphQL API (`/admin`, `/api`). |
| `src/collections/`, `src/globals/` | CMS data model (menu, posts, media, reservations, vouchers, users; settings). |
| `src/lib/` | Logic by topic: `reservation-*`, `voucher-*`, `seo.ts`, `opening-hours.ts`, `queries.ts` (data access for pages). Pure rules are separate from Payload/Next code so they can be unit-tested. |
| `src/components/site/` | UI components of the public site. |
| `src/i18n/` | Languages, URL segments per language, UI texts (`dictionary.ts`). |
| `src/migrations/` | Database migrations (schema changes only through migrations). |
| `scripts/` | One-off and maintenance scripts (seed, image import, map, deploy migrations). |
| `tests/unit`, `tests/int` | Vitest: pure logic, and integration tests against a throwaway local DB. |
| `docs/architecture.md` | **Start here.** How everything fits together, decisions, known issues. |
| `docs/superpowers/specs/`, `plans/` | Design specs and implementation plans of the larger features (reservations, vouchers). |
| `docs/legal-checklist.md` | Open legal items before a real launch. |
| `docs/plan.md` | Project log: original plan, phases and decisions over time. Background, not required reading. |
| `AGENTS.md`, `CLAUDE.md` | Instructions for AI coding assistants used on this project; not needed by humans. |

## Local setup

```sh
pnpm install
cp .env.example .env      # fill in at least PAYLOAD_SECRET; DATABASE_URL defaults to a local file
mkdir -p data             # the local libSQL file lives in data/
pnpm migrate              # create the schema
pnpm seed                 # placeholder content (only on an empty database)
pnpm dev                  # http://localhost:3000, CMS at /admin (create the first user there)
```

Images are not in the repository (`media/` is git-ignored). Upload your own in the admin, or put image
files into `data/images-incoming/` and run `pnpm images:import` (see the script for the file names).

### Environment variables

Names only; see `.env.example` for what each one does. Required: `DATABASE_URL`, `PAYLOAD_SECRET`.
Optional locally: `DATABASE_AUTH_TOKEN` (Turso), `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`,
`EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` (without a Resend key, mails go to the server log),
`CRON_SECRET`, `STRIPE_SECRET_KEY` (test key only), `STRIPE_WEBHOOK_SECRET`,
`BLOB_READ_WRITE_TOKEN` and `MEDIA_ON_BLOB` (images on Vercel Blob), `SITE_NOINDEX` (demo only).

### Testing payments locally

```sh
stripe listen --print-secret    # put the value into .env as STRIPE_WEBHOOK_SECRET
stripe listen --forward-to localhost:3000/api/vouchers/stripe-webhook \
  --events checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed
```

Then buy a voucher on `/gutscheine` with the test card `4242 4242 4242 4242`, any future expiry date
and any CVC.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm verify` | Typecheck, lint, all tests, production build. Run before every merge. |
| `pnpm test` | Unit and integration tests (Vitest; integration tests use `data/test.db`) |
| `pnpm typecheck` / `pnpm lint` | Single checks |
| `pnpm migrate:create <name>` | New migration after a schema change (check the generated SQL, see Known issues in the architecture doc) |
| `pnpm migrate` | Apply pending migrations to the database in `.env` |
| `pnpm generate:types` | Regenerate `src/payload-types.ts` after a schema change |
| `pnpm seed` | Placeholder content on an empty database |
| `pnpm images:import` | Import placeholder images from `data/images-incoming/` |
| `pnpm map:generate` | Rebuild the restaurant map SVG from OpenStreetMap data |
| `pnpm reservations:cleanup` | Remove expired reservation personal data (runs daily on Vercel) |
| `pnpm media:to-blob <dir>` | Upload local media files to Vercel Blob (`--dry-run` first) |
| `pnpm demo:post` | Add the second demo news post |
| `pnpm migrate:deploy` | Migrations during the Vercel build (fails the build if anything is not applied) |

## Deployment

Vercel project linked to this repository; only `main` deploys. The build runs `pnpm migrate:deploy`
and then `next build`. Region, Blob storage, cron job, environment variables per environment and the
demo's `noindex` switch are described in `docs/architecture.md` under "Hosting (Vercel)".
