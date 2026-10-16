import "server-only";

// A resume written from a few fill-in-the-blanks answers, for people who have no file. The
// text is what the headhunter reads and quotes; the PDF is what application forms get.

export type QuickProfile = {
  title: string;
  company: string;
  since: string; // year, or ""
  years: "" | "0-1" | "2-4" | "5-9" | "10+";
  skills: string[];
  prevTitle: string;
  prevCompany: string;
  proud: string;
  degree: string; // "", certificate, diploma, bachelor, master, phd
  subject: string;
  school: string;
};

export const GENERATED_PREFIX = "Career Ninja resume";

const LEVEL: Record<string, string> = { "0-1": "Junior", "2-4": "Mid-level", "5-9": "Senior", "10+": "Lead" };
const YEARS: Record<string, string> = { "0-1": "under two years", "2-4": "two to four years", "5-9": "five to nine years", "10+": "over ten years" };
const DEGREE: Record<string, string> = { certificate: "Certificate", diploma: "Diploma", bachelor: "Bachelor's degree", master: "Master's degree", phd: "PhD" };

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const clean = (s: string | null | undefined, max = 120) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function readQuickProfile(form: FormData): QuickProfile {
  const get = (k: string, max = 120) => clean(String(form.get(k) ?? ""), max);
  const years = get("years") as QuickProfile["years"];
  return {
    title: get("title", 80),
    company: get("company", 80),
    since: /^\d{4}$/.test(get("since")) ? get("since") : "",
    years: ["0-1", "2-4", "5-9", "10+"].includes(years) ? years : "",
    skills: get("skills", 600)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 15),
    prevTitle: get("prevTitle", 80),
    prevCompany: get("prevCompany", 80),
    proud: get("proud", 200),
    degree: ["certificate", "diploma", "bachelor", "master", "phd"].includes(get("degree")) ? get("degree") : "",
    subject: get("subject", 80),
    school: get("school", 80),
  };
}

// Plain text, in the shape a real resume has, so everything downstream (title guess, fit
// check, quoting) works the same. Blank answers simply leave lines out.
export function quickResumeText(p: QuickProfile, name: string) {
  const title = cap(p.title) || "Professional";
  const headline = [title, p.company && `at ${p.company}`, p.since && `since ${p.since}`].filter(Boolean).join(" ");
  const summary = [
    `${title}${p.years ? ` with ${YEARS[p.years]} of experience` : ""}.`,
    p.skills.length ? `Good at ${p.skills.slice(0, 6).join(", ")}.` : "",
    p.proud ? cap(p.proud).replace(/\.?$/, ".") : "",
  ]
    .filter(Boolean)
    .join(" ");
  const current = [title, p.company].filter(Boolean).join(", ") + (p.since ? ` (${p.since} to now)` : "");
  const previous = p.prevTitle || p.prevCompany ? [cap(p.prevTitle) || "Earlier role", p.prevCompany].filter(Boolean).join(", ") + " (earlier)" : "";
  const education = p.degree || p.subject || p.school ? [DEGREE[p.degree] ?? "", p.subject && `in ${p.subject}`, p.school && `, ${p.school}`].filter(Boolean).join(" ").replace(/\s,/g, ",") : "";
  const lines = [
    `# ${name}`,
    headline,
    "",
    "## SUMMARY",
    summary,
    "",
    "## EXPERIENCE",
    current,
    ...(p.proud ? [`- ${cap(p.proud)}`] : []),
    ...(previous ? [previous] : []),
    ...(p.skills.length ? ["", "## SKILLS", p.skills.join(", ")] : []),
    ...(education ? ["", "## EDUCATION", education] : []),
    ...(p.years ? ["", "## LEVEL", LEVEL[p.years]] : []),
  ];
  return lines.join("\n").trim();
}

// The same text as a one-page PDF, written by hand: Helvetica only, no library. Lines that
// start with "# " are the name, "## " are section headings.
export function textToPdf(text: string): Buffer {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7E]/g, "-");
  const wrap = (s: string, width: number) => {
    const out: string[] = [];
    let line = "";
    for (const w of s.split(" ")) {
      if ((line + " " + w).trim().length > width) {
        out.push(line.trim());
        line = w;
      } else line = `${line} ${w}`;
    }
    if (line.trim()) out.push(line.trim());
    return out.length ? out : [""];
  };
  const ops: string[] = [];
  let y = 790;
  for (const raw of text.replace(/^#\s*/gm, (m) => m).split("\n")) {
    let font = "F1", size = 10.5, gap = 15, body = raw;
    if (raw.startsWith("# ")) [font, size, gap, body] = ["F2", 20, 30, raw.slice(2)];
    else if (raw.startsWith("## ")) [font, size, gap, body] = ["F2", 12, 22, raw.slice(3)];
    if (!body.trim()) {
      y -= 8;
      continue;
    }
    for (const line of wrap(body, size > 14 ? 50 : 95)) {
      if (y < 60) break;
      if (font === "F2" && size === 12) y -= 6;
      ops.push(`BT /${font} ${size} Tf 50 ${y.toFixed(1)} Td (${esc(line)}) Tj ET`);
      y -= gap;
    }
  }
  const stream = ops.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "binary");
}
