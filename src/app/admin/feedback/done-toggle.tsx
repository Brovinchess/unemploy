"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw } from "lucide-react";
import { setFeedbackStatus } from "@/app/feedback-actions";

export function DoneToggle({ id, done }: { id: string; done: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setFeedbackStatus(id, done ? "new" : "done");
          router.refresh();
        })
      }
      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs ${done ? "text-white/45 hover:text-white" : "bg-coral/15 text-rose ring-1 ring-coral/30 hover:bg-coral/25"}`}
      title={done ? "Reopen" : "Mark done"}
    >
      {done ? <RotateCcw className="size-3.5" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
      {done ? "Reopen" : "Done"}
    </button>
  );
}
