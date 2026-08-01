"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Package, PackageCheck, CalendarClock, CheckCircle2,
  MapPin, MessageCircle, Phone, ExternalLink, User2, FileText, Search, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate, STATUS_POS_VENDA_LABELS } from "@/lib/utils/formatters";
import { useAuth } from "@/contexts/AuthContext";
import type { StatusPosVenda, Venda } from "@/types";

const ETAPAS: StatusPosVenda[] = ["AGUARDANDO_VIDRO", "VIDRO_CHEGOU", "AGENDADO", "CONCLUIDO"];

const ETAPA_ICON: Record<StatusPosVenda, React.ElementType> = {
  AGUARDANDO_VIDRO: Package,
  VIDRO_CHEGOU: PackageCheck,
  AGENDADO: CalendarClock,
  CONCLUIDO: CheckCircle2,
};

const ETAPA_COLORS: Record<StatusPosVenda, string> = {
  AGUARDANDO_VIDRO: "bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600",
  VIDRO_CHEGOU:     "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800",
  AGENDADO:         "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800",
  CONCLUIDO:        "bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800",
};

const ETAPA_HEADER_COLORS: Record<StatusPosVenda, string> = {
  AGUARDANDO_VIDRO: "bg-slate-500",
  VIDRO_CHEGOU:     "bg-blue-500",
  AGENDADO:         "bg-amber-500",
  CONCLUIDO:        "bg-emerald-500",
};

function enderecoResumo(cliente: Venda["cliente"]): string | null {
  if (!cliente) return null;
  const partes = [cliente.bairro, cliente.cidade].filter(Boolean);
  return partes.length > 0 ? partes.join(", ") : null;
}

function KanbanCard({ venda, overlay, onOpen }: { venda: Venda; overlay?: boolean; onOpen: (v: Venda) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: venda.id,
    data: { statusPosVenda: venda.statusPosVenda },
  });
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !overlay ? 0.4 : 1,
  };

  function handlePointerDownCapture(e: React.PointerEvent) {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  }

  function handleClick(e: React.MouseEvent) {
    if (overlay) return;
    const start = pointerDownPos.current;
    if (start && (Math.abs(e.clientX - start.x) > 5 || Math.abs(e.clientY - start.y) > 5)) return;
    onOpen(venda);
  }

  const endereco = enderecoResumo(venda.cliente);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDownCapture={handlePointerDownCapture}
      onClick={handleClick}
      className={`bg-card border rounded-lg p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow hover:border-indigo-400 dark:hover:border-indigo-600 ${
        overlay ? "shadow-lg rotate-1" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm leading-tight">{venda.cliente?.nome ?? "Cliente"}</p>
        <Badge variant="secondary" className="text-[10px] shrink-0">Orç. {venda.numeroOrcamento}</Badge>
      </div>

      <div className="flex items-center gap-1 mt-2 text-emerald-600 dark:text-emerald-400">
        <span className="text-xs font-semibold">{formatCurrency(venda.valor)}</span>
      </div>

      {endereco && (
        <div className="flex items-center gap-1 mt-1.5 text-muted-foreground">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="text-xs truncate">{endereco}</span>
        </div>
      )}

      {venda.dataAgendamento && (
        <div className="flex items-center gap-1 mt-1.5 text-amber-600 dark:text-amber-400">
          <CalendarClock className="w-3 h-3 shrink-0" />
          <span className="text-xs font-medium">
            {formatDate(venda.dataAgendamento)}{venda.horarioAgendamento ? ` às ${venda.horarioAgendamento}` : ""}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        {venda.responsavel ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
              <User2 className="w-3 h-3 text-indigo-600" />
            </div>
            <span className="text-xs text-muted-foreground">{venda.responsavel.nome.split(" ")[0]}</span>
          </div>
        ) : <div />}
        {venda.cliente?.whatsapp && (
          <a
            href={`https://wa.me/55${venda.cliente.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            title="Abrir no WhatsApp"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <MessageCircle className="w-3.5 h-3.5 text-green-500 hover:text-green-400 transition-colors" />
          </a>
        )}
      </div>
    </div>
  );
}

