// Minds love dashes; people don't. Rewrites " — " and " – " as ", " (and a lone dash used as
// a pause) so what gets typed into applications reads like a person wrote it.
export function humanise(text: string) {
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/([.!?])\s*,\s*/g, "$1 ")
    .replace(/,\s*([.!?])/g, "$1");
}
