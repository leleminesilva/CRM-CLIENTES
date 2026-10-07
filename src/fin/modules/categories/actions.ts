"use server";

import { revalidatePath } from "next/cache";
import { authActionClient } from "@fin/lib/safe-action";
import { idInput } from "@fin/lib/validation";
import {
  createCategorySchema,
  mergeCategoriesSchema,
  reorderCategoriesSchema,
  updateCategorySchema,
} from "./schemas";
import {
  archiveCategory,
  createCategory,
  deleteCategory,
  mergeCategories,
  reorderCategories,
  unarchiveCategory,
  updateCategory,
} from "./service";

const PATH = "/financeiro/configuracoes/categorias";

export const createCategoryAction = authActionClient
  .metadata({ name: "categories.create" })
  .inputSchema(createCategorySchema)
  .action(async ({ parsedInput, ctx }) => {
    const created = await createCategory(ctx.app, parsedInput);
    revalidatePath(PATH);
    return { id: created.id };
  });

export const updateCategoryAction = authActionClient
  .metadata({ name: "categories.update" })
  .inputSchema(updateCategorySchema)
  .action(async ({ parsedInput, ctx }) => {
    await updateCategory(ctx.app, parsedInput);
    revalidatePath(PATH);
  });

export const reorderCategoriesAction = authActionClient
  .metadata({ name: "categories.reorder" })
  .inputSchema(reorderCategoriesSchema)
  .action(async ({ parsedInput, ctx }) => {
    await reorderCategories(ctx.app, parsedInput);
    revalidatePath(PATH);
  });

export const archiveCategoryAction = authActionClient
  .metadata({ name: "categories.archive" })
  .inputSchema(idInput)
  .action(async ({ parsedInput, ctx }) => {
    await archiveCategory(ctx.app, parsedInput.id);
    revalidatePath(PATH);
  });

export const unarchiveCategoryAction = authActionClient
  .metadata({ name: "categories.unarchive" })
  .inputSchema(idInput)
  .action(async ({ parsedInput, ctx }) => {
    await unarchiveCategory(ctx.app, parsedInput.id);
    revalidatePath(PATH);
  });

export const deleteCategoryAction = authActionClient
  .metadata({ name: "categories.delete" })
  .inputSchema(idInput)
  .action(async ({ parsedInput, ctx }) => {
    await deleteCategory(ctx.app, parsedInput.id);
    revalidatePath(PATH);
  });

export const mergeCategoriesAction = authActionClient
  .metadata({ name: "categories.merge" })
  .inputSchema(mergeCategoriesSchema)
  .action(async ({ parsedInput, ctx }) => {
    const result = await mergeCategories(ctx.app, parsedInput.sourceId, parsedInput.targetId);
    revalidatePath(PATH);
    return result;
  });
