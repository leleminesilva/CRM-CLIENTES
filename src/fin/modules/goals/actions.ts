"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authActionClient } from "@fin/lib/safe-action";
import { contributionSchema, createGoalSchema, updateGoalSchema } from "./schemas";
import {
  addContribution,
  createGoal,
  deleteContribution,
  deleteGoal,
  setGoalStatus,
  updateGoal,
} from "./service";

const refresh = () => revalidatePath("/", "layout");

export const createGoalAction = authActionClient
  .metadata({ name: "goals.create" })
  .inputSchema(createGoalSchema)
  .action(async ({ parsedInput, ctx }) => {
    const g = await createGoal(ctx.app, parsedInput);
    refresh();
    return { id: g.id };
  });

export const updateGoalAction = authActionClient
  .metadata({ name: "goals.update" })
  .inputSchema(updateGoalSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...input } = parsedInput;
    await updateGoal(ctx.app, id, input);
    refresh();
  });

export const setGoalStatusAction = authActionClient
  .metadata({ name: "goals.setStatus" })
  .inputSchema(z.object({ id: z.string().uuid(), status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]) }))
  .action(async ({ parsedInput, ctx }) => {
    await setGoalStatus(ctx.app, parsedInput.id, parsedInput.status);
    refresh();
  });

export const deleteGoalAction = authActionClient
  .metadata({ name: "goals.delete" })
  .inputSchema(z.object({ id: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteGoal(ctx.app, parsedInput.id);
    refresh();
  });

export const addContributionAction = authActionClient
  .metadata({ name: "goals.contribute" })
  .inputSchema(contributionSchema)
  .action(async ({ parsedInput, ctx }) => {
    await addContribution(ctx.app, parsedInput);
    refresh();
  });

export const deleteContributionAction = authActionClient
  .metadata({ name: "goals.deleteContribution" })
  .inputSchema(z.object({ id: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteContribution(ctx.app, parsedInput.id);
    refresh();
  });
