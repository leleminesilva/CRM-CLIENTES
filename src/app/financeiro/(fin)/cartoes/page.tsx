import type { Metadata } from "next";
import { requirePageContext } from "@fin/lib/context";
import { CardsView } from "@fin/modules/credit-cards/components/cards-view";
import { listCards } from "@fin/modules/credit-cards/queries";
import { loadFormOptions } from "@fin/modules/transactions/queries";

export const metadata: Metadata = { title: "Cartões" };

export default async function CardsPage() {
  const ctx = await requirePageContext();
  const [cards, options] = await Promise.all([
    listCards(ctx, ctx.today, { includeArchived: true }),
    loadFormOptions(ctx),
  ]);
  return <CardsView cards={cards} accounts={options.accounts} today={ctx.today} />;
}
