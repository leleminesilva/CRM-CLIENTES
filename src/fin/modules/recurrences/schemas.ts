import { z } from "zod";
import { isoDate } from "@fin/lib/validation";

export const frequencySchema = z.enum(["WEEKLY", "MONTHLY", "YEARLY"]);
export const dayRuleSchema = z.enum(["FIXED_DAY", "NTH_BUSINESS_DAY", "LAST_BUSINESS_DAY"]);
export const shiftSchema = z.enum(["NONE", "NEXT", "PREVIOUS"]);

/** Configuração de repetição usada no formulário de lançamento e na edição de recorrências. */
export const repeatSchema = z
  .object({
    frequency: frequencySchema,
    intervalCount: z.coerce.number().int().min(1, "Mínimo 1").max(24, "Máximo 24"),
    dayRule: dayRuleSchema,
    /** Dia fixo (1–31) ou n-ésimo dia útil (1–23). */
    dayOfMonth: z.coerce.number().int().min(1).max(31).nullable(),
    nonBusinessDayShift: shiftSchema,
    endMode: z.enum(["never", "until", "count"]),
    endDate: isoDate().nullable(),
    maxOccurrences: z.coerce.number().int().min(1, "Mínimo 1").max(600, "Máximo 600").nullable(),
    /** Valor muda a cada mês (ex.: energia): a previsão usa a média recente. */
    isEstimatedAmount: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.endMode === "until" && !v.endDate)
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Informe a data final" });
    if (v.endMode === "count" && !v.maxOccurrences)
      ctx.addIssue({ code: "custom", path: ["maxOccurrences"], message: "Informe quantas vezes" });
    if (v.dayRule === "NTH_BUSINESS_DAY" && (!v.dayOfMonth || v.dayOfMonth > 23))
      ctx.addIssue({
        code: "custom",
        path: ["dayOfMonth"],
        message: "Escolha entre o 1º e o 23º dia útil",
      });
  });

export type RepeatInput = z.infer<typeof repeatSchema>;

/** Até onde editar uma ocorrência de recorrência. */
export const editScopeSchema = z.enum(["this", "future", "all-pending"]);
export type EditScope = z.infer<typeof editScopeSchema>;

/** Repetição padrão do formulário: todo mês, mesmo dia, sem fim. */
export const DEFAULT_REPEAT: RepeatInput = {
  frequency: "MONTHLY",
  intervalCount: 1,
  dayRule: "FIXED_DAY",
  dayOfMonth: null,
  nonBusinessDayShift: "NONE",
  endMode: "never",
  endDate: null,
  maxOccurrences: null,
  isEstimatedAmount: false,
};
