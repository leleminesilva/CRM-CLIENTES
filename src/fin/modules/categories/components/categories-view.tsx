"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CombineIcon,
  EllipsisIcon,
  FolderPlusIcon,
  PencilIcon,
  PlusIcon,
  TagsIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { CategoryIconChip } from "@fin/components/shared/category-chip";
import { ConfirmDialog } from "@fin/components/shared/confirm-dialog";
import { EmptyState } from "@fin/components/shared/empty-state";
import { Panel } from "@fin/components/shared/panel";
import { SortableList } from "@fin/components/shared/sortable-list";
import { Badge } from "@fin/components/ui/badge";
import { Button } from "@fin/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@fin/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@fin/components/ui/tabs";
import type { CategoryKind } from "@prisma/client";
import { handleActionResult } from "@fin/lib/action-result";
import { cn } from "@fin/lib/cn";
import {
  archiveCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
  unarchiveCategoryAction,
} from "../actions";
import { INCOME_CLASS_LABELS, NATURE_LABELS, type CategoryDTO, type CategoryNode } from "../types";
import { CategoryFormDialog } from "./category-form-dialog";
import { MergeDialog } from "./merge-dialog";

interface CategoriesViewProps {
  expense: CategoryNode[];
  income: CategoryNode[];
  showArchived: boolean;
}

type FormState = { kind: CategoryKind; category?: CategoryDTO; parentId?: string | null } | null;

