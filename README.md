# Career Ninja

Career Ninja (formerly Unemploy) is your own AI headhunter. Each user launches a Hello Minds agent (a Mind) per resume. The Mind finds matching jobs every day and writes an application pack for each; Unemploy checks every pack against the resume and shows the user a shortlist to act on.

Plan: https://claude.ai/code/artifact/ddb1d976-1ebc-44a7-b390-40dfbc2ff66c

## Run it

```bash
npm install
cp .env.example .env.local   # then set DATABASE_URL (see Database)
npm run dev
```

With `HM_CLIENT_ID` empty the app runs in **demo mode**: sign-in, the Mind, top-ups and job delivery are simulated, so no cognition is spent. Demo-only shortcuts appear on the activate and resume steps.

## Database

Postgres (Supabase in production). Tables are defined in `src/db/schema.ts`; migrations live in `drizzle/`.

| Table | Holds |
| --- | --- |
| `users` | One row per Hello Minds account: username, time zone, OAuth tokens |
| `sessions` | Sign-in sessions (cookie id → user) |
| `profiles` | One per headhunter: its Mind, resume, preferences, ingest key hash, status |
| `jobs` | Jobs the Mind delivered, with match score, fit notes and the user's status |
| `packs` | The application pack for each job: cover letter, answers, claims with resume evidence |
| `ingest_log` | Every push a Mind made, accepted or rejected, with reasons |

Row Level Security is on for every table with no policies, so Supabase's public Data API can't read them; the app connects directly as the database owner.

- **Production:** set `DATABASE_URL` to Supabase's pooler connection string in **transaction mode** (port 6543), in Vercel → Settings → Environment Variables.
- **Schema changes:** edit `src/db/schema.ts`, run `npx drizzle-kit generate`, then `npm run db:migrate` with `DATABASE_URL` pointing at Supabase (session mode, port 5432).
- **Local testing without Supabase:** `npm run db:local` starts a Postgres-compatible server on port 5433 (data in `./data`). Set `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres` and run `npm run db:migrate` once.

## Live mode

1. OAuth client "Career Ninja" in the Hello Minds Build console (client id `9d700784-07a2-4ef9-a906-152c00b04528`), redirect URIs `https://careerninja.app/auth/callback` and `http://localhost:3000/auth/callback`. (An older client named "Unemploy" also exists; its name can't be changed.)
2. Environment: `HM_CLIENT_ID`, `APP_URL`, `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET` (see `.env.example`).
3. `APP_URL` must be reachable from the internet: Minds POST their jobs to `$APP_URL/api/ingest`.

In production:

- OAuth tokens are encrypted at rest (AES-256-GCM) and refreshed under a row lock, so concurrent server instances never double-spend a rotating refresh token.
- A daily cron (`vercel.json`) nudges headhunters that have been quiet for 30+ hours, at most once a day for three days, and clears expired sessions.
- The ingest endpoint only checks public http(s) job links, never follows redirects, and caps request size.

## How it fits together

| Piece | Where |
| --- | --- |
| Hello Minds OAuth (PKCE) and token refresh | `src/lib/minds/oauth.ts`, `src/lib/minds/client.ts` |
| Simulated Mind for demo mode | `src/lib/minds/mock.ts` |
| Brief sent to each Mind, and the ingest contract | `src/lib/brief.ts` (contract served at `GET /api/ingest?brief=1`) |
| Ingest endpoint: validates every job and pack | `src/app/api/ingest/route.ts`, `src/lib/ingest.ts` |
| Setup: launch, activate, resume, preferences | `src/app/profiles/[id]/setup` |
| Shortlist, tracker, settings | `src/app/app` |
| Database schema | `src/db/schema.ts`, `drizzle/` |

The ingest endpoint rejects, with a hint the Mind can act on: unwanted work settings, jobs outside the user's country, avoided companies, any claim whose evidence isn't quoted word for word from the resume, duplicates, dead links, and anything over the user's daily limit. Every reply also carries the user's recent skip reasons, so the Mind learns without an extra billed message.
