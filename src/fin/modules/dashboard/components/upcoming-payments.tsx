"use client";

import { CreditCardIcon, OctagonAlertIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { CategoryIconChip } from "@fin/components/shared/category-chip";
import { MoneyText } from "@fin/components/shared/money-text";
import { Panel, PanelHeader } from "@fin/components/shared/panel";
import { Segmented } from "@fin/components/ui/segmented";
import { addDays, formatRelativeDay, formatWeekdayDate, type ISODate } from "@fin/lib/dates";
import { sumMoney, toMoneyString } from "@fin/lib/money";
import type { UpcomingItem } from "../queries";

/** Próximos vencimentos (7, 15 ou 30 dias), com as vencidas sempre no topo. */
export function UpcomingPayments({ items, today }: { items: UpcomingItem[]; today: ISODate }) {
  const [days, setDays] = React.useState<"7" | "15" | "30">("7");
  const limit = addDays(today, Number.parseInt(days, 10));
  const visible = items.filter((i) => i.dueDate <= limit);
  const total = toMoneyString(sumMoney(visible.map((i) => i.amount)));

  return (
    <Panel className="flex flex-col">
      <PanelHeader
        title="Próximos vencimentos"
        description={
          <>
            <MoneyText value={total} className="font-medium text-ink" /> em {visible.length}{" "}
            {visible.length === 1 ? "conta" : "contas"}
          </>
        }
      />
      <div className="px-5 pt-3">
        <Segmented
          aria-label="Período"
          value={days}
          onValueChange={setDays}
          options={[
            { value: "7", label: "7 dias" },
            { value: "15", label: "15 dias" },
            { value: "30", label: "30 dias" },
          ]}
          className="w-full"
        />
      </div>
      {visible.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-ink-3">Nada vencendo neste período.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {visible.slice(0, 8).map((i) => (
            <li key={i.id}>
              <Link
                href={i.href}
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-sunken"
              >
                {i.kind === "invoice" ? (
                  <span
                    className="inline-flex size-7 items-center justify-center rounded-[7px] bg-surface-sunken text-ink-2"
                    aria-hidden
                  >
                    <CreditCardIcon className="size-4" />
                  </span>
                ) : i.category ? (
                  <CategoryIconChip icon={i.category.icon} color={i.category.color} />
                ) : (
                  <span className="size-7" />
                )}
                <span className="grid min-w-0 flex-1">
                  <span className="truncate text-sm">{i.description}</span>
                  <span
                    className={`flex items-center gap-1 text-xs ${i.overdue ? "font-medium text-critical" : "text-ink-3"}`}
                  >
                    {i.overdue ? <OctagonAlertIcon className="size-3" aria-hidden /> : null}
                    {i.overdue
                      ? `Vencida ${formatRelativeDay(i.dueDate, today)}`
                      : `${formatWeekdayDate(i.dueDate)} · ${formatRelativeDay(i.dueDate, today)}`}
                  </span>
                </span>
                <MoneyText value={i.amount} variant="table" className="text-sm font-medium" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {visible.length > 8 ? (
        <p className="px-5 py-2 text-xs text-ink-3">e mais {visible.length - 8}…</p>
      ) : null}
    </Panel>
  );
}
