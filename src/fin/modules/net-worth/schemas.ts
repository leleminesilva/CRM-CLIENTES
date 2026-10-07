import { z } from "zod";
import { isoDate, moneyInput, optionalText } from "@fin/lib/validation";

export const ASSET_KINDS = ["INVESTMENT", "EQUIPMENT", "VEHICLE", "REAL_ESTATE", "OTHER"] as const;
export const LIABILITY_KINDS = ["LOAN", "FINANCING", "PERSONAL_DEBT", "OTHER"] as const;

export const assetSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(80, "Use até 80 caracteres"),
  kind: z.enum(ASSET_KINDS),
  acquisitionDate: z.union([isoDate(), z.null()]),
  acquisitionValue: z
    .union([z.string(), z.null()])
    .transform((v) => (v ?? "").trim())
    .pipe(z.union([z.literal(""), moneyInput({ allowZero: true })]))
    .transform((v) => (v === "" ? null : v)),
  currentValue: moneyInput({ allowZero: true, required: "Informe o valor atual" }),
  valuedAt: isoDate(),
  notes: optionalText(500),
});
export const updateAssetSchema = assetSchema.and(z.object({ id: z.string().uuid() }));
export const revalueAssetSchema = z.object({
  id: z.string().uuid(),
  value: moneyInput({ allowZero: true }),
  date: isoDate(),
});

export const liabilitySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(80, "Use até 80 caracteres"),
  kind: z.enum(LIABILITY_KINDS),
  creditor: optionalText(80),
  originalAmount: moneyInput({ required: "Informe o valor original" }),
  currentBalance: moneyInput({ allowZero: true, required: "Informe o saldo devedor atual" }),
  startDate: isoDate(),
  endDate: z.union([isoDate(), z.null()]),
  notes: optionalText(500),
});
export const updateLiabilitySchema = liabilitySchema.and(z.object({ id: z.string().uuid() }));

export type AssetInput = z.infer<typeof assetSchema>;
export type LiabilityInput = z.infer<typeof liabilitySchema>;
