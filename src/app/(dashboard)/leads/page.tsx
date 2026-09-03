"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

function parseBRL(raw: string): number {
  const s = raw.trim();
  if (!s) return 0;
  const hasDot   = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) return parseFloat(s.replace(/\./g, "").replace(",", "."));
  if (hasComma)           return parseFloat(s.replace(",", "."));
  return parseFloat(s);
}
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
import { Plus, Flame, Minus, Snowflake, DollarSign, User2, ThumbsDown, CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, ESTAGIO_LABELS } from "@/lib/utils/formatters";
import type { EstagioLead, Lead } from "@/types";

const ESTAGIOS: EstagioLead[] = [
  "REENGAJAR",
  "NOVO_LEAD",
  "CONTATO_INICIAL",
  "PRIMEIRO_ORCAMENTO",
  "QUALIFICACAO",
  "PROPOSTA_ENVIADA",
  "NEGOCIACAO",
  "FECHADO_GANHO",
  "FECHADO_PERDIDO",
];

const ESTAGIO_COLORS: Record<EstagioLead, string> = {
  REENGAJAR:           "bg-purple-50 border-purple-300 dark:bg-purple-950 dark:border-purple-700",
  NOVO_LEAD:           "bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600",
  CONTATO_INICIAL:     "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800",
  PRIMEIRO_ORCAMENTO:  "bg-indigo-50 border-indigo-200 dark:bg-indigo-950 dark:border-indigo-800",
  QUALIFICACAO:        "bg-violet-50 border-violet-200 dark:bg-violet-950 dark:border-violet-800",
  PROPOSTA_ENVIADA:    "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800",
  NEGOCIACAO:          "bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800",
  FECHADO_GANHO:       "bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800",
  FECHADO_PERDIDO:     "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800",
};

const ESTAGIO_HEADER_COLORS: Record<EstagioLead, string> = {
  REENGAJAR:           "bg-purple-500",
  NOVO_LEAD:           "bg-slate-500",
  CONTATO_INICIAL:     "bg-blue-500",
  PRIMEIRO_ORCAMENTO:  "bg-indigo-500",
  QUALIFICACAO:        "bg-violet-500",
  PROPOSTA_ENVIADA:    "bg-amber-500",
  NEGOCIACAO:          "bg-orange-500",
  FECHADO_GANHO:       "bg-emerald-500",
  FECHADO_PERDIDO:     "bg-red-500",
};

function TemperaturaIcon({ temperatura }: { temperatura: string }) {
  if (temperatura === "QUENTE") return <Flame className="w-3.5 h-3.5 text-red-500" />;
  if (temperatura === "MORNO") return <Minus className="w-3.5 h-3.5 text-amber-500" />;
  return <Snowflake className="w-3.5 h-3.5 text-blue-500" />;
}

