import type { Metadata } from "next";
import { requirePageContext } from "@fin/lib/context";
import { NetWorthView } from "@fin/modules/net-worth/components/net-worth-view";
import {
  listAssets,
  listLiabilities,
  netWorthAsOf,
  netWorthHistory,
} from "@fin/modules/net-worth/queries";

export const metadata: Metadata = { title: "Patrimônio" };

export default async function NetWorthPage() {
  const ctx = await requirePageContext();
  const [snapshot, history, assets, liabilities] = await Promise.all([
    netWorthAsOf(ctx, ctx.today),
    netWorthHistory(ctx, ctx.today, 12),
    listAssets(ctx),
    listLiabilities(ctx),
  ]);
  return (
    <NetWorthView
      snapshot={snapshot}
      history={history}
      assets={assets}
      liabilities={liabilities}
      today={ctx.today}
    />
  );
}
