import { cn } from "@fin/lib/cn";
import { EllipsisIcon, type LucideIcon } from "lucide-react";
import { CATEGORY_ICONS } from "@fin/modules/categories/icons";

const ICONS: Record<string, LucideIcon> = CATEGORY_ICONS;

/** Ícone da categoria num quadrado tingido com a cor dela (DS §7). Funciona nos dois temas. */
export function CategoryIconChip({
  icon,
  color,
  size = "md",
  className,
}: {
  icon: string;
  color: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const Icon = ICONS[icon] ?? EllipsisIcon;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[7px]",
        size === "md" ? "size-7" : "size-6",
        className,
      )}
      style={{
        backgroundColor: `color-mix(in oklab, ${color} 16%, var(--surface))`,
        color: `color-mix(in oklab, ${color} 78%, var(--ink))`,
      }}
    >
      <Icon className={size === "md" ? "size-4" : "size-3.5"} strokeWidth={1.9} />
    </span>
  );
}
