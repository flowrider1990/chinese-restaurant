# Chinese restaurant website

Next.js (App Router) with embedded Payload CMS (`/admin`) and libSQL/Turso.
See [docs/architecture.md](docs/architecture.md).

## Setup

```sh
pnpm install
cp .env.example .env   # then fill in DATABASE_URL, DATABASE_AUTH_TOKEN, PAYLOAD_SECRET
pnpm migrate           # apply migrations
pnpm seed              # optional: placeholder content on an empty database
pnpm dev               # http://localhost:3000, CMS at /admin
```

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm verify` | typecheck, lint, tests, production build |
| `pnpm migrate:create <name>` | new migration after a schema change |
| `pnpm migrate` | apply pending migrations |
| `pnpm spike:db` | connection check against the configured database |
