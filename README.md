# Unemploy

Your own AI headhunter. Each user launches a Hello Minds agent (a Mind) per resume. The Mind finds matching jobs every day and writes an application pack for each; Unemploy checks every pack against the resume and shows the user a shortlist to act on.

Plan: https://claude.ai/code/artifact/ddb1d976-1ebc-44a7-b390-40dfbc2ff66c

## Run it

```bash
npm install
cp .env.example .env.local
npx drizzle-kit push
npm run dev
```

With `HM_CLIENT_ID` empty the app runs in **demo mode**: sign-in, the Mind, top-ups and job delivery are simulated, so no cognition is spent. Demo-only shortcuts appear on the activate and resume steps.

## Live mode

1. Create an OAuth client in the Hello Minds Build console with redirect URI `$APP_URL/auth/callback`.
2. Set `HM_CLIENT_ID` and `APP_URL` in `.env.local`.
3. `APP_URL` must be reachable from the internet: Minds POST their jobs to `$APP_URL/api/ingest`. For local testing, use a tunnel.

## How it fits together

| Piece | Where |
| --- | --- |
| Hello Minds OAuth (PKCE) and token refresh | `src/lib/minds/oauth.ts`, `src/lib/minds/client.ts` |
| Simulated Mind for demo mode | `src/lib/minds/mock.ts` |
| Brief sent to each Mind, and the ingest contract | `src/lib/brief.ts` (contract served at `GET /api/ingest?brief=1`) |
| Ingest endpoint: validates every job and pack | `src/app/api/ingest/route.ts`, `src/lib/ingest.ts` |
| Setup: launch, activate, resume, preferences | `src/app/profiles/[id]/setup` |
| Shortlist, tracker, settings | `src/app/app` |
| Database schema (SQLite locally, Turso in production) | `src/db/schema.ts` |

The ingest endpoint rejects, with a hint the Mind can act on: unwanted work settings, jobs outside the user's country, avoided companies, any claim whose evidence isn't quoted word for word from the resume, duplicates, dead links, and anything over the user's daily limit. Every reply also carries the user's recent skip reasons, so the Mind learns without an extra billed message.
