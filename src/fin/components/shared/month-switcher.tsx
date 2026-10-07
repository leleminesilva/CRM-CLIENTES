"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Button } from "@fin/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@fin/components/ui/popover";
import { cn } from "@fin/lib/cn";
import { addMonthsToKey, formatMonth, parseMonthKey } from "@fin/lib/dates";

const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Mês da página (na URL: ?mes=AAAA-MM). Atalhos: [ mês anterior · ] próximo mês. */
export function MonthSwitcher({ month, currentMonth }: { month: string; currentMonth: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [year, setYear] = React.useState(() => parseMonthKey(month).year);

  const hrefFor = React.useCallback(
    (key: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (key === currentMonth) params.delete("mes");
      else params.set("mes", key);
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [currentMonth, pathname, searchParams],
  );

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        target?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")
      )
        return;
      if (e.key === "[") router.push(hrefFor(addMonthsToKey(month, -1)), { scroll: false });
      if (e.key === "]") router.push(hrefFor(addMonthsToKey(month, 1)), { scroll: false });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hrefFor, month, router]);

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" asChild aria-label="Mês anterior">
        <Link href={hrefFor(addMonthsToKey(month, -1))} scroll={false}>
          <ChevronLeftIcon />
        </Link>
      </Button>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setYear(parseMonthKey(month).year);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 min-w-36 px-2 text-[15px] font-medium first-letter:uppercase"
            aria-label={`Mês: ${formatMonth(month)}. Escolher outro mês`}
          >
            <span className="first-letter:uppercase">{formatMonth(month)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-64">
          <div className="mb-2 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setYear((y) => y - 1)}
              aria-label="Ano anterior"
            >
              <ChevronLeftIcon />
            </Button>
            <span className="text-sm font-medium nums">{year}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setYear((y) => y + 1)}
              aria-label="Próximo ano"
            >
              <ChevronRightIcon />
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {SHORT.map((label, i) => {
              const key = `${year}-${String(i + 1).padStart(2, "0")}`;
              return (
                <Link
                  key={key}
                  href={hrefFor(key)}
                  scroll={false}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "inline-flex h-9 items-center justify-center rounded-[6px] text-sm hover:bg-surface-sunken",
                    key === month && "bg-ink font-medium text-on-ink hover:bg-ink",
                    key === currentMonth && key !== month && "ring-1 ring-line-strong",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>
          {month !== currentMonth ? (
            <Button variant="secondary" size="sm" className="mt-3 w-full" asChild>
              <Link href={hrefFor(currentMonth)} scroll={false} onClick={() => setOpen(false)}>
                Voltar para o mês atual
              </Link>
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="icon-sm" asChild aria-label="Próximo mês">
        <Link href={hrefFor(addMonthsToKey(month, 1))} scroll={false}>
          <ChevronRightIcon />
        </Link>
      </Button>
    </div>
  );
}
