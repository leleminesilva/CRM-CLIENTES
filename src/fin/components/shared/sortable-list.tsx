"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@fin/lib/cn";

interface SortableListProps<T extends { id: string }> {
  items: T[];
  /** Nome legível do item, usado nos anúncios para leitores de tela. */
  getLabel: (item: T) => string;
  onReorder: (orderedIds: string[]) => Promise<boolean>;
  renderItem: (item: T, handle: React.ReactNode) => React.ReactNode;
  className?: string;
  disabled?: boolean;
}

/** Lista reordenável por arrastar ou pelo teclado (Espaço para pegar, setas para mover). */
export function SortableList<T extends { id: string }>({
  items,
  getLabel,
  onReorder,
  renderItem,
  className,
  disabled,
}: SortableListProps<T>) {
  const [order, setOrder] = React.useState(items);
  const [previousItems, setPreviousItems] = React.useState(items);
  // Enquanto uma reordenação está sendo gravada, dados do servidor (possivelmente anteriores a
  // ela) não substituem a ordem otimista.
  const [saving, setSaving] = React.useState(false);
  if (items !== previousItems) {
    setPreviousItems(items);
    if (!saving) setOrder(items);
  }

  // id estável evita divergência de hidratação nos atributos aria do dnd-kit.
  const dndId = React.useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const labelOf = (id: string | number) => {
    const item = order.find((i) => i.id === id);
    return item ? getLabel(item) : "item";
  };
  const positionOf = (id: string | number) => order.findIndex((i) => i.id === id) + 1;

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const previous = order;
    const next = arrayMove(order, positionOf(active.id) - 1, positionOf(over.id) - 1);
    setOrder(next);
    setSaving(true);
    const ok = await onReorder(next.map((i) => i.id));
    setSaving(false);
    if (!ok) setOrder(previous);
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(e) => void handleDragEnd(e)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Para reordenar, pressione Espaço ou Enter, use as setas para mover e pressione Espaço ou Enter para soltar. Esc cancela.",
        },
        announcements: {
          onDragStart: ({ active }) =>
            `${labelOf(active.id)} selecionado, na posição ${positionOf(active.id)}.`,
          onDragOver: ({ active, over }) =>
            over
              ? `${labelOf(active.id)} sobre a posição ${positionOf(over.id)}.`
              : `${labelOf(active.id)} fora da lista.`,
          onDragEnd: ({ active, over }) =>
            over
              ? `${labelOf(active.id)} solto na posição ${positionOf(over.id)}.`
              : `${labelOf(active.id)} solto.`,
          onDragCancel: ({ active }) =>
            `Reordenação cancelada. ${labelOf(active.id)} voltou ao lugar.`,
        },
      }}
    >
      <SortableContext items={order.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className={className} aria-busy={saving || undefined}>
          {order.map((item) => (
            <SortableRow key={item.id} id={item.id} label={getLabel(item)} disabled={disabled}>
              {(handle) => renderItem(item, handle)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  label,
  disabled,
  children,
}: {
  id: string;
  label: string;
  disabled?: boolean;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
  });
  const handle = disabled ? null : (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Reordenar ${label}`}
      className="inline-flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-[6px] text-ink-3 hover:bg-surface-sunken hover:text-ink-2 active:cursor-grabbing"
    >
      <GripVerticalIcon className="size-4" />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative",
        isDragging && "z-10 rounded-control bg-surface-raised shadow-float",
      )}
    >
      {children(handle)}
    </li>
  );
}
