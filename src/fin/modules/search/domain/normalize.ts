/** Minúsculas e sem acento: "Açaí" → "acai". Mesma regra do índice no banco (immutable_unaccent(lower())). */
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export function matches(haystack: string, needle: string): boolean {
  return normalizeText(haystack).includes(normalizeText(needle));
}

/** Pontuação simples: começa com o termo > contém no início de uma palavra > contém. */
export function score(haystack: string, needle: string): number {
  const h = normalizeText(haystack);
  const n = normalizeText(needle);
  if (!n || !h.includes(n)) return 0;
  if (h.startsWith(n)) return 3;
  if (h.includes(` ${n}`)) return 2;
  return 1;
}
