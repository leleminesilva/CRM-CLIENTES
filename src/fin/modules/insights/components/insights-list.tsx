import { LightbulbIcon, TriangleAlertIcon, TrendingUpIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@fin/lib/cn";
import type { Insight } from "../types";

const ICON = {
  neutral: LightbulbIcon,
  positive: TrendingUpIcon,
  warning: TriangleAlertIcon,
} as const;

/** Frases curtas com o número que as sustenta; clicar leva ao dado. */
export function InsightsList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0)
    return (
      <p className="px-5 py-8 text-center text-[13px] text-ink-3">
        Os insights aparecem quando houver histórico de lançamentos.
      </p>
    );
  return (
    <ul className="divide-y divide-line">
      {insights.map((i) => {
        const Icon = ICON[i.tone];
        const body = (
          <span className="flex items-start gap-3 px-5 py-3">
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                i.tone === "warning"
                  ? "text-warning-text"
                  : i.tone === "positive"
                    ? "text-positive"
                    : "text-ink-3",
              )}
              aria-hidden
            />
            <span className="text-sm leading-5">{i.text}</span>
          </span>
        );
        return (
          <li key={i.id}>
            {i.href ? (
              <Link href={i.href} className="block hover:bg-surface-sunken">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
