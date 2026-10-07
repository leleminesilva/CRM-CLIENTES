"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Button } from "@fin/components/ui/button";
import { Input } from "@fin/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@fin/components/ui/select";
import type { FormOptions } from "../form-options";

const ALL = "__all__";

interface TransactionFiltersProps {
  options: FormOptions;
  /** Esconde o filtro de tipo (páginas que já são só receitas ou despesas). */
  hideType?: boolean;
}

/** Filtros guardados na URL: links compartilháveis e botão voltar funcionam. */
export function TransactionFilters({ options, hideType }: TransactionFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get("q") ?? "");
  const timer = React.useRef<number | undefined>(undefined);

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname, {
      scroll: false,
    });
  }

  const active = ["tipo", "status", "categoria", "conta", "q"].filter((k) => params.get(k));
  const groups = [...options.categories.expense, ...options.categories.income];

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="search"
      aria-label="Filtros de lançamentos"
    >
      <div className="relative min-w-48 flex-1 sm:max-w-64">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(
              () => update("q", e.target.value.trim() || null),
              300,
            );
          }}
          placeholder="Buscar descrição"
          aria-label="Buscar por descrição"
          className="pl-9"
        />
      </div>
      {!hideType ? (
        <Select
          value={params.get("tipo") ?? ALL}
          onValueChange={(v) => update("tipo", v === ALL ? null : v)}
        >
          <SelectTrigger aria-label="Tipo" className="w-auto min-w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os tipos</SelectItem>
            <SelectItem value="receita">Receitas</SelectItem>
            <SelectItem value="despesa">Despesas</SelectItem>
            <SelectItem value="transferencia">Transferências</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
      <Select
        value={params.get("status") ?? ALL}
        onValueChange={(v) => update("status", v === ALL ? null : v)}
      >
        <SelectTrigger aria-label="Status" className="w-auto min-w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos os status</SelectItem>
          <SelectItem value="pendente">Pendentes</SelectItem>
          <SelectItem value="atrasado">Atrasados</SelectItem>
          <SelectItem value="liquidado">Pagos e recebidos</SelectItem>
          <SelectItem value="cancelado">Cancelados</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={params.get("categoria") ?? ALL}
        onValueChange={(v) => update("categoria", v === ALL ? null : v)}
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
      <Select
        value={params.get("conta") ?? ALL}
        onValueChange={(v) => update("conta", v === ALL ? null : v)}
      >
        <SelectTrigger aria-label="Conta" className="w-auto min-w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas as contas</SelectItem>
          {options.accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {active.length > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            const next = new URLSearchParams(params.toString());
            for (const k of ["tipo", "status", "categoria", "conta", "q"]) next.delete(k);
            router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname, {
              scroll: false,
            });
          }}
        >
          <XIcon /> Limpar filtros
        </Button>
      ) : null}
    </div>
  );
}
