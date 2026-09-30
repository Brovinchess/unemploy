import { defineConfig } from "drizzle-kit";

// `npx drizzle-kit migrate` applies ./drizzle to the database in DATABASE_URL (Supabase).
// Use the direct or session-mode connection string for migrations.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
