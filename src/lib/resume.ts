import "server-only";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

const TYPES: Record<string, { ext: string; mime: string }> = {
  pdf: { ext: "pdf", mime: "application/pdf" },
  docx: { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
};

export function resumeType(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return TYPES[ext] ?? null;
}

export async function extractResumeText(file: File): Promise<string> {
  const type = resumeType(file.name);
  const buf = new Uint8Array(await file.arrayBuffer());
  if (type?.ext === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    return text.trim();
  }
  if (type?.ext === "docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
    return value.trim();
  }
  throw new Error("Unsupported file type");
}
