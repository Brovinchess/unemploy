// Whether a resume gives the headhunter something to go on. Never used to refuse a file: it only
// decides if the person sees a notice asking for their real resume. Cheap signals, no Mind call.
// People upload in many languages, so the section words cover the common ones; a resume has to
// miss nearly every signal to be flagged, so an unusual but real one is left alone.

import { GENERATED_PREFIX } from "@/lib/quick-resume";

export type ResumeProblem = "not_resume" | "too_thin";

// Whole words in alphabetic scripts (letter-aware, so "özgeçmiş" counts); plain matches for CJK,
// Arabic-script and other scripts that don't separate words the same way.
const words = (list: string) => new RegExp(`(?<!\\p{L})(?:${list})`, "iu");
const anywhere = (list: string) => new RegExp(`(?:${list})`, "u");

const SECTIONS = [
  // Work history
  words("experience|employment|work history|career history|internship|experiencia|expérience|experiência|esperienza|berufserfahrung|erfahrung|ervaring|deneyim|iş deneyimi|pengalaman|kinh nghiệm|karanasan|doświadczenie|опыт|досвід"),
  anywhere("工作经历|工作經歷|工作经验|经历|經歷|職歴|職務経歴|경력|سوابق|سابقه|خبرة|الخبرات|ניסיון|ประสบการณ์|अनुभव"),
  // Education
  words("education|degree|university|college|bachelor|diploma|certification|educación|formación|formation|educação|formação|istruzione|ausbildung|studium|opleiding|eğitim|egitim|üniversite|universitas|pendidikan|học vấn|đại học|edukasyon|wykształcenie|образование|освіта"),
  anywhere("教育|学历|學歷|学歴|大学|大學|학력|تحصیلات|دانشگاه|تعليم|جامعة|השכלה|การศึกษา|शिक्षा"),
  // Skills and summary
  words("skills|competencies|summary|objective|achievements|habilidades|competencias|compétences|competências|competenze|kenntnisse|fähigkeiten|vaardigheden|yetenek|beceri|özet|keahlian|keterampilan|kemampuan|kỹ năng|kasanayan|umiejętności|навыки|навички"),
  anywhere("技能|专长|專長|简历|簡歷|履歴書|スキル|기술|이력서|مهارت|رزومه|مهارات|السيرة الذاتية|כישורים|ทักษะ|कौशल"),
  // The words for the document itself
  words("resume|résumé|curriculum vitae|lebenslauf|özgeçmiş|ozgecmis|riwayat hidup|sơ yếu lý lịch|hoja de vida|currículo|резюме"),
];
const CONTACT = /[\w.+-]+@[\w-]+\.[\w.-]+|linkedin\.com|github\.com/i;
// A phone number with a country code or separators: "+60 16-246 7786", "(555) 289 87 88".
// Bare long numbers (contract or ID codes) don't count.
const PHONE = /\+\d{1,3}[\s-]?\(?\d{1,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}|\(\d{2,4}\)\s?\d{2,4}[\s.-]\d{2,4}/;
// "2019 - 2022", "Mar 2021 – Present", "2018 to now", "(Eylül 2018 - Devam ediyor)", "2022.05 - 至今"
const YEAR_SPAN = new RegExp(
  "(?:19|20)\\d{2}(?:[./]\\d{1,2})?\\s*(?:[-–—~－～]|to|until|bis|hasta|até|至)\\s*(?:(?:19|20)\\d{2}|present|now|current|today|heute|actualidad|actuel|atual|günümüz|devam|sekarang|hiện tại|至今|現在|현재|حتى الآن|تاکنون)",
  "iu",
);

// Fewer words than this, outside headings and the name line, and a resume the app wrote from the
// blanks has too little for the headhunter to judge fit.
const THIN_WORDS = 20;

export function resumeProblem(text: string | null | undefined, opts: { generated?: boolean } = {}): ResumeProblem | null {
  if (!text) return null;
  // Arabic and Persian PDFs often extract as presentation forms; NFKC folds them back to letters.
  const t = text.normalize("NFKC");
  if (opts.generated) {
    const body = t
      .split("\n")
      .filter((l, i) => i > 0 && !/^#+\s/.test(l.trim()))
      .join(" ");
    return (body.match(/[\p{L}\p{N}]+/gu)?.length ?? 0) < THIN_WORDS ? "too_thin" : null;
  }
  const head = t.slice(0, 8000);
  const signals = SECTIONS.filter((re) => re.test(head)).length + Number(CONTACT.test(head)) + Number(PHONE.test(head)) + Number(YEAR_SPAN.test(head));
  return signals <= 1 ? "not_resume" : null;
}

// The same check for a saved headhunter: a resume the app wrote from the blanks is judged on length.
export function profileResumeProblem(p: { resumeText: string | null; resumeFileName: string | null }): ResumeProblem | null {
  return resumeProblem(p.resumeText, { generated: !!p.resumeFileName?.startsWith(GENERATED_PREFIX) });
}
