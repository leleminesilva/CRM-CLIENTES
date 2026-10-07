import type { Metadata } from "next";
import { requirePageContext } from "@fin/lib/context";
import { GoalsView } from "@fin/modules/goals/components/goals-view";
import { emergencyFund, listGoals } from "@fin/modules/goals/queries";
import { loadFormOptions } from "@fin/modules/transactions/queries";

export const metadata: Metadata = { title: "Metas" };

export default async function GoalsPage() {
  const ctx = await requirePageContext();
  const [goals, fund, options] = await Promise.all([
    listGoals(ctx, ctx.today),
    emergencyFund(ctx, ctx.today),
    loadFormOptions(ctx),
  ]);
  return <GoalsView goals={goals} fund={fund} accounts={options.accounts} today={ctx.today} />;
}