function KanbanCard({ lead, overlay }: { lead: Lead; overlay?: boolean }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { estagio: lead.estagio },
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
    if (overlay || !lead.clienteId) return;
    const start = pointerDownPos.current;
    // Distingue clique de arrasto: só navega se o ponteiro não se moveu (arrasto real move o card).
    if (start && (Math.abs(e.clientX - start.x) > 5 || Math.abs(e.clientY - start.y) > 5)) return;
    router.push(`/clientes/${lead.clienteId}`);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDownCapture={handlePointerDownCapture}
      onClick={handleClick}
      className={`bg-card border rounded-lg p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow ${
        overlay ? "shadow-lg rotate-1" : ""
      } ${lead.clienteId && !overlay ? "hover:border-indigo-400 dark:hover:border-indigo-600" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm leading-tight">{lead.titulo}</p>
        <TemperaturaIcon temperatura={lead.temperatura} />
      </div>

      {lead.valorEstimado && (
        <div className="flex items-center gap-1 mt-2 text-emerald-600 dark:text-emerald-400">
          <DollarSign className="w-3 h-3" />
          <span className="text-xs font-semibold">{formatCurrency(lead.valorEstimado)}</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        {lead.responsavel ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
              <User2 className="w-3 h-3 text-indigo-600" />
            </div>
            <span className="text-xs text-muted-foreground">{lead.responsavel.nome.split(" ")[0]}</span>
          </div>
        ) : (
          <div />
        )}
        {lead.empresa && (
          <span className="text-xs text-muted-foreground truncate max-w-[100px]">
            {lead.empresa.nomeFantasia || lead.empresa.razaoSocial}
          </span>
        )}
      </div>
    </div>
  );
}

function NovoLeadDialog({ estagio, onSuccess }: { estagio: EstagioLead; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [temperatura, setTemperatura] = useState("MORNO");

  const mutation = useMutation({
    mutationFn: () =>
      axios.post("/api/leads", {
        titulo,
        descricao,
        estagio,
        temperatura,
        valorEstimado: valor ? parseBRL(valor) : undefined,
      }),
    onSuccess: () => {
      toast.success("Lead criado com sucesso!");
      setOpen(false);
      setTitulo("");
      setDescricao("");
      setValor("");
      onSuccess();
    },
    onError: () => toast.error("Erro ao criar lead"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-foreground">
          <Plus className="w-4 h-4 mr-1" />
          Adicionar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Lead — {ESTAGIO_LABELS[estagio]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Sistema de gestão para empresa X" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhes sobre o lead..." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor Estimado</Label>
              <Input type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex: 4.562,98" />
            </div>
            <div className="space-y-1.5">
              <Label>Temperatura</Label>
              <Select value={temperatura} onValueChange={setTemperatura}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="QUENTE">🔥 Quente</SelectItem>
                  <SelectItem value="MORNO">➖ Morno</SelectItem>
                  <SelectItem value="FRIO">❄️ Frio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => mutation.mutate()}
              disabled={!titulo || mutation.isPending}
            >
              {mutation.isPending ? "Criando..." : "Criar Lead"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function LeadsKanbanPage() {
  const qc = useQueryClient();
  const ls = typeof window !== "undefined" ? sessionStorage : null;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cancelPendente, setCancelPendente] = useState<{ id: string } | null>(null);
  const [dataCancelamento, setDataCancelamento] = useState(() => new Date().toISOString().slice(0, 10));
  const [motivoCategoria, setMotivoCategoria] = useState("");
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [reengajar, setReengajar] = useState(false);
  const [proximoContato, setProximoContato] = useState("");

  // Filtro por data de criação do lead (persistido na sessão)
  const [dataInicio, setDataInicio] = useState(() => ls?.getItem("lf_dataInicio") ?? "");
  const [dataFim, setDataFim] = useState(() => ls?.getItem("lf_dataFim") ?? "");
  useEffect(() => { sessionStorage.setItem("lf_dataInicio", dataInicio); }, [dataInicio]);
  useEffect(() => { sessionStorage.setItem("lf_dataFim", dataFim); }, [dataFim]);

  const MOTIVOS = ["Prazo", "Preço", "Distância", "Não Realizamos", "Cliente não responde", "Outros"];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { data } = useQuery({
    queryKey: ["leads-kanban"],
    queryFn: async () => {
      const { data } = await axios.get("/api/leads");
      return data.data as Lead[];
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, estagio, dataFechamento, motivoPerda, proximoContato }: { id: string; estagio: EstagioLead; dataFechamento?: string; motivoPerda?: string; proximoContato?: string }) =>
      axios.patch(`/api/leads/${id}/mover`, { estagio, dataFechamento, motivoPerda, proximoContato }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads-kanban"] }),
    onError: () => toast.error("Erro ao mover lead"),
  });

  const leadsRaw = data || [];
  const temFiltroData = !!(dataInicio || dataFim);
  const leads = (() => {
    if (!temFiltroData) return leadsRaw;
    const ini = dataInicio ? new Date(`${dataInicio}T00:00:00`).getTime() : -Infinity;
    const fim = dataFim ? new Date(`${dataFim}T23:59:59.999`).getTime() : Infinity;
    return leadsRaw.filter((l) => {
      const t = new Date(l.createdAt).getTime();
      return t >= ini && t <= fim;
    });
  })();
  const activeLead = leads.find((l) => l.id === activeId);

  const getLeadsForEstagio = (estagio: EstagioLead) =>
    leads.filter((l) => l.estagio === estagio);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as { estagio: EstagioLead };
    const overData = over.data.current as { estagio?: EstagioLead } | undefined;

    const targetEstagio = (overData?.estagio || over.id) as EstagioLead;

    if (activeData?.estagio !== targetEstagio && ESTAGIOS.includes(targetEstagio)) {
      if (targetEstagio === "FECHADO_PERDIDO") {
        setCancelPendente({ id: active.id as string });
        return;
      }
      const hoje = new Date().toISOString().slice(0, 10);
      moveMutation.mutate({
        id: active.id as string,
        estagio: targetEstagio,
        dataFechamento: targetEstagio === "FECHADO_GANHO" ? hoje : undefined,
      });
    }
  }

  function confirmarCancelamentoKanban() {
    if (!dataCancelamento || !motivoCategoria) return;
    if (reengajar && !proximoContato) return;
    const motivoPerda = motivoCancelamento.trim()
      ? `${motivoCategoria} — ${motivoCancelamento.trim()}`
      : motivoCategoria;
    moveMutation.mutate({
      id: cancelPendente!.id,
      estagio: "FECHADO_PERDIDO",
      dataFechamento: dataCancelamento,
      motivoPerda,
      proximoContato: reengajar ? proximoContato : undefined,
    });
    setCancelPendente(null);
    setMotivoCategoria("");
    setMotivoCancelamento("");
    setDataCancelamento(new Date().toISOString().slice(0, 10));
    setReengajar(false);
    setProximoContato("");
  }

  const totalLeads = leads.length;
  const valorTotal = leads.reduce((sum, l) => sum + Number(l.valorEstimado || 0), 0);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Pipeline de Leads</h2>
          <p className="text-muted-foreground">
            {totalLeads} leads · {formatCurrency(valorTotal)} em pipeline
            {temFiltroData && " (filtrado por data)"}
          </p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Lead
        </Button>
      </div>

      {/* Filtro por data de criação */}
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground shrink-0">Criados de</span>
        <input
          type="date"
          value={dataInicio}
          max={dataFim || undefined}
          onChange={(e) => setDataInicio(e.target.value)}
          className="h-9 w-[150px] rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          title="Data inicial"
        />
        <span className="text-sm text-muted-foreground shrink-0">até</span>
        <input
          type="date"
          value={dataFim}
          min={dataInicio || undefined}
          onChange={(e) => setDataFim(e.target.value)}
          className="h-9 w-[150px] rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          title="Data final"
        />
        {temFiltroData && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setDataInicio(""); setDataFim(""); }}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="w-3.5 h-3.5 mr-1" />Limpar
          </Button>
        )}
      </div>

      {/* Dialog de cancelamento via drag */}
      <Dialog open={!!cancelPendente} onOpenChange={(o) => { if (!o) { setCancelPendente(null); setMotivoCategoria(""); setMotivoCancelamento(""); setReengajar(false); setProximoContato(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <ThumbsDown className="w-4 h-4" /> Cancelar lead
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Data do cancelamento <span className="text-red-500">*</span></p>
              <input
                type="date"
                value={dataCancelamento}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDataCancelamento(e.target.value)}
                className={`w-full h-9 rounded-md border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${!dataCancelamento ? "border-red-400" : "border-input"}`}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Motivo <span className="text-red-500">*</span></p>
              <div className="flex flex-wrap gap-2">
                {MOTIVOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMotivoCategoria(m)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${motivoCategoria === m ? "bg-red-600 text-white border-red-600" : "bg-muted text-muted-foreground border-border hover:border-red-400 hover:text-red-500"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {motivoCategoria && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Observação <span className="text-muted-foreground font-normal">(opcional)</span>
                </p>
                <Textarea
                  placeholder="Descreva o motivo do cancelamento..."
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  rows={2}
                />
              </div>
            )}
            <div className="space-y-2 border-t pt-3">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={reengajar}
                  onChange={(e) => setReengajar(e.target.checked)}
                  className="w-4 h-4 accent-purple-600"
                />
                Entrar em contato novamente
              </label>
              {reengajar && (
                <div className="space-y-1.5 pl-6">
                  <p className="text-xs text-muted-foreground">Data do próximo contato <span className="text-red-500">*</span></p>
                  <input
                    type="date"
                    value={proximoContato}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setProximoContato(e.target.value)}
                    className={`w-full h-9 rounded-md border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${!proximoContato ? "border-red-400" : "border-input"}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ao chegar essa data, o lead volta ao topo do Kanban em roxo, na etapa &quot;Entrar em Contato Novamente&quot;.
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCancelPendente(null); setMotivoCategoria(""); setMotivoCancelamento(""); setReengajar(false); setProximoContato(""); }}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={!dataCancelamento || !motivoCategoria || (reengajar && !proximoContato) || moveMutation.isPending}
              onClick={confirmarCancelamentoKanban}
            >
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kanban Board — altura travada e scroll independente por coluna, pra
          barra de rolagem horizontal ficar sempre visível logo abaixo dos
          cabeçalhos, em vez de só depois de rolar a coluna mais cheia. */}
      <div className="overflow-x-auto overflow-y-hidden pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 min-w-max h-[calc(100vh-320px)] min-h-[400px]">
            {ESTAGIOS.map((estagio) => {
              const estagioLeads = getLeadsForEstagio(estagio);
              const estagioValor = estagioLeads.reduce((s, l) => s + Number(l.valorEstimado || 0), 0);

              return (
                <div
                  key={estagio}
                  className={`w-72 flex flex-col rounded-xl border-2 ${ESTAGIO_COLORS[estagio]}`}
                  data-estagio={estagio}
                >
                  {/* Column Header */}
                  <div className="p-3 border-b border-inherit shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${ESTAGIO_HEADER_COLORS[estagio]}`} />
                        <span className="font-semibold text-sm">{ESTAGIO_LABELS[estagio]}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {estagioLeads.length}
                      </Badge>
                    </div>
                    {estagioValor > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 ml-4">
                        {formatCurrency(estagioValor)}
                      </p>
                    )}
                  </div>

                  {/* Cards — rola por dentro, não estica a coluna inteira */}
                  <div
                    className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2"
                    id={estagio}
                    data-estagio={estagio}
                  >
                    <SortableContext
                      items={estagioLeads.map((l) => l.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {estagioLeads.map((lead) => (
                        <KanbanCard key={lead.id} lead={lead} />
                      ))}
                    </SortableContext>
                  </div>

                  {/* Add Button */}
                  <div className="p-2 border-t border-inherit shrink-0">
                    <NovoLeadDialog
                      estagio={estagio}
                      onSuccess={() => qc.invalidateQueries({ queryKey: ["leads-kanban"] })}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeId && activeLead && (
              <KanbanCard lead={activeLead} overlay />
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
