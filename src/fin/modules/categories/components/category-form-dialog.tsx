"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { CategoryIconChip } from "@fin/components/shared/category-chip";
import { ColorSwatches } from "@fin/components/shared/color-swatches";
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
import { Input } from "@fin/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@fin/components/ui/select";
import { Switch } from "@fin/components/ui/switch";
import type { CategoryKind } from "@prisma/client";
import { handleActionResult } from "@fin/lib/action-result";
import { createCategoryAction, updateCategoryAction } from "../actions";
import { CATEGORY_COLORS } from "../palette";
import { createCategorySchema } from "../schemas";
import { INCOME_CLASS_LABELS, NATURE_LABELS, type CategoryDTO, type CategoryNode } from "../types";
import { IconPicker } from "./icon-picker";

type Values = z.input<typeof createCategorySchema>;
type Output = z.output<typeof createCategorySchema>;

const NO_PARENT = "__none__";
const NO_NATURE = "__none__";

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: CategoryKind;
  groups: CategoryNode[];
  category?: CategoryDTO;
  /** Ao criar a partir de um grupo ("Nova subcategoria"). */
  parentId?: string | null;
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  kind,
  groups,
  category,
  parentId = null,
}: CategoryFormDialogProps) {
  const editing = Boolean(category);
  const hasChildren = category
    ? groups.some((g) => g.id === category.id && g.children.length > 0)
    : false;
  const parentOptions = groups.filter((g) => g.id !== category?.id && !g.archived);

  const defaults = React.useMemo<Values>(() => {
    const parent = groups.find((g) => g.id === (category?.parentId ?? parentId));
    return {
      kind,
      name: category?.name ?? "",
      parentId: category?.parentId ?? parentId,
      icon: (category?.icon ?? (kind === "INCOME" ? "wallet" : "ellipsis")) as Values["icon"],
      color: (category?.color ?? parent?.color ?? CATEGORY_COLORS[0].hex) as Values["color"],
      incomeClass: kind === "INCOME" ? (category?.incomeClass ?? "OTHER") : null,
      defaultNature:
        kind === "EXPENSE"
          ? (category?.defaultNature ?? parent?.defaultNature ?? "VARIABLE")
          : null,
      isEssential: category?.isEssential ?? parent?.isEssential ?? false,
    };
  }, [category, parentId, kind, groups]);

  const form = useForm<Values, unknown, Output>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;
  const ids = { icon: React.useId(), color: React.useId() };

  React.useEffect(() => {
    if (open) form.reset(defaults);
  }, [open, defaults, form]);

  const watchedParent = useWatch({ control: form.control, name: "parentId" });
  const watchedColor = useWatch({ control: form.control, name: "color" });
  const watchedIcon = useWatch({ control: form.control, name: "icon" });
  const parentGroup = groups.find((g) => g.id === watchedParent);

  async function onSubmit(values: Output) {
    const payload = {
      ...values,
      color: parentGroup ? (parentGroup.color as Output["color"]) : values.color,
    };
    const result = category
      ? await updateCategoryAction({ ...payload, id: category.id })
      : await createCategoryAction(payload);
    if (handleActionResult(result, form)) {
      toast.success(category ? "Categoria salva" : "Categoria criada");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? "Editar categoria"
              : kind === "INCOME"
                ? "Nova categoria de receita"
                : "Nova categoria de despesa"}
          </DialogTitle>
          <DialogDescription>
            {kind === "INCOME"
              ? "A classe define em qual grupo a receita aparece no painel."
              : "Subcategorias herdam a cor do grupo; os relatórios somam tudo no grupo."}
          </DialogDescription>
        </DialogHeader>

        <form
          id="category-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="grid gap-4"
        >
          <div className="flex items-end gap-3">
            <CategoryIconChip
              icon={watchedIcon}
              color={parentGroup?.color ?? watchedColor}
              className="mb-0.5 size-9"
            />
            <Field label="Nome" error={errors.name?.message} className="flex-1">
              {(a) => (
                <Input
                  {...a}
                  autoFocus
                  placeholder={kind === "INCOME" ? "Ex.: Aluguel recebido" : "Ex.: Farmácia"}
                  {...form.register("name")}
                />
              )}
            </Field>
          </div>

          <Field
            label="Grupo"
            hint={
              hasChildren
                ? "Este grupo tem subcategorias, por isso não pode virar subcategoria."
                : undefined
            }
            error={errors.parentId?.message}
          >
            {(a) => (
              <Controller
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? NO_PARENT}
                    onValueChange={(v) => field.onChange(v === NO_PARENT ? null : v)}
                    disabled={hasChildren || category?.isSystem}
                  >
                    <SelectTrigger id={a.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PARENT}>Nenhum — é um grupo principal</SelectItem>
                      {parentOptions.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>

          <div className="grid gap-2">
            <span id={ids.icon} className="text-[13px] leading-4 font-medium text-ink-2">
              Ícone
            </span>
            <Controller
              control={form.control}
              name="icon"
              render={({ field }) => (
                <IconPicker
                  aria-labelledby={ids.icon}
                  value={field.value}
                  onChange={field.onChange}
                  color={parentGroup?.color ?? watchedColor}
                />
              )}
            />
          </div>

          <div className="grid gap-2">
            <span id={ids.color} className="text-[13px] leading-4 font-medium text-ink-2">
              Cor{" "}
              {parentGroup ? (
                <span className="font-normal text-ink-3">— herdada de {parentGroup.name}</span>
              ) : null}
            </span>
            <Controller
              control={form.control}
              name="color"
              render={({ field }) => (
                <ColorSwatches
                  aria-labelledby={ids.color}
                  value={parentGroup ? parentGroup.color : field.value}
                  onChange={(v) => v && field.onChange(v)}
                  colors={CATEGORY_COLORS}
                  disabled={Boolean(parentGroup)}
                />
              )}
            />
          </div>

          {kind === "INCOME" ? (
            <Field label="Classe no painel" error={errors.incomeClass?.message}>
              {(a) => (
                <Controller
                  control={form.control}
                  name="incomeClass"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? "OTHER"}
                      onValueChange={field.onChange}
                      disabled={category?.isSystem}
                    >
                      <SelectTrigger id={a.id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.keys(INCOME_CLASS_LABELS) as (keyof typeof INCOME_CLASS_LABELS)[]
                        ).map((k) => (
                          <SelectItem key={k} value={k}>
                            {INCOME_CLASS_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
              <Field
                label="Natureza padrão"
                hint="Sugestão para novos lançamentos."
                error={errors.defaultNature?.message}
              >
                {(a) => (
                  <Controller
                    control={form.control}
                    name="defaultNature"
                    render={({ field }) => (
                      <Select
                        value={field.value ?? NO_NATURE}
                        onValueChange={(v) => field.onChange(v === NO_NATURE ? null : v)}
                      >
                        <SelectTrigger id={a.id}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FIXED">{NATURE_LABELS.FIXED}</SelectItem>
                          <SelectItem value="VARIABLE">{NATURE_LABELS.VARIABLE}</SelectItem>
                          <SelectItem value={NO_NATURE}>Sem padrão</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </Field>
              <Controller
                control={form.control}
                name="isEssential"
                render={({ field }) => (
                  <label className="flex h-9 cursor-pointer items-center justify-between gap-3 rounded-control border border-line px-3 sm:mb-[22px]">
                    <span className="text-sm">Custo essencial</span>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />
            </div>
          )}
        </form>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="category-form" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : editing ? "Salvar categoria" : "Criar categoria"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
