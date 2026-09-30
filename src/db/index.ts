import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

// Supabase Postgres in production (on Vercel, use the pooler's transaction-mode URL).
// Locally, `npm run db:local` starts a Postgres-compatible server; see README.
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // `next build` imports this module without running queries; postgres() connects lazily.
  if (process.env.NEXT_PHASE === "phase-production-build") return "postgres://build@localhost/build";
  throw new Error("DATABASE_URL is not set. See README → Database.");
}

const url = databaseUrl();
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);

const g = globalThis as unknown as { __unemploySql?: postgres.Sql };
// Reuse one client across hot reloads in development.
const client = (g.__unemploySql ??= postgres(url, {
  prepare: false, // required by Supabase's transaction pooler
  max: local ? 1 : 5,
  ssl: local ? false : "require",
}));

export const db = drizzle(client, { schema });
export { schema };
