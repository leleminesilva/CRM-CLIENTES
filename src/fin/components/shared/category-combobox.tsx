"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import * as React from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@fin/components/ui/command";
import { inputClasses } from "@fin/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@fin/components/ui/popover";
import { cn } from "@fin/lib/cn";
import type { CategoryDTO, CategoryNode } from "@fin/modules/categories/types";
import { CategoryIconChip } from "./category-chip";

interface CategoryComboboxProps {
  groups: CategoryNode[];
  value: string | null;
  onChange: (id: string) => void;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
  placeholder?: string;
}

/** Escolha de categoria com busca (grupos e subcategorias). Só categorias ativas aparecem. */
export function CategoryCombobox({
  groups,
  value,
  onChange,
  placeholder = "Escolha a categoria",
  ...aria
}: CategoryComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const all = groups.flatMap((g) => [
    { c: g as CategoryDTO, parent: null as string | null },
    ...g.children.map((c) => ({ c, parent: g.name })),
  ]);
  const selected = all.find((x) => x.c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          className={cn(
            inputClasses,
            "flex cursor-pointer items-center gap-2 text-left",
            !selected && "text-ink-3",
          )}
          {...aria}
        >
          {selected ? (
            <>
              <CategoryIconChip icon={selected.c.icon} color={selected.c.color} size="sm" />
              <span className="truncate">
                {selected.parent ? <span className="text-ink-3">{selected.parent} › </span> : null}
                {selected.c.name}
              </span>
            </>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
          <ChevronDownIcon className="ml-auto size-4 shrink-0 text-ink-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue
              .normalize("NFD")
              .replace(/[̀-ͯ]/g, "")
              .toLowerCase()
              .includes(search.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase())
              ? 1
              : 0
          }
        >
          <CommandInput placeholder="Buscar categoria…" />
          <CommandList id={listId}>
            <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
            {groups
              .filter((g) => !g.archived)
              .map((g) => (
                <CommandGroup key={g.id} heading={g.name}>
                  {[
                    { c: g as CategoryDTO, label: `${g.name} (grupo)` },
                    ...g.children.filter((c) => !c.archived).map((c) => ({ c, label: c.name })),
                  ].map(({ c, label }) => (
                    <CommandItem
                      key={c.id}
                      value={`${g.name} ${c.name} ${c.id}`}
                      onSelect={() => {
                        onChange(c.id);
                        setOpen(false);
                      }}
                    >
                      <CategoryIconChip icon={c.icon} color={c.color} size="sm" />
                      <span className="truncate">{label}</span>
                      {c.id === value ? <CheckIcon className="ml-auto size-4" /> : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
