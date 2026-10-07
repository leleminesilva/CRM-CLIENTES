import { CheckIcon, ClockIcon, OctagonAlertIcon, XIcon } from "lucide-react";
import type { TransactionType } from "@prisma/client";
import { cn } from "@fin/lib/cn";
import { type DisplayStatus, statusLabel } from "@fin/modules/transactions/domain/status";

/** Status do lançamento: cor só na marca, sempre com ícone e texto (DS §2.3). */
export function StatusBadge({
  type,
  status,
  className,
}: {
  type: TransactionType;
  status: DisplayStatus;
  className?: string;
}) {
  const label = statusLabel(type, status);
  const styles: Record<DisplayStatus, { icon: typeof CheckIcon; mark: string; text: string }> = {
    SETTLED: { icon: CheckIcon, mark: "bg-status-good/14 text-status-good", text: "text-ink-2" },
    PENDING: { icon: ClockIcon, mark: "bg-surface-sunken text-ink-3", text: "text-ink-2" },
    OVERDUE: {
      icon: OctagonAlertIcon,
      mark: "bg-status-critical/14 text-critical",
      text: "text-critical font-medium",
    },
    CANCELED: {
      icon: XIcon,
      mark: "bg-surface-sunken text-ink-3",
      text: "text-ink-3 line-through",
    },
  };
  const s = styles[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs whitespace-nowrap",
        s.text,
        className,
      )}
    >
      <span className={cn("inline-flex size-4 items-center justify-center rounded-full", s.mark)}>
        <s.icon className="size-2.5" strokeWidth={3} />
      </span>
      {label}
    </span>
  );
}
