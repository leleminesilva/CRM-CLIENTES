"use client";

import { PlusIcon, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@fin/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@fin/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@fin/components/ui/dialog";
import { Tooltip } from "@fin/components/ui/tooltip";
import { OPEN_SHORTCUTS_EVENT } from "@fin/components/layout/shortcuts-dialog";
import { NAV_FOOTER, NAV_GROUPS } from "@fin/components/layout/nav";
import { MoneyText } from "@fin/components/shared/money-text";
import { parseQuickEntry } from "@fin/modules/transactions/domain/quick-entry";
import { useTransactionForm } from "@fin/modules/transactions/components/transaction-form-provider";
import { matches } from "../domain/normalize";
import { SEARCH_KIND_LABEL, type SearchHit, type SearchKind } from "../types";

const PAGES = [...NAV_GROUPS.flatMap((g) => g.items), ...NAV_FOOTER];
const KIND_ORDER: SearchKind[] = [
  "transaction",
  "commission",
  "installment",
  "subscription",
  "account",
  "card",
  "category",
  "goal",
  "asset",
  "liability",
];

/** ⌘K / Ctrl+K (ou "/") abre a busca global: páginas, ações e dados do workspace. */
export function CommandPalette() {
  const router = useRouter();
  const { openCreate, options, today } = useTransactionForm();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isK = e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey);
      const isSlash =
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !(e.target as HTMLElement | null)?.closest(
          "input, textarea, select, [contenteditable=true], [role=dialog], [role=alertdialog], [role=combobox]",
        );
      if (!isK && !isSlash) return;
      e.preventDefault();
      setOpen((v) => !v);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setHits([]);
      setFailed(false);
    }
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setFailed(false);
    setLoading(value.trim().length >= 2);
    if (value.trim().length < 2) setHits([]);
  }

  // Busca com atraso curto; respostas antigas são descartadas.
  React.useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    async function run() {
      try {
        const res = await fetch(`/api/fin/busca?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { hits: SearchHit[] };
        setHits(data.hits);
        setFailed(false);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    const timer = setTimeout(() => void run(), 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const quick = React.useMemo(
    () =>
      parseQuickEntry(query, {
        today,
        accounts: options.accounts,
        cards: options.cards,
        categories: (["income", "expense"] as const).flatMap((k) =>
          options.categories[k].flatMap((g) => [
            { id: g.id, name: g.name, kind: g.kind, parentName: null },
            ...g.children.map((c) => ({
              id: c.id,
              name: c.name,
              kind: c.kind,
              parentName: g.name,
            })),
          ]),
        ),
      }),
    [query, options, today],
  );

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const term = query.trim();
  const pages = PAGES.filter((p) => !term || matches(p.label, term));
  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    items: hits.filter((h) => h.kind === kind),
  })).filter((g) => g.items.length > 0);
  const empty =
    !quick && term.length >= 2 && !loading && !failed && hits.length === 0 && pages.length === 0;

  return (
    <>
      <Tooltip content="Buscar (⌘K)">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Buscar"
          aria-keyshortcuts="Control+K Meta+K"
          onClick={() => setOpen(true)}
        >
          <SearchIcon />
        </Button>
      </Tooltip>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          size="md"
          hideClose
          className="top-[12vh] gap-0 overflow-hidden p-0 sm:top-[14vh] sm:translate-y-0 sm:p-0"
        >
          <DialogTitle className="sr-only">Busca global</DialogTitle>
          <DialogDescription className="sr-only">
            Procure lançamentos, comissões, contas, cartões e páginas.
          </DialogDescription>
          <Command shouldFilter={false} label="Busca global">
            <CommandInput
              value={query}
              onValueChange={onQueryChange}
              placeholder="Buscar, ou lançar: 250 combustível nubank"
              aria-label="Buscar"
            />
            <CommandList className="max-h-[60dvh]">
              {quick ? (
                <CommandGroup heading="Lançamento rápido">
                  <CommandItem
                    value="lancamento-rapido"
                    onSelect={() => {
                      onOpenChange(false);
                      openCreate({
                        type: quick.type,
                        amount: quick.amount,
                        description: quick.description,
                        date: quick.date,
                        categoryId: quick.categoryId,
                        accountId: quick.accountId,
                        creditCardId: quick.creditCardId,
                        settled: quick.settled,
                      });
                    }}
                  >
                    <PlusIcon className="size-4 text-ink-3" />
                    <span className="grid min-w-0">
                      <span className="truncate">{quick.summary}</span>
                      <span className="truncate text-xs text-ink-2">
                        Abre o lançamento preenchido para você conferir
                      </span>
                    </span>
                  </CommandItem>
                </CommandGroup>
              ) : null}
              {term.length < 2 ? (
                <CommandGroup heading="Ações">
                  <CommandItem
                    value="novo-lancamento"
                    onSelect={() => {
                      onOpenChange(false);
                      openCreate();
                    }}
                  >
                    Novo lançamento
                  </CommandItem>
                  <CommandItem
                    value="atalhos"
                    onSelect={() => {
                      onOpenChange(false);
                      window.dispatchEvent(new Event(OPEN_SHORTCUTS_EVENT));
                    }}
                  >
                    Ver atalhos do teclado
                  </CommandItem>
                </CommandGroup>
              ) : null}
              {grouped.map((g) => (
                <CommandGroup key={g.kind} heading={SEARCH_KIND_LABEL[g.kind]}>
                  {g.items.map((h) => (
                    <CommandItem
                      key={`${h.kind}-${h.id}`}
                      value={`${h.kind}-${h.id}`}
                      onSelect={() => go(h.href)}
                      className="justify-between gap-3"
                    >
                      <span className="grid min-w-0">
                        <span className="truncate">{h.title}</span>
                        <span className="truncate text-xs text-ink-2">{h.subtitle}</span>
                      </span>
                      {h.amount ? (
                        <MoneyText
                          value={h.amount}
                          variant="table"
                          tone={h.flow === "in" ? "positive" : "default"}
                        />
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              {pages.length > 0 ? (
                <CommandGroup heading="Páginas">
                  {pages.map((p) => (
                    <CommandItem
                      key={p.href}
                      value={`pagina-${p.href}`}
                      onSelect={() => go(p.href)}
                    >
                      <p.icon className="size-4 text-ink-3" />
                      {p.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {loading ? (
                <p role="status" className="px-3 py-3 text-center text-xs text-ink-3">
                  Buscando…
                </p>
              ) : null}
              {failed ? (
                <p role="alert" className="px-3 py-3 text-center text-[13px] text-critical">
                  Não foi possível buscar agora. Tente de novo.
                </p>
              ) : null}
              {empty ? <CommandEmpty>Nada encontrado para “{term}”.</CommandEmpty> : null}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