export function CategoriesView({ expense, income, showArchived }: CategoriesViewProps) {
  const [tab, setTab] = React.useState<CategoryKind>("EXPENSE");
  const [form, setForm] = React.useState<FormState>(null);
  const [merging, setMerging] = React.useState<CategoryDTO | undefined>();
  const [deleting, setDeleting] = React.useState<CategoryDTO | undefined>();
  const groupsOf = (kind: CategoryKind) => (kind === "INCOME" ? income : expense);

  async function reorder(kind: CategoryKind, parentId: string | null, orderedIds: string[]) {
    return handleActionResult(await reorderCategoriesAction({ kind, parentId, orderedIds }));
  }

  async function toggleArchive(category: CategoryDTO) {
    const action = category.archived ? unarchiveCategoryAction : archiveCategoryAction;
    if (handleActionResult(await action({ id: category.id }))) {
      toast.success(
        category.archived ? `“${category.name}” reativada` : `“${category.name}” arquivada`,
      );
    }
  }

  /** Marcadores; nas subcategorias, só o que difere do grupo (evita repetição). */
  function badges(c: CategoryDTO, parent?: CategoryDTO) {
    const showClass = c.kind === "INCOME" && c.incomeClass && c.incomeClass !== parent?.incomeClass;
    const showFixed =
      c.kind === "EXPENSE" && c.defaultNature === "FIXED" && parent?.defaultNature !== "FIXED";
    const showEssential = c.kind === "EXPENSE" && c.isEssential && !parent?.isEssential;
    return (
      <span className="flex flex-wrap items-center gap-1.5 max-sm:hidden">
        {c.isSystem ? <Badge variant="outline">sistema</Badge> : null}
        {c.archived ? <Badge>arquivada</Badge> : null}
        {showClass && c.incomeClass ? (
          <Badge>{INCOME_CLASS_LABELS[c.incomeClass].toLowerCase()}</Badge>
        ) : null}
        {showFixed ? <Badge>{NATURE_LABELS.FIXED.toLowerCase()}</Badge> : null}
        {showEssential ? <Badge>essencial</Badge> : null}
      </span>
    );
  }

  function actions(c: CategoryDTO, isGroup: boolean) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${c.name}`}>
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setForm({ kind: c.kind, category: c })}>
            <PencilIcon /> Editar
          </DropdownMenuItem>
          {isGroup && !c.archived ? (
            <DropdownMenuItem onSelect={() => setForm({ kind: c.kind, parentId: c.id })}>
              <FolderPlusIcon /> Nova subcategoria
            </DropdownMenuItem>
          ) : null}
          {!c.isSystem ? (
            <>
              <DropdownMenuItem onSelect={() => setMerging(c)}>
                <CombineIcon /> Mesclar em…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void toggleArchive(c)}>
                {c.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}{" "}
                {c.archived ? "Reativar" : "Arquivar"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setDeleting(c)}>
                <Trash2Icon /> Excluir
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function itemRow(
    c: CategoryDTO,
    handle: React.ReactNode,
    isGroup: boolean,
    parent?: CategoryDTO,
  ) {
    return (
      <div
        className={cn(
          "flex min-h-12 items-center gap-2.5 py-1.5 pr-2 pl-2 sm:pr-3",
          !isGroup && "pl-8 sm:pl-10",
          c.archived && "bg-surface-sunken/50",
        )}
      >
        {handle}
        <CategoryIconChip icon={c.icon} color={c.color} size={isGroup ? "md" : "sm"} />
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className={cn("truncate", isGroup && "font-medium")}>{c.name}</span>
          {badges(c, parent)}
        </div>
        {c.usage > 0 ? <span className="text-xs text-ink-3 nums">{c.usage} lanç.</span> : null}
        {actions(c, isGroup)}
      </div>
    );
  }

  function tree(kind: CategoryKind) {
    const groups = groupsOf(kind);
    if (groups.length === 0) {
      return (
        <EmptyState
          icon={TagsIcon}
          title="Nenhuma categoria"
          description="Crie grupos e subcategorias para organizar seus lançamentos."
          action={
            <Button onClick={() => setForm({ kind })}>
              <PlusIcon /> Nova categoria
            </Button>
          }
        />
      );
    }
    return (
      <SortableList
        items={groups}
        getLabel={(g) => g.name}
        onReorder={(ids) => reorder(kind, null, ids)}
        className="divide-y divide-line"
        renderItem={(group, handle) => (
          <div>
            {itemRow(group, handle, true)}
            {group.children.length > 0 ? (
              <SortableList
                items={group.children}
                getLabel={(c) => c.name}
                onReorder={(ids) => reorder(kind, group.id, ids)}
                className="border-t border-dashed border-line pb-1"
                renderItem={(child, childHandle) => itemRow(child, childHandle, false, group)}
              />
            ) : null}
          </div>
        )}
      />
    );
  }

  const confirmDelete = deleting && (deleting.usage > 0 ? "inUse" : "free");

  return (
    <div className="grid gap-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as CategoryKind)} className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="EXPENSE">Despesas</TabsTrigger>
            <TabsTrigger value="INCOME">Receitas</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button variant="secondary" asChild>
              <Link
                href={
                  showArchived
                    ? "/financeiro/configuracoes/categorias"
                    : "/financeiro/configuracoes/categorias?arquivadas=1"
                }
                replace
                scroll={false}
              >
                {showArchived ? "Ocultar arquivadas" : "Mostrar arquivadas"}
              </Link>
            </Button>
            <Button onClick={() => setForm({ kind: tab })}>
              <PlusIcon /> Nova categoria
            </Button>
          </div>
        </div>
        <TabsContent value="EXPENSE">
          <Panel>{tree("EXPENSE")}</Panel>
        </TabsContent>
        <TabsContent value="INCOME">
          <Panel>{tree("INCOME")}</Panel>
        </TabsContent>
      </Tabs>
      <p className="text-[13px] text-ink-3">
        Arraste pela alça (ou use Espaço e as setas) para reordenar. A ordem vale para listas e
        formulários.
      </p>

      {form ? (
        <CategoryFormDialog
          open
          onOpenChange={(open) => !open && setForm(null)}
          kind={form.kind}
          groups={groupsOf(form.kind)}
          category={form.category}
          parentId={form.parentId}
        />
      ) : null}

      <MergeDialog
        key={merging?.id ?? "none"}
        source={merging}
        groups={merging ? groupsOf(merging.kind) : []}
        onOpenChange={(open) => !open && setMerging(undefined)}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={`Excluir “${deleting?.name ?? ""}”?`}
        description={
          confirmDelete === "inUse" ? (
            <p>
              Esta categoria tem {deleting?.usage} lançamentos. Use <strong>Mesclar em…</strong>{" "}
              para movê-los para outra categoria, ou <strong>Arquivar</strong> para escondê-la
              mantendo o histórico.
            </p>
          ) : (
            <p>A categoria será removida definitivamente.</p>
          )
        }
        confirmLabel={confirmDelete === "inUse" ? "Mesclar em outra" : "Excluir categoria"}
        destructive={confirmDelete !== "inUse"}
        onConfirm={async () => {
          if (!deleting) return;
          if (deleting.usage > 0) {
            setMerging(deleting);
            return;
          }
          if (handleActionResult(await deleteCategoryAction({ id: deleting.id })))
            toast.success(`“${deleting.name}” excluída`);
        }}
      />
    </div>
  );
}
