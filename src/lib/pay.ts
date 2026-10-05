// Reads pay as postings write it ("MYR 4,000 - 6,000 / month", "$120k–$150k a year",
// "RM5k") so a job clearly below the user's floor can be refused. When in doubt it
// returns null and the job is let through.

import type { SalaryFloor, SalaryPeriod } from "./preferences";

// Codes may sit right against the number ("RM3,000"), so they end at a non-letter, not a word boundary.
const SYMBOLS: [RegExp, string][] = [
  [/\b(RM|MYR)(?![a-z])/i, "MYR"],
  [/\bS\$|\bSGD(?![a-z])/i, "SGD"],
  [/\bA\$|\bAUD(?![a-z])/i, "AUD"],
  [/\bHK\$|\bHKD(?![a-z])/i, "HKD"],
  [/\bNZ\$|\bNZD(?![a-z])/i, "NZD"],
  [/\bC\$|\bCAD(?![a-z])/i, "CAD"],
  [/€|\bEUR(?![a-z])/i, "EUR"],
  [/£|\bGBP(?![a-z])/i, "GBP"],
  [/₹|\bINR(?![a-z])|\bRs\.?(?![a-z])/i, "INR"],
  [/₱|\bPHP(?![a-z])/i, "PHP"],
  [/\bIDR(?![a-z])|\bRp\.?(?![a-z])/i, "IDR"],
  [/¥|\bJPY(?![a-z])/i, "JPY"],
  [/\bUS\$|\bUSD(?![a-z])|\$/i, "USD"], // a bare $ last: other dollars are matched above
];

export type Pay = { currency: string; low: number; high: number; period: SalaryPeriod };

export function parsePay(text: string | null | undefined): Pay | null {
  if (!text) return null;
  const currency = SYMBOLS.find(([re]) => re.test(text))?.[1];
  const period: SalaryPeriod | null = /\b(year|yearly|annual(ly)?|annum|p\.?a\.?|yr)\b/i.test(text)
    ? "year"
    : /\b(month|monthly|mo|p\.?m\.?)\b/i.test(text)
      ? "month"
      : null;
  if (!currency || !period || /\b(hour|hourly|hr|day|daily|week|weekly)\b/i.test(text)) return null;
  const nums = [...text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*([km])?\b/gi)]
    .map(([, n, unit]) => Number(n.replace(/,/g, "")) * (unit?.toLowerCase() === "k" ? 1_000 : unit?.toLowerCase() === "m" ? 1_000_000 : 1))
    .filter((n) => n >= 100);
  if (!nums.length) return null;
  return { currency, low: Math.min(...nums), high: Math.max(...nums), period };
}

// The user's pay floor: the one they picked, or read from a typed answer from before
// ranges existed ("20000 myr in a month").
export function floorOf(prefs: { salary?: SalaryFloor; minSalary?: string }): SalaryFloor | undefined {
  if (prefs.salary) return prefs.salary;
  const p = parsePay(prefs.minSalary);
  return p ? { currency: p.currency, min: p.low, period: p.period } : undefined;
}

// True only when the posted pay, at its highest, is clearly under the floor.
export function clearlyBelow(posted: string | null | undefined, floor: SalaryFloor | undefined) {
  if (!floor) return false;
  const pay = parsePay(posted);
  if (!pay || pay.currency !== floor.currency) return false;
  const high = pay.period === floor.period ? pay.high : pay.period === "year" ? pay.high / 12 : pay.high * 12;
  return high < floor.min * 0.95;
}
