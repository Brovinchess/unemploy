// Is this something employers post as a job title? A nudge for the "which roles?" question:
// "Crypto", "manager" or "Beta Tester" send the headhunter looking for exactly that and it
// finds nothing. Pure, so the setup chat can run it as the person types.

// Words that make a phrase read as a role ("Senior Product Manager", "Data Analyst").
const ROLE_NOUN =
  /\b(manager|engineer|designer|developer|programmer|analyst|specialist|lead|director|coordinator|officer|assistant|consultant|architect|scientist|nurse|teacher|tutor|lecturer|professor|accountant|technician|representative|executive|associate|intern|head|chief|vp|administrator|writer|editor|recruiter|planner|buyer|supervisor|operator|driver|chef|cook|barista|agent|advisor|adviser|strategist|researcher|owner|partner|principal|counsel|lawyer|paralegal|pharmacist|therapist|doctor|physician|dentist|surgeon|electrician|plumber|mechanic|welder|carpenter|cashier|clerk|receptionist|secretary|bookkeeper|auditor|controller|trader|banker|underwriter|actuary|economist|journalist|photographer|videographer|animator|illustrator|copywriter|translator|interpreter|librarian|curator|pilot|steward|stewardess|attendant|guard|officer|inspector|investigator|dispatcher|courier|mover|cleaner|janitor|housekeeper|gardener|farmer|trainer|coach|instructor|dietitian|nutritionist|paramedic|midwife|caregiver|veterinarian|founder|ceo|cto|coo|cfo|cmo|cpo|scrum master|product owner|sdr|bdr|devops|sre|qa)\b/i;

// Single words that are a field or a mood, not a title.
const NOT_A_TITLE =
  /^(crypto|web3|blockchain|bitcoin|defi|nft|ai|ml|tech|it|finance|fintech|marketing|sales|design|product|data|hr|legal|ops|operations|admin|support|media|content|gaming|games|healthcare|health|education|retail|hospitality|logistics|security|cloud|mobile|startup|startups|remote|anything|any|all|everything|open|flexible|job|jobs|work|career|mind|enthusiast|beta tester|tester|freelance|freelancer|student|graduate|fresh graduate|entry level|junior|senior|lead|manager|engineer|developer|analyst|designer|consultant|specialist|executive|officer|coordinator|associate|assistant|director|intern|internship)$/i;