function DetalheDialog({ venda, onClose }: { venda: Venda | null; onClose: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [status, setStatus] = useState<StatusPosVenda>("AGUARDANDO_VIDRO");
  const [vidroChegou, setVidroChegou] = useState(false);
  const [vidroChegouEm, setVidroChegouEm] = useState("");
  const [dataAgendamento, setDataAgendamento] = useState("");
  const [horarioAgendamento, setHorarioAgendamento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (!venda) return;
    setStatus(venda.statusPosVenda);
    setVidroChegou(!!venda.vidroChegouEm);
    setVidroChegouEm(venda.vidroChegouEm ? venda.vidroChegouEm.slice(0, 10) : "");
    setDataAgendamento(venda.dataAgendamento ? venda.dataAgendamento.slice(0, 10) : "");
    setHorarioAgendamento(venda.horarioAgendamento ?? "");
    setObservacoes(venda.observacoesPosVenda ?? "");
  }, [venda]);

  const mutation = useMutation({
    mutationFn: () =>
      axios.patch(`/api/vendas/${venda!.id}`, {
        statusPosVenda: status,
        vidroChegou,
        vidroChegouEm: vidroChegou ? (vidroChegouEm || new Date().toISOString().slice(0, 10)) : null,
        dataAgendamento: dataAgendamento || null,
        horarioAgendamento: horarioAgendamento || null,
        observacoesPosVenda: observacoes || null,
      }),
    onSuccess: () => {
      toast.success("Pedido atualizado!");
      qc.invalidateQueries({ queryKey: ["vendas-kanban"] });
      onClose();
    },
    onError: () => toast.error("Erro ao atualizar pedido"),
  });

  if (!venda) return null;
  const cliente = venda.cliente;
  const enderecoLinha1 = cliente ? [cliente.logradouro, cliente.numero].filter(Boolean).join(", ") : "";
  const enderecoLinha2 = cliente
    ? [cliente.bairro, cliente.cidade ? `${cliente.cidade}${cliente.estado ? `/${cliente.estado}` : ""}` : null].filter(Boolean).join(" — ")
    : "";
  const endereco = [enderecoLinha1, enderecoLinha2].filter(Boolean).join(" — ");

  return (
    <Dialog open={!!venda} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span>{cliente?.nome ?? "Pedido"}</span>
            {cliente && (
              <button
                type="button"
                onClick={() => router.push(`/clientes/${cliente.id}`)}
                className="flex items-center gap-1 text-xs font-normal text-indigo-500 hover:text-indigo-400"
              >
                Ver cliente <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Orçamento</span>
              <span className="font-medium">{venda.numeroOrcamento}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Valor</span>
              <span className="font-semibold text-emerald-600">{formatCurrency(venda.valor)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Data da venda</span>
              <span>{formatDate(venda.data)}</span>
            </div>
            {endereco && (
              <div className="flex items-start justify-between gap-2 pt-1 border-t mt-1.5">
                <span className="text-muted-foreground flex items-center gap-1 shrink-0"><MapPin className="w-3.5 h-3.5" /> Endereço</span>
                <span className="text-right">{endereco}</span>
              </div>
            )}
            {cliente?.telefone && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Telefone</span>
                <span>{cliente.telefone}</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Etapa do pós-venda</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusPosVenda)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ETAPAS.map((e) => (
                  <SelectItem key={e} value={e}>{STATUS_POS_VENDA_LABELS[e]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 border rounded-lg p-3">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <Checkbox checked={vidroChegou} onCheckedChange={(c) => setVidroChegou(c === true)} />
              O vidro já chegou na empresa
            </label>
            {vidroChegou && (
              <div className="pl-6 space-y-1">
                <p className="text-xs text-muted-foreground">Data de chegada</p>
                <input
                  type="date"
                  value={vidroChegouEm}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setVidroChegouEm(e.target.value)}
                  className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </div>

          <div className="space-y-2 border rounded-lg p-3">
            <p className="text-sm font-medium flex items-center gap-1.5"><CalendarClock className="w-4 h-4" /> Agendamento com o cliente</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Data</p>
                <input
                  type="date"
                  value={dataAgendamento}
                  onChange={(e) => setDataAgendamento(e.target.value)}
                  className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Horário</p>
                <input
                  type="time"
                  value={horarioAgendamento}
                  onChange={(e) => setHorarioAgendamento(e.target.value)}
                  className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Anotações internas sobre esse pedido..."
              rows={3}
            />
          </div>

        </div>

        <DialogFooter className="gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ConfirmadosPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canViewAll = user?.role === "ADMINISTRADOR" || user?.role === "DESENVOLVEDOR" || user?.role === "GESTOR";
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detalheVenda, setDetalheVenda] = useState<Venda | null>(null);
  const [search, setSearch] = useState("");
  const [mes, setMes] = useState("");
  const [vendedorId, setVendedorId] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { data } = useQuery({
    queryKey: ["vendas-kanban"],
    queryFn: async () => {
      const { data } = await axios.get("/api/vendas");
      return data.data as Venda[];
    },
    refetchInterval: 30000,
  });

  const { data: vendedoresData } = useQuery({
    queryKey: ["usuarios-ativos"],
    queryFn: async () => {
      const { data } = await axios.get("/api/usuarios/ativos");
      return data.data as Array<{ id: string; nome: string }>;
    },
    enabled: canViewAll,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, statusPosVenda }: { id: string; statusPosVenda: StatusPosVenda }) =>
      axios.patch(`/api/vendas/${id}`, { statusPosVenda }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendas-kanban"] }),
    onError: () => toast.error("Erro ao mover pedido"),
  });

  const vendasTodas = data || [];
  const vendas = vendasTodas.filter((v) => {
    if (search && !(v.cliente?.nome ?? "").toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (mes && v.data.slice(0, 7) !== mes) return false;
    if (vendedorId && v.responsavelId !== vendedorId) return false;
    return true;
  });
  const activeVenda = vendas.find((v) => v.id === activeId);

  const hasActiveFilters = !!(search || mes || vendedorId);
  function clearFilters() {
    setSearch("");
    setMes("");
    setVendedorId("");
  }

  const getVendasForEtapa = (etapa: StatusPosVenda) => vendas.filter((v) => v.statusPosVenda === etapa);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as { statusPosVenda: StatusPosVenda };
    const overData = over.data.current as { statusPosVenda?: StatusPosVenda } | undefined;
    const targetEtapa = (overData?.statusPosVenda || over.id) as StatusPosVenda;

    if (activeData?.statusPosVenda !== targetEtapa && ETAPAS.includes(targetEtapa)) {
      moveMutation.mutate({ id: active.id as string, statusPosVenda: targetEtapa });
    }
  }

  const totalVendas = vendas.length;
  const valorTotal = vendas.reduce((sum, v) => sum + Number(v.valor || 0), 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Confirmado</h2>
          <p className="text-muted-foreground">
            {totalVendas} pedido{totalVendas === 1 ? "" : "s"} confirmado{totalVendas === 1 ? "" : "s"}
            {hasActiveFilters && vendasTodas.length !== totalVendas ? ` de ${vendasTodas.length}` : ""}
            {" · "}{formatCurrency(valorTotal)} · pós-venda, vidro e agendamento
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative w-[220px] shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="pl-8"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <CalendarClock className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            title="Mês da venda"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-[150px]"
          />
        </div>

        {canViewAll && (
          <Select value={vendedorId || "all"} onValueChange={(v) => setVendedorId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[170px] shrink-0">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vendedor</SelectItem>
              {(vendedoresData ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="w-3.5 h-3.5 mr-1" /> Limpar filtros
          </Button>
        )}
      </div>

      <DetalheDialog venda={detalheVenda} onClose={() => setDetalheVenda(null)} />

      <div className="overflow-x-auto overflow-y-hidden pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 min-w-max h-[calc(100vh-220px)] min-h-[400px]">
            {ETAPAS.map((etapa) => {
              const etapaVendas = getVendasForEtapa(etapa);
              const etapaValor = etapaVendas.reduce((s, v) => s + Number(v.valor || 0), 0);
              const Icon = ETAPA_ICON[etapa];

              return (
                <div
                  key={etapa}
                  className={`w-72 flex flex-col rounded-xl border-2 ${ETAPA_COLORS[etapa]}`}
                  data-etapa={etapa}
                >
                  <div className="p-3 border-b border-inherit shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${ETAPA_HEADER_COLORS[etapa]}`} />
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-semibold text-sm">{STATUS_POS_VENDA_LABELS[etapa]}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">{etapaVendas.length}</Badge>
                    </div>
                    {etapaValor > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 ml-4">{formatCurrency(etapaValor)}</p>
                    )}
                  </div>

                  <div
                    className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2"
                    id={etapa}
                    data-etapa={etapa}
                  >
                    <SortableContext items={etapaVendas.map((v) => v.id)} strategy={verticalListSortingStrategy}>
                      {etapaVendas.map((venda) => (
                        <KanbanCard key={venda.id} venda={venda} onOpen={setDetalheVenda} />
                      ))}
                    </SortableContext>
                    {etapaVendas.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">Nenhum pedido nessa etapa</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeId && activeVenda && (
              <KanbanCard venda={activeVenda} overlay onOpen={() => {}} />
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
