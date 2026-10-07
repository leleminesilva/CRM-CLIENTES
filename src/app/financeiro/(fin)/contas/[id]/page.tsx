import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MonthSwitcher } from "@fin/components/shared/month-switcher";
import { PageHeader } from "@fin/components/shared/page-header";
import { Button } from "@fin/components/ui/button";
import { requirePageContext } from "@fin/lib/context";
import { resolveMonth, type SearchParams } from "@fin/lib/month";
import { AccountStatement } from "@fin/modules/accounts/components/account-statement";
import { listAccounts } from "@fin/modules/accounts/queries";
import { ACCOUNT_TYPE_LABELS } from "@fin/modules/accounts/types";
import { accountStatement } from "@fin/modules/transactions/queries";

export const metadata: Metadata = { title: "Extrato da conta" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePageContext();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { month, currentMonth } = resolveMonth((await searchParams).mes, ctx.today);
  const { accounts } = await listAccounts(ctx, { includeArchived: true });
  const account = accounts.find((a) => a.id === id);
  if (!account) notFound();
  const statement = await accountStatement(ctx, id, month, ctx.today);

  return (
    <div className="grid gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2.5">
          <Link href="/financeiro/contas">
            <ChevronLeftIcon /> Contas
          </Link>
        </Button>
        <PageHeader
          title={account.name}
          description={`${ACCOUNT_TYPE_LABELS[account.type]}${account.institution ? ` · ${account.institution}` : ""}`}
          actions={<MonthSwitcher month={month} currentMonth={currentMonth} />}
        />
      </div>
      <AccountStatement
        account={{ id: account.id, name: account.name, balance: account.balance }}
        statement={statement}
        today={ctx.today}
      />
    </div>
  );
}
