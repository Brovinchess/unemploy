import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { appContext, balanceFor } from "@/lib/app-context";
import { mindsConfig, mindsMode } from "@/lib/minds/config";
import { questionCounts } from "@/lib/personal";
import { ApplicantForm } from "../settings/applicant-form";
import { SavedAnswers } from "../settings/saved-answers";
import { PersonalMindCard, QuestionList } from "./answers-ui";

// The personal Mind and the form questions it answers. Each answer is checked once here;
// after that the extension fills it in by itself.
export default async function YouPage() {
  const { user, profiles, unfinished, current } = await appContext();
  const [balance, counts, rows] = await Promise.all([
    balanceFor(user, current),
    questionCounts(user.id),
    db.query.questions.findMany({
      where: and(eq(schema.questions.userId, user.id), inArray(schema.questions.status, ["needs_you", "review"])),
      orderBy: desc(schema.questions.answeredAt),
    }),
  ]);
  const pick = (status: string) =>
    rows
      .filter((r) => r.status === status)
      .map((r) => ({ id: r.id, question: r.question, options: r.options ?? [], answer: r.answer ?? "", note: r.note, company: r.company }));

  return (
    <AppShell tab="you" user={user} profiles={profiles} unfinished={unfinished} current={current} balance={balance}>
      <main className="w-full max-w-4xl flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <p className="text-sm text-white/45">About you</p>
        <h1 className="font-display mt-1 text-3xl font-medium tracking-tight text-white">You</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-white/55">
          Everything forms ask about you, answered once. Your personal Mind drafts answers from your resume and details; you
          check each one once, and the extension fills it in from then on.
        </p>

        <div className="mt-8 space-y-4">
          <PersonalMindCard
            state={!user.personalMindId ? "none" : !user.personalBriefedAt ? "unfunded" : "ready"}
            name={user.personalMindName}
            balance={null}
            waiting={counts.new}
            answering={counts.asked}
            topUpUrl={mindsConfig.topUpUrl}
            mock={mindsMode === "mock"}
          />

          <section className="rounded-3xl bg-surface p-6 md:p-8">
            <h2 className="font-display font-medium text-white">
              Needs you <span className="text-white/35">{counts.needs_you || ""}</span>
            </h2>
            <p className="mt-1 text-sm text-white/50">Only you know these. Answer once and it remembers.</p>
            <QuestionList items={pick("needs_you")} mode="answer" empty="Nothing to answer right now." />
          </section>

          <section className="rounded-3xl bg-surface p-6 md:p-8">
            <h2 className="font-display font-medium text-white">
              Check these <span className="text-white/35">{counts.review || ""}</span>
            </h2>
            <p className="mt-1 text-sm text-white/50">Drafted for you. Approve or fix each one, and you won&rsquo;t be asked again.</p>
            <QuestionList items={pick("review")} mode="review" empty="Nothing to check." />
          </section>

          <section id="saved" className="scroll-mt-8 rounded-3xl bg-surface p-6 md:p-8">
            <h2 className="mb-3 font-display font-medium text-white">Saved answers</h2>
            <SavedAnswers answers={(user.savedAnswers ?? []).map(({ question, answer, updatedAt, field }) => ({ question, answer, updatedAt, field: field ?? null }))} />
          </section>

          <section id="application" className="scroll-mt-8 rounded-3xl bg-surface p-6 md:p-8">
            <h2 className="font-display font-medium text-white">Application details</h2>
            <p className="mt-1 mb-5 text-sm text-white/50">Your name, contact details and basics, typed into every form by the extension.</p>
            <ApplicantForm initial={user.applicant ?? null} />
          </section>
        </div>
      </main>
    </AppShell>
  );
}
