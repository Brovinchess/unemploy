import "server-only";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { MindsApi } from "./client";

// A stand-in for Hello Minds so the full journey runs locally with no cognition spent.
// State lives in memory per server instance (the database is the real store).
type MockState = { balances: Map<string, number>; conversations: Map<string, string>; names: Set<string> };
const g = globalThis as unknown as { __unemployMock?: MockState };
const state = (g.__unemployMock ??= { balances: new Map(), conversations: new Map(), names: new Set() });

export const mockMinds: MindsApi = {
  async isNameAvailable(name) {
    return !state.names.has(name);
  },
  async awaken(_archetype, mindName) {
    state.names.add(mindName);
    const mindId = crypto.randomUUID();
    state.balances.set(mindId, 0); // like a real new Mind: nearly empty
    return { mindId, name: mindName };
  },
  async getBalance(mindId) {
    return state.balances.get(mindId) ?? 160;
  },
  async createConversation(alias, mindId) {
    state.conversations.set(alias, mindId);
  },
  async sendMessage(alias, text) {
    if (text.includes("/api/ingest")) scheduleHunt(alias);
  },
  async beacon() {},
  async setEnabled() {},
};

export function mockTopUp(mindId: string, amount = 160) {
  state.balances.set(mindId, (state.balances.get(mindId) ?? 0) + amount);
}

// Runs after the response is sent, so it also works on serverless hosts.
function scheduleHunt(alias: string) {
  after(async () => {
    await new Promise((r) => setTimeout(r, 6000));
    await runMockHunt(alias).catch((e) => console.error("[mock mind] hunt failed", e));
  });
}

const COMPANIES = [
  { name: "Northwind Labs", notes: "Series B software company, about 180 people, known for a strong design culture." },
  { name: "Cobalt & Pine", notes: "Independent studio working with retail and hospitality brands across the region." },
  { name: "Meridian Health", notes: "Digital health group with clinics in three countries; growing its product team." },
  { name: "Kitefly", notes: "Travel booking platform; profitable, with a small remote-friendly team." },
  { name: "Fernhill Bank", notes: "Mid-size bank modernising its customer apps; stable, with good benefits." },
  { name: "Orbit Logistics", notes: "Shipping and warehouse software; recently raised funding to expand in Asia." },
  { name: "Lumen Education", notes: "Online learning company serving universities; mission-driven, hybrid work." },
];

function resumeLines(text: string) {
  return text
    .split(/\n|(?<=[.!?])\s+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 25 && l.length <= 180);
}

async function runMockHunt(alias: string) {
  const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.conversationAlias, alias) });
  if (!profile?.preferences || !profile.resumeText) return;
  const prefs = profile.preferences;
  const lines = resumeLines(profile.resumeText);
  const pick = (i: number) => lines[i % Math.max(1, lines.length)] ?? profile.resumeText!.slice(0, 120).trim();
  const roles = prefs.targetRoles.split(/,|\/| or /i).map((r) => r.trim()).filter(Boolean);

  const count = Math.min(prefs.jobsPerDay, COMPANIES.length);
  const jobs = Array.from({ length: count }, (_, i) => {
    const company = COMPANIES[(i + profile.id.charCodeAt(0)) % COMPANIES.length];
    const role = roles[i % roles.length] ?? "Specialist";
    const setting = prefs.workSettings[i % prefs.workSettings.length];
    const e1 = pick(i * 2);
    const e2 = pick(i * 2 + 1);
    const slug = `${company.name}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return {
      url: `https://example.com/demo-jobs/${slug}-${profile.id.slice(0, 6)}-${i}`,
      title: role.replace(/\b\w/g, (c) => c.toUpperCase()),
      company: company.name,
      city: setting === "remote" ? undefined : prefs.city || undefined,
      country: prefs.country,
      workSetting: setting,
      jobType: prefs.jobTypes[0],
      level: prefs.levels[0],
      salary: prefs.minSalary ? `From ${prefs.minSalary}` : undefined,
      postedAt: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
      matchScore: 92 - i * 4,
      whyFit: `Your experience lines up with what ${company.name} asks for. In particular: "${e1}"`,
      gaps: i % 2 ? ["The posting prefers someone who has managed a team; your resume doesn't show that yet."] : [],
      companyNotes: company.notes,
      pack: {
        coverLetter:
          `Dear ${company.name} hiring team,\n\n` +
          `I'm applying for the ${role} role. ${e1}\n\n` +
          `${e2}\n\n` +
          `I'd welcome the chance to talk about how I can help ${company.name}.\n\nKind regards`,
        aboutMe: `${e1} ${e2}`,
        answers: [
          { question: "Why do you want to work here?", answer: `${company.notes} That matches the work I've been doing.` },
          { question: "What is your notice period?", answer: "Please fill in your own notice period." },
        ],
        claims: [
          { claim: "Relevant experience", evidence: e1 },
          { claim: "Supporting experience", evidence: e2 },
        ],
      },
    };
  });

  const { processPush } = await import("../ingest");
  const result = await processPush(profile, { jobs }, { demo: true });
  console.log(`[mock mind] ${alias}: accepted ${result.accepted}, rejected ${result.rejected.length}`);
}
