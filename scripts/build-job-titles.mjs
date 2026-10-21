// Builds src/data/job-titles.json from the O*NET database (U.S. Department of Labor, CC BY 4.0):
// the occupation titles, the titles people reported holding, and the alternate titles.
// Run: node scripts/build-job-titles.mjs [dir with the three O*NET text files]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const VERSION = "29.3";
const BASE = `https://www.onetcenter.org/dl_files/database/db_${VERSION.replace(".", "_")}_text/`;
const FILES = ["Occupation Data.txt", "Sample of Reported Titles.txt", "Alternate Titles.txt"];
const dir = process.argv[2];

async function read(name) {
  if (dir) return readFileSync(join(dir, name.replace(/ /g, "_")), "utf8");
  const r = await fetch(BASE + encodeURIComponent(name));
  if (!r.ok) throw new Error(`${name}: ${r.status}`);
  return r.text();
}
const rows = (text) => text.split("\n").slice(1).map((l) => l.split("\t")).filter((c) => c.length > 1);

const clean = (t) =>
  t
    .replace(/\s+/g, " ")
    .replace(/,? (All Other|Except .*)$/i, "")
    .trim();
// Keep titles people would type: not too long, no internal codes, letters in them.
const keep = (t) => t && t.length >= 3 && t.length <= 60 && /[a-z]/i.test(t) && !/n\/a|\bSOC\b|\d{2}-\d{4}/.test(t);

const seen = new Map(); // lower -> title, first spelling wins
const add = (tier, list) => {
  const out = [];
  for (const raw of list) {
    const t = clean(raw);
    if (!keep(t)) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.set(k, t);
    out.push(t);
  }
  return out;
};

