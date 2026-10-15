import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { tally, when } from "@/lib/admin";
import { Counts, Table } from "../ui";

export default async function Waitlist() {
  const rows = await db.query.waitlist.findMany({ orderBy: desc(schema.waitlist.createdAt) });
  const users = await db.query.users.findMany({ columns: { email: true } });
  const joined = new Set(users.map((u) => u.email?.toLowerCase()).filter(Boolean));
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <p className="text-sm text-white/45">Waitlist</p>
      <h1 className="font-display mt-1 text-3xl font-medium">{rows.length} on the waitlist</h1>
      <p className="mt-2 text-sm text-white/55">{rows.filter((r) => r.verifiedAt).length} verified their email. {rows.filter((r) => joined.has(r.email.toLowerCase())).length} have since signed up with the same email.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Counts title="Country" total={rows.length} rows={tally(rows, (r) => r.country ?? "unknown")} />
        <Counts title="Role area" total={rows.length} rows={tally(rows, (r) => r.roleArea ?? "unknown")} />
      </div>
      <div className="mt-6">
        <Table head={["Joined", "Name", "Email", "Country", "Role area", "Verified", "Signed up"]} rows={rows.map((r) => [when(r.createdAt), r.name ?? "", r.email, r.country ?? "", r.roleArea ?? "", r.verifiedAt ? "yes" : "no", joined.has(r.email.toLowerCase()) ? "yes" : ""])} />
      </div>
    </main>
  );
}
