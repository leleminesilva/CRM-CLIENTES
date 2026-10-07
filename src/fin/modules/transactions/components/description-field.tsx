"use client";

import * as React from "react";
import { Input } from "@fin/components/ui/input";
import { cn } from "@fin/lib/cn";
import { formatMoney } from "@fin/lib/money";
import { suggestDescriptionsAction } from "../actions";
import type { DescriptionSuggestion } from "../queries";

interface DescriptionFieldProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value: string;
  onValueChange: (value: string) => void;
  onPick: (s: DescriptionSuggestion) => void;
  /** Só sugere lançamentos do mesmo tipo. */
  type: "INCOME" | "EXPENSE" | "TRANSFER";
}

/** Descrição com sugestões do histórico: escolher uma preenche categoria, conta e valor habitual. */
export const DescriptionField = React.forwardRef<HTMLInputElement, DescriptionFieldProps>(
  function DescriptionField({ value, onValueChange, onPick, type, id, ...props }, ref) {
    const [items, setItems] = React.useState<DescriptionSuggestion[]>([]);
    const [open, setOpen] = React.useState(false);
    const [active, setActive] = React.useState(-1);
    const listId = `${id ?? "descricao"}-sugestoes`;
    const requestRef = React.useRef(0);

    function search(q: string) {
      const request = ++requestRef.current;
      if (type === "TRANSFER" || q.trim().length < 2) {
        setItems([]);
        setOpen(false);
        return;
      }
      window.setTimeout(() => {
        if (request !== requestRef.current) return; // digitação mais nova em andamento
        void suggestDescriptionsAction({ q }).then((result) => {
          if (request !== requestRef.current) return;
          const found = (result?.data ?? []).filter(
            (s) => s.type === type && s.description.toLowerCase() !== q.trim().toLowerCase(),
          );
          setItems(found.slice(0, 6));
          setActive(-1);
          setOpen(found.length > 0);
        });
      }, 180);
    }

    function pick(s: DescriptionSuggestion) {
      onPick(s);
      setOpen(false);
      setItems([]);
    }

    return (
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          value={value}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            onValueChange(e.target.value);
            search(e.target.value);
          }}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === "Enter" && active >= 0 && items[active]) {
              e.preventDefault();
              pick(items[active]);
            } else if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(false);
            }
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          {...props}
        />
        {open ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Lançamentos anteriores"
            className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-card border border-line bg-surface-raised p-1 shadow-float"
          >
            {items.map((s, i) => (
              <li
                key={`${s.description}-${i}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-[6px] px-2 py-1.5 text-sm",
                  i === active && "bg-surface-sunken",
                )}
              >
                <span className="truncate">{s.description}</span>
                <span className="shrink-0 text-xs text-ink-3 nums">{formatMoney(s.amount)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  },
);