// Titles common in tech, startups and remote work that the O*NET list spells differently or lacks.
const EXTRA = [
  "Frontend Developer", "Front-end Developer", "Backend Developer", "Backend Engineer", "Full-stack Developer", "Full Stack Engineer", "Software Developer", "Software Engineer", "Senior Software Engineer", "Staff Software Engineer", "Mobile Developer", "iOS Developer", "Android Developer", "React Developer", "Web Developer", "DevOps Engineer", "Site Reliability Engineer", "Platform Engineer", "Cloud Engineer", "Data Engineer", "Analytics Engineer", "Machine Learning Engineer", "AI Engineer", "Prompt Engineer", "Data Analyst", "Business Intelligence Analyst", "BI Analyst", "Data Scientist", "Research Scientist", "QA Engineer", "QA Analyst", "QA Tester", "Software Tester", "Test Automation Engineer", "Security Engineer", "Cybersecurity Analyst", "SOC Analyst", "Blockchain Developer", "Smart Contract Engineer", "Solidity Developer", "Solutions Engineer", "Solutions Architect", "Technical Support Engineer", "IT Support Specialist",
  "Product Manager", "Senior Product Manager", "Associate Product Manager", "Product Owner", "Technical Product Manager", "AI Product Manager", "Group Product Manager", "Head of Product", "Product Designer", "UX Designer", "UI Designer", "UX Researcher", "UX Writer", "Visual Designer", "Brand Designer", "Motion Designer", "Graphic Designer", "Design Lead", "Head of Design",
  "Marketing Manager", "Digital Marketing Manager", "Digital Marketing Specialist", "Growth Marketing Manager", "Growth Manager", "Performance Marketing Manager", "Product Marketing Manager", "Content Marketing Manager", "Content Manager", "Content Writer", "Content Creator", "Copywriter", "SEO Specialist", "SEO Manager", "Social Media Manager", "Community Manager", "Community Lead", "Brand Manager", "Marketing Specialist", "Marketing Coordinator", "Head of Marketing", "Email Marketing Specialist", "Marketing Analyst", "PR Manager", "Communications Manager", "Event Manager", "Partnerships Manager", "Developer Advocate", "Developer Relations Manager",
  "Crypto Analyst", "Crypto Research Analyst", "Web3 Developer", "Web3 Community Manager", "Web3 Marketing Manager", "Blockchain Analyst", "DeFi Analyst", "Token Economist", "NFT Project Manager",
  "Account Executive", "Sales Development Representative", "Business Development Representative", "Business Development Manager", "Account Manager", "Key Account Manager", "Sales Manager", "Head of Sales", "Customer Success Manager", "Customer Support Specialist", "Customer Service Representative", "Customer Experience Manager", "Onboarding Specialist", "Implementation Manager",
  "Project Manager", "Program Manager", "Scrum Master", "Delivery Manager", "Operations Manager", "Operations Coordinator", "Operations Analyst", "Chief of Staff", "Business Analyst", "Strategy Manager", "Business Operations Manager", "Revenue Operations Manager", "Office Manager", "Executive Assistant", "Virtual Assistant", "Administrative Assistant", "Data Entry Specialist",
  "HR Generalist", "HR Manager", "HR Business Partner", "People Operations Manager", "Recruiter", "Technical Recruiter", "Talent Acquisition Specialist", "Learning and Development Manager",
  "Financial Analyst", "Finance Manager", "Accountant", "Senior Accountant", "Accounts Payable Specialist", "Accounts Receivable Specialist", "Bookkeeper", "Controller", "FP&A Analyst", "Investment Analyst", "Compliance Analyst", "Risk Analyst", "Treasury Analyst", "Auditor",
  "Registered Nurse", "Nurse Practitioner", "Medical Assistant", "Pharmacist", "Physiotherapist", "Dental Assistant", "Clinical Research Coordinator", "Healthcare Administrator", "Caregiver",
  "Teacher", "English Teacher", "Primary School Teacher", "Tutor", "Online English Teacher", "Instructional Designer", "Curriculum Developer", "Lecturer", "Teaching Assistant",
  "Game Designer", "Game Developer", "Game Producer", "Level Designer", "3D Artist", "Video Editor", "Photographer", "Videographer", "Animator", "Illustrator", "Journalist", "Editor", "Translator", "Interpreter", "Technical Writer",
  "Mechanical Engineer", "Electrical Engineer", "Civil Engineer", "Chemical Engineer", "Automotive Engineer", "Industrial Engineer", "Process Engineer", "Quality Engineer", "Manufacturing Engineer", "Supply Chain Analyst", "Logistics Coordinator", "Procurement Specialist", "Warehouse Manager",
  "Chef", "Sous Chef", "Chef de Partie", "Barista", "Restaurant Manager", "Front Desk Agent", "Hotel Manager", "Flight Attendant", "Retail Sales Associate", "Store Manager", "Cashier", "Visual Merchandiser", "Personal Trainer", "Real Estate Agent", "Property Manager", "Paralegal", "Legal Counsel", "Contracts Manager", "Architect", "Interior Designer", "Electrician", "Plumber", "Driver", "Security Officer",
];
const occupations = rows(await read(FILES[0])).map((c) => c[1]);
const reported = rows(await read(FILES[1])).map((c) => c[1]);
const alternate = rows(await read(FILES[2])).map((c) => c[1]);
// Core: what employers and people actually call jobs. More: the long tail of alternate names.
let core = add("core", [...EXTRA, ...reported, ...occupations]);
let more = add("more", alternate);
// O*NET occupation titles are plural ("Marketing Managers"); drop them when the singular exists.
const singularExists = (t) => /s$/i.test(t) && !/ss$/i.test(t) && seen.has(t.slice(0, -1).toLowerCase());
core = core.filter((t) => !singularExists(t)).sort((a, b) => a.localeCompare(b));
more = more.filter((t) => !singularExists(t)).sort((a, b) => a.localeCompare(b));
writeFileSync("src/data/job-titles.json", JSON.stringify({ source: `O*NET ${VERSION} Database`, licence: "CC BY 4.0", core, more }));
console.log(`core ${core.length}, more ${more.length}, total ${core.length + more.length}`);
