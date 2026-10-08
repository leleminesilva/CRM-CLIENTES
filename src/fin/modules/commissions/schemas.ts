import { z } from "zod";
import { isoDate, moneyInput, optionalText } from "@fin/lib/validation";

export const commissionSchema = z
  .object({
    sellerName: z.string().trim().min(1, "Informe o vendedor").max(120, "Use até 120 caracteres"),
    /** Valor da comissão que a empresa paga ao vendedor. */
    amount: moneyInput({ required: "Informe o valor da comissão" }),
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
  });

export const updateCommissionSchema = commissionSchema.and(z.object({ id: z.string().uuid() }));

export type CommissionInput = z.infer<typeof commissionSchema>;
