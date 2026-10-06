// Keeps the saved-answers list short: common questions map to a proper field in the
// person's application details, and the rest are grouped by topic.

import type { ApplicantDetails } from "@/db/schema";

export type Topic = "eligibility" | "availability" | "experience" | "pay" | "other";

export const TOPIC_LABELS: Record<Topic, string> = {
  eligibility: "Work eligibility",
  availability: "Availability",
  experience: "Experience",
  pay: "Pay",
  other: "Other",
};

export function topicOf(question: string): Topic {
  const q = question.toLowerCase();
  if (/visa|sponsor|authori[sz]|right to work|eligible to work|work permit|citizen|legally/.test(q)) return "eligibility";
  if (/notice|start date|when can you start|available|availability|relocat|travel|time ?zone|hours|on-?site|office|remote|hybrid/.test(q)) return "availability";
  if (/salary|compensation|pay\b|rate\b|expected|current (salary|pay)|package/.test(q)) return "pay";
  if (/years?|experience|worked|familiar|proficien|skill|tool|language|degree|certif|portfolio|background/.test(q)) return "experience";
  return "other";
}

// Questions whose answer belongs in a details field rather than the list.
export type DetailField = "workAuthorization" | "noticePeriod" | "salaryExpectation";

export function detailFieldFor(question: string): DetailField | null {
  const q = question.toLowerCase();
  if (/notice period|how (much|long) notice/.test(q)) return "noticePeriod";
  if (/(salary|compensation|pay) (expectation|requirement|range)|expected (salary|pay|compensation)|desired (salary|pay)/.test(q)) return "salaryExpectation";
  if (/sponsor|authori[sz]ed to work|right to work|eligible to work|work permit|legally (able|allowed) to work|citizen(ship)? status/.test(q)) return "workAuthorization";
  return null;
}

export const DETAIL_LABELS: Record<DetailField, string> = {
  workAuthorization: "Right to work",
  noticePeriod: "Notice period",
  salaryExpectation: "Salary expectation",
};

// A yes/no answer isn't a usable value for a details field ("Yes" is not a notice period);
// those stay in the list.
export const usableAsDetail = (field: DetailField, answer: string) =>
  field === "workAuthorization" ? answer.trim().length >= 2 : !/^(yes|no|y|n)\b/i.test(answer.trim()) && answer.trim().length >= 2;

export function withDetail(details: ApplicantDetails | null | undefined, field: DetailField, value: string): ApplicantDetails {
  const base: ApplicantDetails = details ?? { firstName: "", lastName: "", email: "", phone: "", location: "" };
  return { ...base, [field]: value };
}
