"use client";

import {
  ArrowLeftRightIcon,
  BadgePercentIcon,
  CreditCardIcon,
  LayersIcon,
  ReceiptIcon,
  RepeatIcon,
  TrendingUpIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { MoneyText } from "@fin/components/shared/money-text";
import { Panel } from "@fin/components/shared/panel";
import { StatusBadge } from "@fin/components/shared/status-badge";
import { cn } from "@fin/lib/cn";
import { addDays, diffInDays, formatWeekdayDate, type ISODate, type MonthKey } from "@fin/lib/dates";
import { sumMoney, toMoney, toMoneyString } from "@fin/lib/money";
import type { CalendarEvent, EventKind } from "../queries";

export const KIND: Record<EventKind, { label: string; icon: LucideIcon; color: string }> = {
  salary: { label: "Salário", icon: WalletIcon, color: "var(--series-income)" },
  commission: { label: "Comissão", icon: BadgePercentIcon, color: "var(--series-commission)" },
  income: { label: "Recebimento", icon: TrendingUpIcon, color: "var(--series-income)" },
  bill: { label: "Conta", icon: ReceiptIcon, color: "var(--series-expense)" },
  installment: { label: "Parcela", icon: LayersIcon, color: "var(--series-expense)" },
  subscription: { label: "Assinatura", icon: RepeatIcon, color: "var(--series-variable)" },
  invoice: { label: "Fatura", icon: CreditCardIcon, color: "var(--ink)" },
  transfer: { label: "Transferência", icon: ArrowLeftRightIcon, color: "var(--ink-3)" },
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function net(events: CalendarEvent[]) {
  return toMoneyString(
    sumMoney(
      events.map((e) =>
        e.direction === "in"
          ? toMoney(e.amount)
          : e.direction === "out"
            ? toMoney(e.amount).negated()
            : toMoney(0),
      ),
    ),
  );
}

function EventRow({ e }: { e: CalendarEvent }) {
  const k = KIND[e.kind];
  return (
    <Link href={e.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-sunken">
      <span
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-[7px]"
        style={{
          backgroundColor: `color-mix(in oklab, ${k.color} 16%, var(--surface))`,
          color: `color-mix(in oklab, ${k.color} 78%, var(--ink))`,
        }}
        aria-hidden
      >
        <k.icon className="size-4" />
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="truncate text-sm">{e.title}</span>
        <span className="text-xs text-ink-3">{k.label}</span>
      </span>
      <span className="grid justify-items-end gap-0.5">
        <MoneyText
          value={e.direction === "out" ? `-${e.amount}` : e.amount}
          variant="table"
          sign={e.direction === "in" ? "always" : "auto"}
          tone={e.direction === "in" ? "positive" : "default"}
          className="text-sm font-medium"
        />
        <StatusBadge
          type={e.direction === "in" ? "INCOME" : e.kind === "transfer" ? "TRANSFER" : "EXPENSE"}
          status={e.status}
        />
      </span>
    </Link>
  );
}

export function CalendarView({
  month,
  start,
  end,
  today,
  events,
}: {
  month: MonthKey;
  start: ISODate;
  end: ISODate;
  today: ISODate;
  events: CalendarEvent[];
}) {
  const firstSelected = events.some((e) => e.date === today)
    ? today
    : (events.find((e) => e.date.startsWith(month))?.date ?? `${month}-01`);
  const [selected, setSelected] = React.useState<ISODate>(
    today.startsWith(month) ? today : firstSelected,
  );
  const days = Array.from({ length: diffInDays(end, start) + 1 }, (_, i) => addDays(start, i));
  const weeks = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const dayEvents = byDay.get(selected) ?? [];
  const kindsInMonth = [
    ...new Set(events.filter((e) => e.date.startsWith(month)).map((e) => e.kind)),
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Legenda">
          {kindsInMonth.map((k) => {
            const meta = KIND[k];
            return (
              <li key={k} className="flex items-center gap-1.5">
                <meta.icon
                  className="size-3.5"
                  style={{ color: `color-mix(in oklab, ${meta.color} 78%, var(--ink))` }}
                  aria-hidden
                />
                {meta.label}
              </li>
            );
          })}
        </ul>
        <Panel className="overflow-hidden max-md:hidden">
          <div className="grid grid-cols-7 border-b border-line bg-surface-sunken/60" aria-hidden>
            {WEEKDAYS.map((d) => (
              <span key={d} className="px-2 py-1.5 text-xs font-medium text-ink-3">
                {d}
              </span>
            ))}
          </div>
          <div role="grid" aria-label="Calendário do mês">
            {weeks.map((week) => (
              <div key={week[0]} role="row" className="grid grid-cols-7">
                {week.map((d) => {
                  const ev = byDay.get(d) ?? [];
                  const inMonth = d.startsWith(month);
                  const total = ev.length ? net(ev) : null;
                  return (
                    <button
                      key={d}
                      type="button"
                      role="gridcell"
                      aria-selected={d === selected}
                      aria-label={`${formatWeekdayDate(d)}: ${ev.length} ${ev.length === 1 ? "movimentação" : "movimentações"}`}
                      onClick={() => setSelected(d)}
                      className={cn(
                        "grid min-h-24 cursor-pointer content-start gap-1 border-r border-b border-line p-1.5 text-left transition-colors last:border-r-0 hover:bg-surface-sunken/60",
                        !inMonth && "bg-surface-sunken/40 text-ink-3",
                        d === selected && "bg-surface-sunken ring-2 ring-ink ring-inset",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full text-xs nums",
                          d === today && "bg-ink font-semibold text-on-ink",
                        )}
                      >
                        {Number.parseInt(d.slice(8), 10)}
                      </span>
                      {ev.length ? (
                        <>
                          <span className="flex flex-wrap gap-0.5" aria-hidden>
                            {ev.slice(0, 5).map((e) => {
                              const meta = KIND[e.kind];
                              return (
                                <meta.icon
                                  key={e.id}
                                  className="size-3.5"
                                  style={{
                                    color: `color-mix(in oklab, ${meta.color} 78%, var(--ink))`,
                                  }}
                                />
                              );
                            })}
                            {ev.length > 5 ? (
                              <span className="text-[10px] text-ink-3">+{ev.length - 5}</span>
                            ) : null}
                          </span>
                          {total ? (
                            <MoneyText
                              value={total}
                              sign="always"
                              tone={total.startsWith("-") ? "default" : "positive"}
                              className="text-[11px] nums"
                            />
                          ) : null}
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Panel>

        {/* Celular: agenda em lista */}
        <div className="grid gap-3 md:hidden">
          {[...byDay.entries()]
            .filter(([d]) => d.startsWith(month))
            .map(([d, ev]) => (
              <section key={d} aria-label={formatWeekdayDate(d)}>
                <h3 className="mb-1 flex items-center justify-between px-1 text-xs font-medium text-ink-2">
                  <span className="nums">{formatWeekdayDate(d)}</span>
                  <MoneyText value={net(ev)} sign="always" className="nums" />
                </h3>
                <Panel className="overflow-hidden">
                  <ul className="divide-y divide-line">
                    {ev.map((e) => (
                      <li key={e.id}>
                        <EventRow e={e} />
                      </li>
                    ))}
                  </ul>
                </Panel>
              </section>
            ))}
          {byDay.size === 0 ? (
            <p className="py-8 text-center text-[13px] text-ink-3">Nada agendado neste mês.</p>
          ) : null}
        </div>
      </div>

      <Panel className="self-start max-md:hidden lg:sticky lg:top-20">
        <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="title-section first-letter:uppercase">{formatWeekdayDate(selected)}</h2>
          {dayEvents.length ? (
            <MoneyText value={net(dayEvents)} sign="always" className="text-sm font-medium" />
          ) : null}
        </div>
        {dayEvents.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-ink-3">
            Nenhuma movimentação neste dia.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {dayEvents.map((e) => (
              <li key={e.id}>
                <EventRow e={e} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
