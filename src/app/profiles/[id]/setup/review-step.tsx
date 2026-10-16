"use client";

import { useActionState, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { discardGeneratedResume, saveReviewedResume } from "@/app/actions";
import { FormError } from "@/components/onboarding-shell";

// The resume the app wrote from the blanks, laid out like a page, with the text one click
// away for edits. The PDF is remade from whatever is saved.
export function ReviewStep({ profileId, text }: { profileId: string; text: string }) {
  const [state, action, pending] = useActionState(saveReviewedResume.bind(null, profileId), undefined);
  const [discarding, startDiscard] = useTransition();
  const [editing, setEditing] = useState(false);
  const plain = text.replace(/^#+\s*/gm, "");
  const [draft, setDraft] = useState(plain);
  const lines = draft.split("\n");
  const name = lines[0] ?? "";
  const body = lines.slice(1);

  return (
    <form action={action} className="w-full">
      <input type="hidden" name="text" value={draft} />
      <div className="rounded-3xl bg-white p-7 text-[#1c2430] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] sm:p-9">
        {editing ? (
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={Math.min(28, lines.length + 2)} className="w-full resize-y rounded-xl border border-black/10 bg-[#f7f8fa] p-4 font-mono text-[13px] leading-relaxed text-[#1c2430] outline-none focus:border-coral" autoFocus />
        ) : (
          <div className="font-sans">
            <p className="font-display text-2xl font-semibold tracking-tight">{name}</p>
            <div className="mt-1 space-y-0.5 text-[15px] leading-relaxed">
              {body.map((l, i) => {
                const t = l.trim();
                if (!t) return <div key={i} className="h-3" />;
                if (/^[A-Z][A-Z ]{2,}$/.test(t)) return <p key={i} className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a93a0]">{t}</p>;
                if (t.startsWith("- ")) return <p key={i} className="pl-4 text-[#3a4452]">• {t.slice(2)}</p>;
                return <p key={i} className={i === 0 ? "text-[#5b6675]" : ""}>{t}</p>;
              })}
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <p className="text-muted">Good enough to start. Your headhunter only ever quotes what is here.</p>
        <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={() => setEditing((v) => !v)}>
          <Pencil className="size-3.5" aria-hidden /> {editing ? "Done editing" : "Edit"}
        </button>
      </div>
      <FormError message={state?.error} />
      <button className="btn btn-primary mt-6 h-12 w-full" disabled={pending}>
        {pending ? "Saving…" : "Looks good, continue"}
      </button>
      <button type="button" className="mt-4 w-full text-center text-sm text-white/55 underline underline-offset-4 hover:text-white" disabled={discarding} onClick={() => startDiscard(() => discardGeneratedResume(profileId))}>
        I&rsquo;d rather upload a real resume
      </button>
    </form>
  );
}
