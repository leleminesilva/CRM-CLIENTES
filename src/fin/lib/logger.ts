import "server-only";

// O sistema original usa pino; o CRM registra no console (Vercel coleta o stdout).
// Mesma assinatura do pino: logger.error({ err, ... }, "mensagem").
type Fields = Record<string, unknown>;

function write(level: "debug" | "info" | "warn" | "error", fields: Fields | string, message?: string) {
  const [obj, msg] = typeof fields === "string" ? [{}, fields] : [fields, message ?? ""];
  console[level === "debug" ? "log" : level](`[financeiro] ${msg}`, obj);
}

export const logger = {
  debug: (fields: Fields | string, message?: string) => write("debug", fields, message),
  info: (fields: Fields | string, message?: string) => write("info", fields, message),
  warn: (fields: Fields | string, message?: string) => write("warn", fields, message),
  error: (fields: Fields | string, message?: string) => write("error", fields, message),
};
