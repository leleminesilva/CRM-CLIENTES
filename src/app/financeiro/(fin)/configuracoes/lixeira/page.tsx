import type { Metadata } from "next";
import { requirePageContext } from "@fin/lib/context";
import { TrashView } from "@fin/modules/transactions/components/trash-view";
import { listTrash } from "@fin/modules/transactions/queries";

export const metadata: Metadata = { title: "Lixeira" };

export default async function TrashPage() {
  const ctx = await requirePageContext();
  return <TrashView items={await listTrash(ctx, ctx.today)} />;
}
