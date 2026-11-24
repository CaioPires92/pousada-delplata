/** Âncora estável de um título (usada no corpo do artigo e no índice "Neste artigo"). */
export function slugifyHeading(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
