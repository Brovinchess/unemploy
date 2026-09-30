import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Local file in development; point DATABASE_URL at Turso (libsql://…) in production.
const client = createClient({
  url: process.env.DATABASE_URL ?? "file:./data/unemploy.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export { schema };
