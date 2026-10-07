import { cn } from "@fin/lib/cn";

/** Contraste: texto branco em cores escuras, tinta em cores claras. */
function readableOn(hex: string | null): "light" | "dark" {
  if (!hex) return "light";
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? "dark" : "light";
}

/** Miniatura do cartão na cor do banco (identidade, não decoração). */
export function CardArt({
  name,
  issuer,
  lastFour,
  color,
  className,
}: {
  name: string;
  issuer: string;
  lastFour: string | null;
  color: string | null;
  className?: string;
}) {
  const tone = readableOn(color);
  return (
    <div
      aria-hidden
      className={cn(
        "relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-[10px] p-3",
        tone === "light" ? "text-white" : "text-[#111915]",
        className,
      )}
      style={{ backgroundColor: color ?? "#2c3430" }}
    >
      <span className="truncate text-[11px] font-medium opacity-80">{issuer}</span>
      <div className="flex items-end justify-between gap-2">
        <span className="truncate text-[13px] leading-4 font-semibold [font-variation-settings:'wdth'_108]">
          {name}
        </span>
        {lastFour ? <span className="text-[11px] nums opacity-80">•••• {lastFour}</span> : null}
      </div>
    </div>
  );
}
