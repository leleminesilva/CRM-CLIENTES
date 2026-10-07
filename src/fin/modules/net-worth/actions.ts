"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authActionClient } from "@fin/lib/safe-action";
import {
  assetSchema,
  liabilitySchema,
  revalueAssetSchema,
  updateAssetSchema,
  updateLiabilitySchema,
} from "./schemas";
import {
  archiveAsset,
  createAsset,
  createLiability,
  deleteAsset,
  deleteLiability,
  revalueAsset,
  updateAsset,
  updateLiability,
} from "./service";

const refresh = () => revalidatePath("/", "layout");
const id = z.object({ id: z.string().uuid() });

export const createAssetAction = authActionClient
  .metadata({ name: "assets.create" })
  .inputSchema(assetSchema)
  .action(async ({ parsedInput, ctx }) => {
    await createAsset(ctx.app, parsedInput);
    refresh();
  });
export const updateAssetAction = authActionClient
  .metadata({ name: "assets.update" })
  .inputSchema(updateAssetSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id: assetId, ...input } = parsedInput;
    await updateAsset(ctx.app, assetId, input);
    refresh();
  });
export const revalueAssetAction = authActionClient
  .metadata({ name: "assets.revalue" })
  .inputSchema(revalueAssetSchema)
  .action(async ({ parsedInput, ctx }) => {
    await revalueAsset(ctx.app, parsedInput.id, parsedInput.value, parsedInput.date);
    refresh();
  });
export const archiveAssetAction = authActionClient
  .metadata({ name: "assets.archive" })
  .inputSchema(id)
  .action(async ({ parsedInput, ctx }) => {
    await archiveAsset(ctx.app, parsedInput.id, true);
    refresh();
  });
export const deleteAssetAction = authActionClient
  .metadata({ name: "assets.delete" })
  .inputSchema(id)
  .action(async ({ parsedInput, ctx }) => {
    await deleteAsset(ctx.app, parsedInput.id);
    refresh();
  });
export const createLiabilityAction = authActionClient
  .metadata({ name: "liabilities.create" })
  .inputSchema(liabilitySchema)
  .action(async ({ parsedInput, ctx }) => {
    await createLiability(ctx.app, parsedInput, ctx.app.today);
    refresh();
  });
export const updateLiabilityAction = authActionClient
  .metadata({ name: "liabilities.update" })
  .inputSchema(updateLiabilitySchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id: liabilityId, ...input } = parsedInput;
    await updateLiability(ctx.app, liabilityId, input, ctx.app.today);
    refresh();
  });
export const deleteLiabilityAction = authActionClient
  .metadata({ name: "liabilities.delete" })
  .inputSchema(id)
  .action(async ({ parsedInput, ctx }) => {
    await deleteLiability(ctx.app, parsedInput.id);
    refresh();
  });
