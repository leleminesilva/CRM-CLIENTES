import type { Metadata } from "next";
import { requirePageContext } from "@fin/lib/context";
import { AccountsView } from "@fin/modules/accounts/components/accounts-view";
import { listAccounts } from "@fin/modules/accounts/queries";

export const metadata: Metadata = { title: "Contas" };

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ arquivadas?: string }>;
}) {
  const ctx = await requirePageContext();
  const showArchived = (await searchParams).arquivadas === "1";
  const { accounts, summary } = await listAccounts(ctx, { includeArchived: showArchived });
  return (
    <AccountsView
      accounts={accounts}
      summary={summary}
      showArchived={showArchived}
      today={ctx.today}
    />
  );
}
