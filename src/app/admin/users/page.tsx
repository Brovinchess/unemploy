import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { when } from "@/lib/admin";
import { Table } from "../ui";

export default async function Users() {
  const [users, profiles, searches, jobs, tokens] = await Promise.all([
    db.query.users.findMany({ orderBy: desc(schema.users.createdAt) }),
    db.query.profiles.findMany(),
    db.query.searches.findMany({ columns: { profileId: true, startedAt: true, cognitionUsed: true, jobsAdded: true } }),
    db.query.jobs.findMany({ columns: { profileId: true, status: true } }),
    db.query.extensionTokens.findMany({ columns: { userId: true, lastUsedAt: true } }),
  ]);
  const byUser = new Map(users.map((u) => [u.id, u.username ?? "?"]));
  const rows = users.map((u) => {
    const mine = profiles.filter((p) => p.userId === u.id);
    const ids = new Set(mine.map((p) => p.id));
    const s = searches.filter((x) => ids.has(x.profileId));
    const j = jobs.filter((x) => ids.has(x.profileId));
    const last = s.map((x) => x.startedAt).sort((a, b) => b.getTime() - a.getTime())[0];
    const hh = mine.find((p) => p.status === "hunting" || p.status === "paused") ?? mine[0];
    const tok = tokens.find((t) => t.userId === u.id);
    const referrer = u.referredBy ? users.find((x) => x.referralCode === u.referredBy) : null;
    return [
      u.username ?? "(no name yet)",
      when(u.createdAt).slice(0, 10),
      hh ? `${hh.label} · ${hh.status}${hh.mindName ? ` · ${hh.mindName}` : ""}` : "none",
      s.length,
      j.length,
      j.filter((x) => ["applied", "heard_back", "interview", "offer"].includes(x.status)).length,
      Math.round(s.reduce((a, x) => a + Number(x.cognitionUsed ?? 0), 0)),
      last ? when(last) : "",
      [u.emailVerifiedAt ? "email" : null, tok ? "extension" : null, referrer ? `via ${byUser.get(referrer.id)}` : null].filter(Boolean).join(", "),
    ];
  });
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <p className="text-sm text-white/45">Users</p>
      <h1 className="font-display mt-1 text-3xl font-medium">{users.length} accounts</h1>
      <p className="mt-2 text-sm text-white/55">{users.filter((u) => profiles.some((p) => p.userId === u.id && p.mindId)).length} deployed a headhunter. {users.filter((u) => !u.username).length} never finished the name step.</p>
      <div className="mt-6">
        <Table head={["User", "Joined", "Headhunter", "Searches", "Jobs", "Applied+", "Cognition", "Last search", "Flags"]} rows={rows} />
      </div>
    </main>
  );
}
