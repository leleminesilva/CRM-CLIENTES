"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@fin/components/ui/dialog";

export const OPEN_SHORTCUTS_EVENT = "app:open-shortcuts";

const GROUPS = [
  {
    title: "Em qualquer tela",
    items: [
      { keys: ["N"], label: "Novo lançamento" },
      { keys: ["⌘ K", "Ctrl K", "/"], label: "Buscar, ir para uma página ou lançar por texto" },
      { keys: ["?"], label: "Mostrar esta ajuda" },
      { keys: ["Esc"], label: "Fechar o diálogo aberto" },
    ],
  },
  {
    title: "Telas com mês",
    items: [
      { keys: ["["], label: "Mês anterior" },
      { keys: ["]"], label: "Próximo mês" },
    ],
  },
  {
    title: "Formulário de lançamento",
    items: [{ keys: ["Enter"], label: "Salvar" }],
  },
] as const;

/** Abre com "?" (fora de campos de texto) ou pelo evento OPEN_SHORTCUTS_EVENT. */
export function ShortcutsDialog() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable=true], [role=dialog], [role=alertdialog], [role=combobox]",
        )
      )
        return;
      e.preventDefault();
      setOpen(true);
    }
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SHORTCUTS_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SHORTCUTS_EVENT, onOpen);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent size="sm">
        <div className="grid gap-1">
          <DialogTitle>Atalhos de teclado</DialogTitle>
          <DialogDescription>Para lançar e navegar sem tirar a mão do teclado.</DialogDescription>
        </div>
        <div className="grid gap-5">
          {GROUPS.map((g) => (
            <section key={g.title} aria-label={g.title} className="grid gap-2">
              <h3 className="text-xs font-medium text-ink-2">{g.title}</h3>
              <ul className="grid gap-2">
                {g.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-4 text-sm">
                    <span>{item.label}</span>
                    <span className="flex shrink-0 gap-1">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded-[5px] border border-line-strong bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-ink"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
