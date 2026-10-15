import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { Ninja } from "@/components/brand";
import { appContext, balanceFor } from "@/lib/app-context";
import { ApplicantForm } from "../settings/applicant-form";
import { SavedAnswers } from "../settings/saved-answers";
import { QuestionList } from "./answers-ui";

// Everything forms ask about the person, answered once. The headhunter answers what it can
// from the details and saved answers below (checked here once); the rest is asked here.
// Approved or typed answers become saved answers the extension fills from.
export default async function YouPage() {
  const { user, profiles, unfinished, current } = await appContext();
  const [balance, rows] = await Promise.all([
    balanceFor(user, current),
    db.query.questions.findMany({
      where: and(eq(schema.questions.userId, user.id), inArray(schema.questions.status, ["needs_you", "review", "new", "asked"])),
      orderBy: [desc(schema.questions.createdAt)],
    }),
  ]);
  const item = (r: (typeof rows)[number]) => ({ id: r.id, question: r.question, options: r.options ?? [], answer: r.answer ?? "", note: r.note, company: r.company });
  // "new" and "asked" are from before the headhunter answered these itself; the person answers them.
  const forYou = rows.filter((r) => r.status !== "review").map(item);
  const toCheck = rows.filter((r) => r.status === "review").map(item);

  return (
    <AppShell tab="you" user={user} profiles={profiles} unfinished={unfinished} current={current} balance={balance}>
      <main className="w-full max-w-4xl flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <p className="text-sm text-white/45">About you</p>
        <h1 className="font-display mt-1 text-3xl font-medium tracking-tight text-white">You</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-white/55">
          Everything forms ask about you, answered once. Your headhunter answers what it can from your details below; the rest
          comes to you here. Each answer is remembered and ready for the next form.
        </p>

        <div className="mt-8 space-y-4">
          <section className="rounded-3xl bg-surface p-6 md:p-8">
            <div className="flex items-start gap-4">
              <Ninja mood={forYou.length ? "thinking" : "happy"} className="size-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display font-medium text-white">
                  Needs you <span className="text-white/35">{forYou.length || ""}</span>
                </h2>
                <p className="mt-1 text-sm text-white/50">Only you know these. Answer once and you won&rsquo;t be asked again.</p>
              </div>
            </div>
            <QuestionList items={forYou} mode="answer" empty="Nothing to answer right now. Questions arrive when you say yes to a job." />
          </section>

          {toCheck.length > 0 && (
            <section className="rounded-3xl bg-surface p-6 md:p-8">
              <h2 className="font-display font-medium text-white">
                Check these <span className="text-white/35">{toCheck.length}</span>
              </h2>
              <p className="mt-1 text-sm text-white/50">Your headhunter answered these from your details. Approve or fix each one.</p>
              <QuestionList items={toCheck} mode="review" empty="Nothing to check." />
            </section>
          )}

          <section id="saved" className="scroll-mt-8 rounded-3xl bg-surface p-6 md:p-8">
            <h2 className="mb-3 font-display font-medium text-white">Saved answers</h2>
            <SavedAnswers answers={(user.savedAnswers ?? []).map(({ question, answer, updatedAt, field }) => ({ question, answer, updatedAt, field: field ?? null }))} />
          </section>

          <section id="application" className="scroll-mt-8 rounded-3xl bg-surface p-6 md:p-8">
            <h2 className="font-display font-medium text-white">Application details</h2>
            <p className="mt-1 mb-5 text-sm text-white/50">Your name, contact details and basics, kept here for every application and shared with your headhunter.</p>
            <ApplicantForm initial={user.applicant ?? null} />
          </section>
        </div>
      </main>
    </AppShell>
  );
}
