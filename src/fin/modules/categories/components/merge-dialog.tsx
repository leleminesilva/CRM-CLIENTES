"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@fin/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@fin/components/ui/dialog";
import { Field } from "@fin/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@fin/components/ui/select";
import { handleActionResult } from "@fin/lib/action-result";
import { mergeCategoriesAction } from "../actions";
import type { CategoryDTO, CategoryNode } from "../types";

interface MergeDialogProps {
  source?: CategoryDTO;
  groups: CategoryNode[];
  onOpenChange: (open: boolean) => void;
}

/** Mescla a categoria de origem em outra do mesmo tipo (lançamentos, orçamentos e subcategorias vão junto). */
export function MergeDialog({ source, groups, onOpenChange }: MergeDialogProps) {
  const [targetId, setTargetId] = React.useState<string>("");
  const [pending, setPending] = React.useState(false);

  const sourceIsGroup = source ? groups.some((g) => g.id === source.id) : false;
  const sourceHasChildren = source
    ? (groups.find((g) => g.id === source.id)?.children.length ?? 0) > 0
    : false;
  const target = groups.flatMap((g) => [g, ...g.children]).find((c) => c.id === targetId);

  async function confirm() {
    if (!source || !targetId) return;
    setPending(true);
    const result = await mergeCategoriesAction({ sourceId: source.id, targetId });
    setPending(false);
    if (handleActionResult(result)) {
      toast.success(`“${source.name}” mesclada em “${target?.name ?? ""}”`);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={Boolean(source)} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Mesclar “{source?.name}”</DialogTitle>
          <DialogDescription>
            Tudo o que usa “{source?.name}” passa para a categoria escolhida, e “{source?.name}” é
            excluída.
          </DialogDescription>
        </DialogHeader>
        <Field
          label="Mesclar em"
          hint={
            sourceHasChildren
              ? "Grupos com subcategorias só podem ser mesclados em outro grupo."
              : undefined
          }
        >
          {(a) => (
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger id={a.id}>
                <SelectValue placeholder="Escolha a categoria de destino" />
              </SelectTrigger>
              <SelectContent>
                {groups
                  .filter((g) => g.id !== source?.id && !g.archived)
                  .map((g) => (
                    <SelectGroup key={g.id}>
                      <SelectLabel>{g.name}</SelectLabel>
                      <SelectItem value={g.id}>{g.name} (grupo)</SelectItem>
                      {!sourceHasChildren
                        ? g.children
                            .filter((c) => c.id !== source?.id && !c.archived)
                            .map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {g.name} › {c.name}
                              </SelectItem>
                            ))
                        : null}
                    </SelectGroup>
                  ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        {source && target ? (
          <p className="rounded-control bg-surface-sunken px-3 py-2 text-[13px] text-ink-2">
            {source.usage > 0
              ? `${source.usage} ${source.usage === 1 ? "lançamento passará" : "lançamentos passarão"}`
              : "Nenhum lançamento usa esta categoria; ela"}{" "}
            {source.usage > 0 ? `para “${target.name}”.` : "será apenas removida."}
            {sourceIsGroup && sourceHasChildren
              ? " As subcategorias passam a pertencer ao grupo de destino."
              : ""}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => void confirm()}
            disabled={!targetId || pending}
          >
            {pending ? "Mesclando…" : "Mesclar categorias"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
