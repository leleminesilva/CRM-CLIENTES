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
