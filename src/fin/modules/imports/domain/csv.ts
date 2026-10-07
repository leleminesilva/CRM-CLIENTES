/** Detecta o separador mais frequente na primeira linha com conteúdo. */
export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  const counts = [";", "\t", ",", "|"].map((d) => ({ d, n: first.split(d).length - 1 }));
  return counts.sort((a, b) => b.n - a.n)[0]!.n > 0 ? counts.sort((a, b) => b.n - a.n)[0]!.d : ";";
}

/** Lê CSV com aspas (RFC 4180), separador automático e BOM. Linhas totalmente vazias são ignoradas. */
export function parseDelimited(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c.trim() !== "")) rows.push(row.map((c) => c.trim()));
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) endCell();
    else if (ch === "\n") endRow();
    else if (ch === "\r") continue;
    else cell += ch;
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}
