import { z } from "zod";
import { isoDate, moneyInput, optionalText } from "@fin/lib/validation";

export const commissionSchema = z
  .object({
    sellerName: z.string().trim().min(1, "Informe o vendedor").max(120, "Use até 120 caracteres"),
    clientName: z.string().trim().min(1, "Informe o cliente").max(120, "Use até 120 caracteres"),
    saleDescription: z
      .string()
      .trim()
      .min(1, "Descreva a venda ou projeto")
      .max(160, "Use até 160 caracteres"),
    saleAmount: moneyInput({ required: "Informe o valor da venda" }),
    ratePercent: z
      .string()
      .trim()
      .min(1, "Informe o percentual")
      .transform((v) => v.replace(",", "."))
      .pipe(z.string().regex(/^\d{1,3}(\.\d{1,4})?$/, "Percentual inválido (ex.: 5 ou 2,5)"))
      .refine((v) => Number.parseFloat(v) > 0 && Number.parseFloat(v) <= 100, "Entre 0 e 100%"),
    /** Valor digitado manualmente (quando a empresa paga ao vendedor diferente do cálculo). */
    amountOverride: z
      .union([z.string(), z.null()])
      .transform((v) => (v ?? "").trim())
      .pipe(z.union([z.literal(""), moneyInput()]))
      .transform((v) => (v === "" ? null : v)),
    saleDate: isoDate(),
    expectedDate: isoDate("Informe a previsão de pagamento"),
    received: z.boolean(),
    receivedAt: isoDate().nullable(),
    accountId: z.string().uuid().nullable(),
    notes: optionalText(1000),
  })
  .superRefine((v, ctx) => {
    if (v.received && !v.accountId)
      ctx.addIssue({
        code: "custom",
        path: ["accountId"],
        message: "De qual conta a comissão foi paga?",
      });
    if (v.expectedDate < v.saleDate)
      ctx.addIssue({
        code: "custom",
        path: ["expectedDate"],
        message: "A previsão não pode ser antes da venda",
      });
  });

export const updateCommissionSchema = commissionSchema.and(z.object({ id: z.string().uuid() }));

export type CommissionInput = z.infer<typeof commissionSchema>;

/** Comissão automática: percentual sobre a venda e dia do mês seguinte em que é paga. */
export const commissionSettingsSchema = z.object({
  ratePercent: z
    .string()
    .trim()
    .min(1, "Informe o percentual")
    .transform((v) => v.replace(",", "."))
    .pipe(z.string().regex(/^\d{1,3}(\.\d{1,4})?$/, "Percentual inválido (ex.: 2 ou 2,5)"))
    .refine((v) => Number.parseFloat(v) > 0 && Number.parseFloat(v) <= 100, "Entre 0 e 100%"),
  payDay: z.number().int().min(1, "Dia de 1 a 28").max(28, "Dia de 1 a 28"),
});

/** Importação de comissões por planilha (CSV): uma linha por comissão, já normalizada no navegador. */
export const importCommissionsSchema = z.object({
  /** Dia da previsão de pagamento (vale para todas as linhas importadas). */
  expectedDate: isoDate("Informe a previsão de pagamento"),
  /** Percentual da comissão sobre o valor de cada linha da planilha (ex.: "5" ou "2.5"). */
  ratePercent: z
    .string()
    .trim()
    .min(1, "Informe o percentual")
    .transform((v) => v.replace(",", "."))
    .pipe(z.string().regex(/^\d{1,3}(\.\d{1,4})?$/, "Percentual inválido (ex.: 5 ou 2,5)"))
    .refine((v) => Number.parseFloat(v) > 0 && Number.parseFloat(v) <= 100, "Entre 0 e 100%"),
  rows: z
    .array(
      z.object({
        budget: z.string().trim().min(1).max(40),
        /** Valor da venda (a comissão é calculada pelo percentual). */
        amount: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Valor inválido"),
        client: z.string().trim().min(1).max(120),
        seller: z.string().trim().min(1).max(120),
      }),
    )
    .min(1, "A planilha não tem linhas")
    .max(500, "Importe até 500 linhas por vez"),
});

export type ImportCommissionsInput = z.infer<typeof importCommissionsSchema>;
