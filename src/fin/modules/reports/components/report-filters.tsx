"use client";

import { XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@fin/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@fin/components/ui/select";
import type { FormOptions } from "@fin/modules/transactions/form-options";
import type { ReportFilters } from "../types";

const ALL = "__all__";
const KEYS = ["tipo", "status", "categoria", "conta", "cartao", "de", "ate"];

export function ReportFilterBar({
  filters,
  options,
  kind,
}: {
  filters: ReportFilters;
  options: FormOptions;
  kind: "range" | "months" | "years" | "none";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const select = (
    key: string,
    label: string,
    items: { value: string; label: string }[],
    placeholder: string,
  ) => (
    <Select value={params.get(key) ?? ALL} onValueChange={(v) => set(key, v === ALL ? null : v)}>
      <SelectTrigger aria-label={label} className="w-auto min-w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  const date = (key: string, label: string, value: string) => (
    <label className="grid gap-1 text-xs text-ink-3">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => e.target.value && set(key, e.target.value)}
        className="h-9 rounded-control border border-line-strong bg-surface px-2 text-sm text-ink"
      />
    </label>
  );

  if (kind === "none") return null;
  if (kind === "months") {
    return (
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-ink-3">
          Mês A
          <input
            type="month"
            value={filters.monthA}
            onChange={(e) => e.target.value && set("mesa", e.target.value)}
            className="h-9 rounded-control border border-line-strong bg-surface px-2 text-sm text-ink"
          />
        </label>
        <label className="grid gap-1 text-xs text-ink-3">
          Mês B
          <input
            type="month"
            value={filters.monthB}
            onChange={(e) => e.target.value && set("mesb", e.target.value)}
            className="h-9 rounded-control border border-line-strong bg-surface px-2 text-sm text-ink"
          />
        </label>
      </div>
    );
  }
  if (kind === "years") {
    const year = Number(filters.yearB);
    const years = Array.from({ length: 8 }, (_, i) => String(year + 1 - i));
    return (
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1 text-xs text-ink-3">
          Ano A
          {select(
            "anoa",
            "Ano A",
            years.map((y) => ({ value: y, label: y })),
            filters.yearA!,
          )}
        </div>
        <div className="grid gap-1 text-xs text-ink-3">
          Ano B
          {select(
            "anob",
            "Ano B",
            years.map((y) => ({ value: y, label: y })),
            filters.yearB!,
          )}
        </div>
      </div>
    );
  }
  const groups = [...options.categories.expense, ...options.categories.income];
  return (
    <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Filtros do relatório">
      {date("de", "De", filters.from)}
      {date("ate", "Até", filters.to)}
      {select(
        "tipo",
        "Tipo",
        [
          { value: "receita", label: "Receitas" },
          { value: "despesa", label: "Despesas" },
        ],
        "Receitas e despesas",
      )}
      {select(
        "status",
        "Status",
        [
          { value: "pendente", label: "Pendentes" },
          { value: "atrasado", label: "Atrasados" },
          { value: "liquidado", label: "Pagos e recebidos" },
          { value: "cancelado", label: "Cancelados" },
        ],
        "Todos os status",
      )}
      <Select
        value={params.get("categoria") ?? ALL}
        onValueChange={(v) => set("categoria", v === ALL ? null : v)}
      >
        <SelectTrigger aria-label="Categoria" className="w-auto min-w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas as categorias</SelectItem>
          {groups.map((g) => (
            <SelectGroup key={g.id}>
              <SelectLabel>{g.kind === "INCOME" ? "Receita" : "Despesa"}</SelectLabel>
              <SelectItem value={g.id}>{g.name}</SelectItem>
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {select(
        "conta",
        "Conta",
        options.accounts.map((a) => ({ value: a.id, label: a.name })),
        "Todas as contas",
      )}
      {options.cards.length
        ? select(
            "cartao",
            "Cartão",
            options.cards.map((c) => ({ value: c.id, label: c.name })),
            "Todos os cartões",
          )
        : null}
      {KEYS.some((k) => !["de", "ate"].includes(k) && params.get(k)) ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.replace(pathname, { scroll: false })}
        >
          <XIcon /> Limpar filtros
        </Button>
      ) : null}
    </div>
  );
}
