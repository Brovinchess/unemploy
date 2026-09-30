import { eq } from "drizzle-orm";
import { Check, CircleHelp, ExternalLink, X } from "lucide-react";
import { db, schema } from "@/db";
import type { Job } from "@/db/schema";
import { CopyBlock } from "./copy-block";
import { JobActions } from "./job-actions";
import { JobTags, linkSource, MatchBadge, postedAgo } from "./job-card";
import { CompanyMark } from "./logo";

const STATUS_NOTE: Partial<Record<string, string>> = {
  applied: "You applied for this job.",
  heard_back: "You heard back from this company.",
  interview: "You have an interview for this job.",
  offer: "You got an offer for this job.",
  rejected: "This application was unsuccessful.",
  skipped: "You skipped this job.",
  expired: "This posting has closed. Your headhunter's daily check found it no longer accepts applications.",
};

export async function JobDetail({ job, doneHref }: { job: Job; doneHref: string }) {
  const pack = await db.query.packs.findFirst({ where: eq(schema.packs.jobId, job.id) });
  const posted = postedAgo(job.postedAt);
  const source = linkSource(job.url);

  return (
    <article className="card overflow-hidden">
      <div className="border-b border-line p-6">
        <div className="flex items-start gap-4">
          <CompanyMark name={job.company} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-muted">{job.company}</p>
            <h1 className="font-display text-2xl font-medium leading-tight tracking-tight text-ink">{job.title}</h1>
          </div>
          <MatchBadge score={job.matchScore} />
        </div>
        <div className="mt-4">
          <JobTags job={job} />
        </div>
        <p className="mt-3 text-sm text-muted">
          {[job.level, posted && `Posted ${posted.text}`, !job.salary && "Salary not listed", source && `Link via ${source}`]
            .filter(Boolean)
            .join(" · ")}
          {posted && posted.days > 30 && <span className="ml-2 text-rose">Older posting, may already be filled</span>}
          {job.demo && <span className="ml-2 text-rose">Demo job, not a real posting</span>}
        </p>
        {STATUS_NOTE[job.status] ? (
          <p className="mt-5 rounded-xl bg-mist-soft px-4 py-3 text-sm">{STATUS_NOTE[job.status]}</p>
        ) : (
          <JobActions key={job.id} jobId={job.id} url={job.url} status={job.status} doneHref={doneHref} />
        )}
      </div>

      <div className="space-y-8 p-6">
        {job.verifiedAt && job.locationText && (
          <section className="rounded-2xl bg-night-2 p-5">
            <h2 className="font-display flex items-center gap-2 font-medium text-white">
              <span className="flex size-5 items-center justify-center rounded-full bg-coral">
                <Check className="size-3 text-white" strokeWidth={3} aria-hidden />
              </span>
              Checked for you
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              <CheckRow ok>
                Open for applications, checked {ago(job.lastCheckedAt ?? job.verifiedAt)} on the employer&rsquo;s own page
              </CheckRow>
              <CheckRow ok>
                Who can apply: <span className="text-white/60">&ldquo;{job.locationText}&rdquo;</span>
              </CheckRow>
              <CheckRow ok={job.salary ? true : undefined}>
                {job.salary ? `Pay: ${job.salary}` : "Pay isn't listed on the posting"}
              </CheckRow>
            </ul>
            {job.mustHaves && job.mustHaves.length > 0 && (
              <>
                <p className="mt-5 text-xs font-medium uppercase tracking-wider text-white/40">What they require</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {job.mustHaves.map((m) => (
                    <CheckRow key={m.requirement} ok={m.met} bad={!m.met}>
                      {m.requirement}
                      {!m.met && <span className="text-rose"> · you don&rsquo;t show this yet</span>}
                    </CheckRow>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        <section>
          <h2 className="font-display font-medium text-ink">Why it fits</h2>
          <p className="mt-2 leading-relaxed">{job.whyFit}</p>
        </section>

        <section>
          <h2 className="font-display font-medium text-ink">Where you fall short</h2>
          {job.gaps.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
              {job.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted">Nothing major. You match what they&rsquo;re asking for.</p>
          )}
        </section>

        {job.companyNotes && (
          <section>
            <h2 className="font-display font-medium text-ink">About {job.company}</h2>
            <p className="mt-2 leading-relaxed">{job.companyNotes}</p>
          </section>
        )}

        {pack && (
          <section className="border-t border-line pt-8">
            <h2 className="font-display text-lg font-medium text-ink">Your application pack</h2>
            <p className="mt-1 text-sm text-muted">
              Copy these into the application form. Everything is based on your resume. Read it through before you
              send it.
            </p>
            <div className="mt-5 space-y-3">
              <CopyBlock title="Cover letter" text={pack.coverLetter} />
              <CopyBlock title="About me" text={pack.aboutMe} />
              {pack.answers.map((a) => (
                <CopyBlock key={a.question} title={a.question} text={a.answer} />
              ))}
            </div>
            <details className="mt-5 text-sm">
              <summary className="cursor-pointer font-medium text-muted hover:text-ink">
                Where each claim comes from in your resume
              </summary>
              <ul className="mt-3 space-y-2">
                {pack.claims.map((c) => (
                  <li key={c.claim + c.evidence} className="rounded-xl bg-canvas px-4 py-3">
                    <span className="font-semibold">{c.claim}</span>
                    <span className="mt-0.5 block text-muted">&ldquo;{c.evidence}&rdquo;</span>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        )}

        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-navy underline decoration-mist underline-offset-4"
        >
          View the original posting <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>
    </article>
  );
}

function ago(d: Date) {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

function CheckRow({ ok, bad, children }: { ok?: boolean; bad?: boolean; children: React.ReactNode }) {
  const Icon = bad ? X : ok ? Check : CircleHelp;
  return (
    <li className="flex gap-3">
      <Icon className={`mt-0.5 size-4 shrink-0 ${bad ? "text-rose" : ok ? "text-coral" : "text-white/40"}`} strokeWidth={2.5} aria-hidden />
      <span className="text-white/80">{children}</span>
    </li>
  );
}
