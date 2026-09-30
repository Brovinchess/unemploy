import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: process.env.DATABASE_URL?.startsWith("libsql://") ? "turso" : "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./data/unemploy.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  } as { url: string },
});
