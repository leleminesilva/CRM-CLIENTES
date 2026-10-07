import { z } from "zod";
import { CATEGORY_COLOR_HEXES } from "./palette";
import { CATEGORY_ICON_NAMES } from "./icons";

export const categoryKindSchema = z.enum(["INCOME", "EXPENSE"]);
export const incomeClassSchema = z.enum(["BASE", "COMMISSION", "EXTRA", "OTHER"]);
export const expenseNatureSchema = z.enum(["FIXED", "VARIABLE"]);

const fields = {
  name: z.string().trim().min(1, "Informe o nome").max(40, "Use até 40 caracteres"),
  parentId: z.string().uuid().nullable(),
  icon: z.enum(CATEGORY_ICON_NAMES, { message: "Escolha um ícone" }),
  color: z.enum(CATEGORY_COLOR_HEXES, { message: "Escolha uma cor" }),
  incomeClass: incomeClassSchema.nullable(),
  defaultNature: expenseNatureSchema.nullable(),
  isEssential: z.boolean(),
};

export const createCategorySchema = z.object({ kind: categoryKindSchema, ...fields });
export const updateCategorySchema = z.object({ id: z.string().uuid(), ...fields });

export const reorderCategoriesSchema = z.object({
  parentId: z.string().uuid().nullable(),
  kind: categoryKindSchema,
  orderedIds: z.array(z.string().uuid()).min(1).max(300),
});

export const mergeCategoriesSchema = z
  .object({ sourceId: z.string().uuid(), targetId: z.string().uuid() })
  .refine((v) => v.sourceId !== v.targetId, {
    path: ["targetId"],
    message: "Escolha outra categoria",
  });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