// Suggestions by the words in a vague answer. First match wins; a few fit several words.
const FAMILIES: [RegExp, string[]][] = [
  [/crypto|web3|blockchain|bitcoin|defi|nft|token/i, ["Blockchain Developer", "Crypto Research Analyst", "Community Manager", "Product Manager, Web3", "Business Development Manager"]],
  [/\bai\b|machine learning|\bml\b|llm/i, ["Machine Learning Engineer", "AI Product Manager", "Data Scientist", "AI Engineer", "Prompt Engineer"]],
  [/market/i, ["Marketing Manager", "Digital Marketing Specialist", "Content Marketing Manager", "Growth Marketing Manager", "Social Media Manager"]],
  [/sales|business development|\bbd\b/i, ["Account Executive", "Sales Development Representative", "Business Development Manager", "Account Manager", "Sales Manager"]],
  [/product/i, ["Product Manager", "Senior Product Manager", "Product Owner", "Associate Product Manager", "Product Analyst"]],
  [/design|ux|ui|creative/i, ["Product Designer", "UX Designer", "Graphic Designer", "UI Designer", "Visual Designer"]],
  [/data|analytics|analyst/i, ["Data Analyst", "Business Analyst", "Data Scientist", "Analytics Engineer", "Financial Analyst"]],
  [/engineer|developer|software|coding|programmer|\bit\b|tech/i, ["Software Engineer", "Frontend Developer", "Backend Engineer", "Full-stack Developer", "QA Engineer", "IT Support Specialist"]],
  [/financ|accounting|account|audit|bank/i, ["Accountant", "Financial Analyst", "Finance Manager", "Auditor", "Accounts Payable Specialist"]],
  [/\bhr\b|human resource|people|talent|recruit/i, ["HR Generalist", "Recruiter", "Talent Acquisition Specialist", "HR Manager", "People Operations Coordinator"]],
  [/ops|operation|logistic|supply/i, ["Operations Manager", "Operations Coordinator", "Supply Chain Analyst", "Logistics Coordinator", "Project Manager"]],
  [/support|customer|service|success/i, ["Customer Support Specialist", "Customer Success Manager", "Customer Service Representative", "Technical Support Engineer"]],
  [/project|program|delivery|scrum|agile/i, ["Project Manager", "Program Manager", "Scrum Master", "Delivery Manager", "Project Coordinator"]],
  [/content|writ|copy|editor|journal/i, ["Content Writer", "Copywriter", "Content Manager", "Editor", "Technical Writer"]],
  [/game|gaming/i, ["Game Designer", "Game Developer", "Game Producer", "QA Tester, Games", "Community Manager"]],
  [/teach|education|tutor|school/i, ["Teacher", "Tutor", "Instructional Designer", "Curriculum Developer", "Education Coordinator"]],
  [/health|nurse|clinic|medical|care/i, ["Registered Nurse", "Medical Assistant", "Healthcare Administrator", "Clinical Research Coordinator", "Caregiver"]],
  [/admin|office|secretary|reception/i, ["Administrative Assistant", "Office Manager", "Executive Assistant", "Receptionist", "Office Coordinator"]],
  [/legal|law|compliance/i, ["Paralegal", "Legal Counsel", "Compliance Analyst", "Contracts Manager", "Legal Assistant"]],
  [/retail|store|shop|cashier/i, ["Retail Sales Associate", "Store Manager", "Cashier", "Visual Merchandiser", "Assistant Store Manager"]],
  [/hotel|hospitality|restaurant|chef|cook|barista|food/i, ["Chef de Partie", "Restaurant Manager", "Barista", "Front Desk Agent", "Food and Beverage Supervisor"]],
  [/security|cyber/i, ["Security Analyst", "Cybersecurity Engineer", "SOC Analyst", "Security Officer", "Information Security Manager"]],
  [/manager|management/i, ["Project Manager", "Operations Manager", "Marketing Manager", "Account Manager", "Product Manager"]],
  [/test|qa|quality/i, ["QA Engineer", "Software Tester", "QA Analyst", "Test Automation Engineer", "Quality Assurance Specialist"]],
  [/intern|graduate|student|entry|junior|fresh/i, ["Marketing Intern", "Business Analyst", "Junior Software Developer", "Graduate Trainee", "Customer Support Specialist"]],
  [/remote|anything|any|all|open|flexible|job|work|career/i, ["Customer Support Specialist", "Virtual Assistant", "Data Entry Specialist", "Sales Development Representative", "Content Writer"]],
];
const DEFAULT_SUGGESTIONS = ["Project Manager", "Marketing Specialist", "Software Engineer", "Customer Support Specialist"];

// Words that turn a phrase into a wish rather than a title ("crypto enthusiast", "anything remote").
const FILLER = /\b(enthusiast|lover|fan|passionate|anything|any|everything|remote|open|flexible|jobs?|work|career|opportunit(y|ies)|position|role|related|field|industry|stuff|whatever|etc)\b/i;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#& ]+/g, " ").replace(/\s+/g, " ").trim();

// One role, as typed between the commas.
export function looksLikeTitle(part: string) {
  const p = norm(part);
  if (p.length < 3) return false;
  if (NOT_A_TITLE.test(p)) return false;
  if (ROLE_NOUN.test(p)) return true;
  if (FILLER.test(p)) return false;
  // Two or more words that aren't a field word on their own: "Product Owner", "Scrum Master" are caught above; "Growth Hacker", "Data Entry" pass here.
  return p.split(" ").length >= 2 && !/^(beta tester|fresh graduate|entry level)$/.test(p);
}

export type RoleCheck = { ok: boolean; vague: string[]; suggestions: string[] };

// The whole answer. `hint` is a title we already believe in (from the resume), offered first.
export function checkRoles(input: string, hint?: string | null): RoleCheck {
  const parts = input.split(/,|\/| or /i).map((s) => s.trim()).filter(Boolean);
  const vague = parts.filter((p) => !looksLikeTitle(p));
  if (!parts.length || !vague.length) return { ok: true, vague: [], suggestions: [] };
  const text = vague.join(" ");
  const family = FAMILIES.find(([re]) => re.test(text))?.[1] ?? DEFAULT_SUGGESTIONS;
  const cleanHint = hint && hint.length <= 40 && !/\n/.test(hint) && looksLikeTitle(hint) && !parts.some((p) => norm(p) === norm(hint)) ? [hint.trim()] : [];
  const suggestions = [...cleanHint, ...family].filter((s, i, a) => a.indexOf(s) === i).slice(0, 4);
  return { ok: false, vague, suggestions };
}
