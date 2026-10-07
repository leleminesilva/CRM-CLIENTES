import { CircleAlertIcon, InfoIcon, OctagonAlertIcon, TriangleAlertIcon } from "lucide-react";
import type { NotificationPriority } from "@prisma/client";
import { cn } from "@fin/lib/cn";

export const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  INFO: "Informação",
  ATTENTION: "Atenção",
  IMPORTANT: "Importante",
  CRITICAL: "Crítico",
};

const STYLE: Record<NotificationPriority, { icon: typeof InfoIcon; className: string }> = {
  INFO: { icon: InfoIcon, className: "bg-surface-sunken text-ink-2" },
  ATTENTION: { icon: TriangleAlertIcon, className: "bg-status-warning/20 text-warning-text" },
  IMPORTANT: {
    icon: CircleAlertIcon,
    className:
      "bg-status-serious/20 text-[color-mix(in_oklab,var(--color-status-serious)_55%,var(--ink))]",
  },
  CRITICAL: { icon: OctagonAlertIcon, className: "bg-status-critical/15 text-critical" },
};

/** Prioridade do alerta: ícone + cor + texto (nunca só cor — DS §2.3). */
export function PriorityMark({
  priority,
  withLabel = false,
  className,
}: {
  priority: NotificationPriority;
  withLabel?: boolean;
  className?: string;
}) {
  const s = STYLE[priority];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5", className)}>
      <span
        className={cn("inline-flex size-7 items-center justify-center rounded-full", s.className)}
        aria-hidden
      >
        <s.icon className="size-4" />
      </span>
      {withLabel ? (
        <span className="text-xs font-medium text-ink-2">{PRIORITY_LABELS[priority]}</span>
      ) : (
        <span className="sr-only">{PRIORITY_LABELS[priority]}</span>
      )}
    </span>
  );
}
