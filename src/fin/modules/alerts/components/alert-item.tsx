"use client";

import { AlarmClockIcon, CheckIcon, EllipsisIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@fin/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@fin/components/ui/dropdown-menu";
import { handleActionResult } from "@fin/lib/action-result";
import { cn } from "@fin/lib/cn";
import { dismissAlertAction, markAlertReadAction, snoozeAlertAction } from "../actions";
import type { AlertDTO } from "../queries";
import { PriorityMark } from "./priority-mark";

export function AlertItem({ alert, compact = false }: { alert: AlertDTO; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3",
        compact ? "px-4 py-3" : "px-5 py-4",
        !alert.read && "bg-surface-sunken/40",
      )}
    >
      <PriorityMark priority={alert.priority} />
      <div className="grid min-w-0 flex-1 gap-0.5">
        {alert.href ? (
          <Link
            href={alert.href}
            onClick={() => !alert.read && void markAlertReadAction({ id: alert.id })}
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            {alert.title}
          </Link>
        ) : (
          <span className="text-sm font-medium">{alert.title}</span>
        )}
        <span className="text-[13px] leading-5 text-ink-2">{alert.body}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações do alerta: ${alert.title}`}>
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!alert.read ? (
            <DropdownMenuItem onSelect={() => void markAlertReadAction({ id: alert.id })}>
              <CheckIcon /> Marcar como lido
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={async () => {
              if (handleActionResult(await snoozeAlertAction({ id: alert.id, days: 1 })))
                toast.success("Alerta adiado até amanhã");
            }}
          >
            <AlarmClockIcon /> Lembrar amanhã
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={async () => {
              if (handleActionResult(await snoozeAlertAction({ id: alert.id, days: 7 })))
                toast.success("Alerta adiado por 1 semana");
            }}
          >
            <AlarmClockIcon /> Lembrar em 1 semana
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={async () => {
              if (handleActionResult(await dismissAlertAction({ id: alert.id })))
                toast.success("Alerta dispensado");
            }}
          >
            <XIcon /> Dispensar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
