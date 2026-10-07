import "server-only";
import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";
import { requireContext } from "./context";
import { errorMessages, isAppError, normalizeError } from "./errors";
import { logger } from "./logger";
import { invalidateAlerts } from "@fin/modules/alerts/service";
import { assertCan } from "./permissions";
import type { ActionError } from "./safe-action-types";

const metadataSchema = z.object({
  /** Nome da action para logs e auditoria, ex.: "accounts.create". */
  name: z.string(),
  /** Padrão: "write". */
  permission: z.enum(["read", "write", "manage", "owner"]).optional(),
});

export const actionClient = createSafeActionClient({
  defineMetadataSchema: () => metadataSchema,
  defaultValidationErrorsShape: "flattened",
  handleServerError(error, { metadata }): ActionError {
    const normalized = normalizeError(error);
    if (isAppError(normalized)) return { code: normalized.code, message: normalized.message };
    logger.error({ err: error, action: metadata?.name }, "Erro inesperado em server action");
    return { code: "INTERNAL", message: errorMessages.INTERNAL };
  },
});

/** Toda action do app: sessão válida → workspace ativo → permissão → (Zod) → service. */
export const authActionClient = actionClient.use(async ({ next, metadata }) => {
  const ctx = await requireContext();
  assertCan(ctx, metadata.permission ?? "write");
  const result = await next({ ctx: { app: ctx } });
  // Qualquer mudança pode criar ou resolver alertas: reavalia na próxima leitura.
  invalidateAlerts(ctx.workspaceId);
  return result;
});
