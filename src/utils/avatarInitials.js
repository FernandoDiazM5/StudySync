/**
 * Iniciales para avatares sin foto.
 * - Una sola palabra (p. ej. username): una letra.
 * - Varias palabras (nombre completo): primera letra del primer y del último token.
 */
export function initialsFromDisplayName(name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/).filter(Boolean);
  const head = (word) =>
    word ? String(word).charAt(0).toUpperCase() : "";
  if (words.length === 1) {
    return head(words[0]).slice(0, 1);
  }
  return `${head(words[0])}${head(words[words.length - 1])}`.slice(0, 2);
}
