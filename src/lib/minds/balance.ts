import type { Profile } from "@/db/schema";

// Hello Minds reports a Mind's balance as minted (spendable now) plus staged (tokens waiting to
// convert). New accounts get starting cognition as staged tokens on their first 3 Minds, and they
// do convert. A 4th Mind or later shows the same staged amount at first, but it is never paid out:
// it vanishes once the Mind spends, leaving the balance below zero (seen 27 Oct 2026: 25 of 28
// accounts with up to 3 Minds kept cognition, 5 of 34 with more did). So past the 3rd Mind only
// the minted part counts.
export const STARTER_MINDS = 3;

export const trustsStaged = (p: Pick<Profile, "hmMindRank">) => p.hmMindRank == null || p.hmMindRank <= STARTER_MINDS;

// True when this headhunter starts with nothing and needs the person to add cognition first.
export const needsOwnCognition = (p: Pick<Profile, "hmMindRank">) => !trustsStaged(p);
