import "server-only";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";

// Local file in development; point DATABASE_URL at Turso (libsql://…) in production.
// Without one on Vercel, fall back to /tmp: fine for a demo, but data does not survive
// cold starts and is not shared between instances.
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.VERCEL) {
    console.warn("[db] DATABASE_URL not set; using a temporary database in /tmp");
    return "file:/tmp/unemploy.db";
  }
  return "file:./data/unemploy.db";
}

const client = createClient({ url: databaseUrl(), authToken: process.env.DATABASE_AUTH_TOKEN });

export const db = drizzle(client, { schema });
export { schema };

// Apply pending migrations once per server instance, before any query runs
// (not while `next build` collects pages: no queries run then).
if (process.env.NEXT_PHASE !== "phase-production-build") {
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}
