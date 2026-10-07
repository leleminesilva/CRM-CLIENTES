import type { Metadata } from "next";
import { requirePageContext } from "@fin/lib/context";
import { SubscriptionsView } from "@fin/modules/subscriptions/components/subscriptions-view";
import { listSubscriptions } from "@fin/modules/subscriptions/queries";
import { loadFormOptions } from "@fin/modules/transactions/queries";

export const metadata: Metadata = { title: "Assinaturas" };

export default async function SubscriptionsPage() {
  const ctx = await requirePageContext();
  const [data, options] = await Promise.all([
    listSubscriptions(ctx, ctx.today),
    loadFormOptions(ctx),
  ]);
  return <SubscriptionsView data={data} options={options} today={ctx.today} />;
}
