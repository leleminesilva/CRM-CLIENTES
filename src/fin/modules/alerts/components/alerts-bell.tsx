"use client";

import { BellIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@fin/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@fin/components/ui/popover";
import type { NotificationPriority } from "@prisma/client";
import { cn } from "@fin/lib/cn";
import type { AlertDTO } from "../queries";
import { AlertItem } from "./alert-item";

const DOT: Record<NotificationPriority, string> = {
  CRITICAL: "bg-status-critical",
  IMPORTANT: "bg-status-serious",
  ATTENTION: "bg-status-warning",
  INFO: "bg-ink-3",
};

export function AlertsBell({ alerts }: { alerts: AlertDTO[] }) {
  const unread = alerts.filter((a) => !a.read).length;
  const top = alerts[0]?.priority;
  const label = unread ? `Alertas: ${unread} não ${unread === 1 ? "lido" : "lidos"}` : "Alertas";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className="relative">
          <BellIcon />
          {unread > 0 && top ? (
            <span
              className={cn(
                "absolute top-1 right-1 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold text-white nums",
                DOT[top],
                top === "ATTENTION" && "text-[#3a2700]",
              )}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-sm font-semibold">Alertas</span>
          <Link
            href="/financeiro/alertas"
            className="text-xs font-medium text-ink-2 hover:text-ink hover:underline"
          >
            Ver todos
          </Link>
        </div>
        {alerts.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-ink-3">
            Tudo em dia. Nenhum alerta agora.
          </p>
        ) : (
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {alerts.slice(0, 6).map((a) => (
              <li key={a.id}>
                <AlertItem alert={a} compact />
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
