/**
 * Identifica o tipo real do arquivo pelos primeiros bytes (assinatura), sem confiar na extensão
 * nem no Content-Type enviado pelo navegador.
 */
export type AllowedMime =
  "application/pdf" | "image/png" | "image/jpeg" | "image/webp" | "image/heic";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const EXTENSIONS: Record<AllowedMime, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
};

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  if (
    ascii(bytes, 4, 4) === "ftyp" &&
    ["heic", "heix", "hevc", "mif1", "msf1"].includes(ascii(bytes, 8, 4))
  ) {
    return "image/heic";
  }
  return null;
}

/** Nome seguro para exibição/download: sem caminhos, sem caracteres de controle, até 120 caracteres. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "arquivo";
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "").trim();
  return (cleaned || "arquivo").slice(0, 120);
}
