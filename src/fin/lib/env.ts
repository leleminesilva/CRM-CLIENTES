import path from "node:path";

/** Configuração do Financeiro. No sistema original vinha validada por Zod; aqui só o que é usado. */
export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  /** Fuso dos jobs diários ("hoje" de cada workspace usa o fuso do próprio workspace). */
  APP_TIMEZONE: process.env.FIN_APP_TIMEZONE ?? "America/Sao_Paulo",
  /** Jobs diários disparados pelo app (recorrências, faturas, snapshots, lixeira). */
  JOBS_ENABLED: process.env.FIN_JOBS_ENABLED !== "false",
  LOG_LEVEL: process.env.FIN_LOG_LEVEL ?? "info",
  /** Anexos (comprovantes): "local" (pasta) em desenvolvimento, "supabase" na Vercel (sem disco permanente). */
  STORAGE_DRIVER: process.env.FIN_STORAGE ?? (process.env.VERCEL ? "supabase" : "local"),
  STORAGE_DIR: process.env.FIN_STORAGE_DIR ?? path.join("storage", "fin"),
};
