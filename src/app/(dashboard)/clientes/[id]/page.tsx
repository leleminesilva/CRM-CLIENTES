"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft, Edit, Trash2, User, Phone, Mail, MapPin,
  Clock, MessageSquare, TrendingUp, CheckSquare, ExternalLink,
  ClipboardList, FileText, Flame, Minus, Snowflake,
  PhoneCall, MessageCircle, FileCheck, Handshake, ThumbsUp, ThumbsDown, ChevronRight,
  Pencil, X, Check, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatCurrency, formatCPFCNPJ, formatPhone, ORIGEM_LABELS, PORTE_LABELS, formatDateTime } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";
import type { Cliente } from "@/types";

type EstagioLead = "NOVO_LEAD" | "CONTATO_INICIAL" | "PRIMEIRO_ORCAMENTO" | "QUALIFICACAO" | "PROPOSTA_ENVIADA" | "NEGOCIACAO" | "FECHADO_GANHO" | "FECHADO_PERDIDO";

const ETAPAS: { estagio: EstagioLead; label: string; icon: React.ElementType }[] = [
  { estagio: "NOVO_LEAD",           label: "Entrar em Contato",   icon: PhoneCall },
  { estagio: "CONTATO_INICIAL",     label: "Contato Feito",       icon: MessageCircle },
  { estagio: "PRIMEIRO_ORCAMENTO",  label: "Primeiro Orçamento",  icon: FileText },
  { estagio: "QUALIFICACAO",        label: "Visita / Medição",    icon: ClipboardList },
  { estagio: "PROPOSTA_ENVIADA", label: "Orçamento Final",    icon: FileCheck },
  { estagio: "NEGOCIACAO",       label: "Em Negociação",      icon: Handshake },
];

function PipelineTracker({
  leadId, clienteId, clienteNome, estagio, onUpdate,
}: {
  leadId: string | null;
  clienteId: string;
  clienteNome: string;
  estagio: EstagioLead;
  onUpdate: () => void;
}) {
  const hoje = new Date().toISOString().slice(0, 10);

  // Dialog cancelamento
  const [cancelDialog, setCancelDialog] = useState(false);
  const [motivoCategoria, setMotivoCategoria] = useState("");
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [dataCancelamento, setDataCancelamento] = useState(hoje);

  // Dialog Primeiro Orçamento / Orçamento Final
  const [orcDialog, setOrcDialog] = useState(false);
  const [orcTargetEstagio, setOrcTargetEstagio] = useState<EstagioLead>("PRIMEIRO_ORCAMENTO");
  const [orcNumero, setOrcNumero] = useState("");
  const [orcValor, setOrcValor] = useState("");
  const [orcData, setOrcData] = useState(hoje);

  // Dialog Confirmado (FECHADO_GANHO)
  const [confDialog, setConfDialog] = useState(false);
  const [confValor, setConfValor] = useState("");
  const [confData, setConfData] = useState(hoje);

  const MOTIVOS_CANCELAMENTO = ["Prazo", "Preço", "Distância", "Não Realizamos", "Outros"];

  const mutation = useMutation({
    mutationFn: async ({ novoEstagio, motivoPerda, dataFechamento, clientePatch }: {
      novoEstagio: EstagioLead;
      motivoPerda?: string;
      dataFechamento?: string;
      clientePatch?: Record<string, unknown>;
    }) => {
      await (leadId
        ? axios.patch(`/api/leads/${leadId}/mover`, { estagio: novoEstagio, motivoPerda, dataFechamento })
        : axios.post("/api/leads", { titulo: clienteNome, estagio: novoEstagio, origem: "OUTROS", clienteId }));

      const statusMap: Partial<Record<EstagioLead, string>> = {
        FECHADO_GANHO:   "APROVADO",
        FECHADO_PERDIDO: "NAO_APROVADO",
      };
      const novoStatus = statusMap[novoEstagio] ?? "PENDENTE";
      await axios.patch(`/api/clientes/${clienteId}`, { statusOrcamento: novoStatus, ...clientePatch });
    },
    onSuccess: () => { toast.success("Etapa atualizada!"); onUpdate(); },
    onError: () => toast.error("Erro ao atualizar etapa"),
  });

  function confirmarCancelamento() {
    if (!dataCancelamento) {
      toast.error("Informe a data do cancelamento");
      return;
    }
    if (!motivoCategoria) {
      toast.error("Selecione o motivo do cancelamento");
      return;
    }
    if (!motivoCancelamento.trim()) {
      toast.error("A observação é obrigatória");
      return;
    }
    const motivoPerda = motivoCancelamento.trim()
      ? `${motivoCategoria} — ${motivoCancelamento.trim()}`
      : motivoCategoria;
    mutation.mutate({ novoEstagio: "FECHADO_PERDIDO", motivoPerda, dataFechamento: dataCancelamento });
    setCancelDialog(false);
    setMotivoCategoria("");
    setMotivoCancelamento("");
    setDataCancelamento(new Date().toISOString().slice(0, 10));
  }

  const isFechado = estagio === "FECHADO_GANHO" || estagio === "FECHADO_PERDIDO";
  const currentIdx = ETAPAS.findIndex(e => e.estagio === estagio);

  return (
    <>
      <div className="bg-card border rounded-xl p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Processo de Venda</p>
        <div className="flex items-center gap-1 flex-wrap">
          {ETAPAS.map((etapa, idx) => {
            const Icon = etapa.icon;
            const isPast   = !isFechado && idx < currentIdx;
            const isActive = !isFechado && idx === currentIdx;

            return (
              <div key={etapa.estagio} className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => {
                    if (etapa.estagio === "PRIMEIRO_ORCAMENTO" || etapa.estagio === "PROPOSTA_ENVIADA") {
                      setOrcTargetEstagio(etapa.estagio);
                      setOrcData(hoje);
                      setOrcNumero("");
                      setOrcValor("");
                      setOrcDialog(true);
                    } else {
                      mutation.mutate({ novoEstagio: etapa.estagio });
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                    isActive && "bg-indigo-600 text-white border-indigo-600 shadow-sm",
                    isPast   && "bg-indigo-600/20 text-indigo-400 border-indigo-600/30 hover:bg-indigo-600/30",
                    !isActive && !isPast && "bg-muted text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {etapa.label}
                </button>
                {idx < ETAPAS.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                )}
              </div>
            );
          })}

          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />

          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => { setConfValor(""); setConfData(hoje); setConfDialog(true); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
              estagio === "FECHADO_GANHO"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-emerald-600/10 text-emerald-500 border-emerald-600/30 hover:bg-emerald-600/20",
            )}
          >
            <ThumbsUp className="w-3 h-3" /> Confirmado
          </button>

          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => setCancelDialog(true)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
              estagio === "FECHADO_PERDIDO"
                ? "bg-red-600 text-white border-red-600 shadow-sm"
                : "bg-red-600/10 text-red-500 border-red-600/30 hover:bg-red-600/20",
            )}
          >
            <ThumbsDown className="w-3 h-3" /> Cancelado
          </button>
        </div>
      </div>

      <Dialog open={cancelDialog} onOpenChange={(open) => { setCancelDialog(open); if (!open) { setMotivoCategoria(""); setMotivoCancelamento(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <ThumbsDown className="w-4 h-4" /> Cancelar atendimento
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
              <p className="text-sm font-medium">Motivo do cancelamento <span className="text-red-500">*</span></p>
              <div className="flex flex-wrap gap-2">
                {MOTIVOS_CANCELAMENTO.map((motivo) => (
                  <button
                    key={motivo}
                    type="button"
                    onClick={() => setMotivoCategoria(motivo)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      motivoCategoria === motivo
                        ? "bg-red-600 text-white border-red-600 shadow-sm"
                        : "bg-muted text-muted-foreground border-border hover:border-red-400 hover:text-red-500",
                    )}
                  >
                    {motivo}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Observação <span className="text-red-500">*</span></p>
              <Textarea
                placeholder="Descreva o motivo do cancelamento..."
                value={motivoCancelamento}
                onChange={(e) => setMotivoCancelamento(e.target.value)}
                rows={3}
                className={motivoCategoria && !motivoCancelamento.trim() ? "border-red-400 focus-visible:ring-red-400" : ""}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCancelDialog(false); setMotivoCategoria(""); setMotivoCancelamento(""); }}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={!dataCancelamento || !motivoCategoria || !motivoCancelamento.trim() || mutation.isPending}
              onClick={confirmarCancelamento}
            >
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Primeiro Orçamento / Orçamento Final */}
      <Dialog open={orcDialog} onOpenChange={(o) => { if (!o) { setOrcDialog(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-500">
              <FileText className="w-4 h-4" />
              {orcTargetEstagio === "PROPOSTA_ENVIADA" ? "Orçamento Final" : "Primeiro Orçamento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Número do Orçamento <span className="text-red-500">*</span></p>
              <input
                value={orcNumero}
                onChange={(e) => setOrcNumero(e.target.value)}
                placeholder="Ex: 11241"
                className={`w-full h-9 rounded-md border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${!orcNumero ? "border-red-400" : "border-input"}`}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Valor (R$) <span className="text-red-500">*</span></p>
              <input
                type="number"
                step="0.01"
                min="0"
                value={orcValor}
                onChange={(e) => setOrcValor(e.target.value)}
                placeholder="0,00"
                className={`w-full h-9 rounded-md border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${!orcValor ? "border-red-400" : "border-input"}`}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Data do Orçamento <span className="text-red-500">*</span></p>
              <input
                type="date"
                value={orcData}
                max={hoje}
                onChange={(e) => setOrcData(e.target.value)}
                className={`w-full h-9 rounded-md border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${!orcData ? "border-red-400" : "border-input"}`}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOrcDialog(false)}>Voltar</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={!orcNumero || !orcValor || !orcData || mutation.isPending}
              onClick={async () => {
                await axios.patch(`/api/clientes/${clienteId}`, {
                  numeroOrcamento: orcNumero,
                  valorOrcamento: Number(orcValor),
                  orcamentoEnviadoEm: orcData,
                });
                mutation.mutate({ novoEstagio: orcTargetEstagio });
                setOrcDialog(false);
              }}
            >
              {mutation.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmado (FECHADO_GANHO) */}
      <Dialog open={confDialog} onOpenChange={(o) => { if (!o) setConfDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-500">
              <ThumbsUp className="w-4 h-4" /> Confirmar venda
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Valor (R$) <span className="text-red-500">*</span></p>
              <input
                type="number"
                step="0.01"
                min="0"
                value={confValor}
                onChange={(e) => setConfValor(e.target.value)}
                placeholder="0,00"
                className={`w-full h-9 rounded-md border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${!confValor ? "border-red-400" : "border-input"}`}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Data da Venda <span className="text-red-500">*</span></p>
              <input
                type="date"
                value={confData}
                max={hoje}
                onChange={(e) => setConfData(e.target.value)}
                className={`w-full h-9 rounded-md border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${!confData ? "border-red-400" : "border-input"}`}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfDialog(false)}>Voltar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!confValor || !confData || mutation.isPending}
              onClick={() => {
                mutation.mutate({
                  novoEstagio: "FECHADO_GANHO",
                  dataFechamento: confData,
                  clientePatch: { valorOrcamento: Number(confValor), dataVenda: confData },
                });
                setConfDialog(false);
              }}
            >
              {mutation.isPending ? "Salvando..." : "Confirmar venda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TemperaturaSelect({
  clienteId, valor, onSaved,
}: { clienteId: string; valor: string; onSaved: () => void }) {
  const mutation = useMutation({
    mutationFn: (v: string) => axios.patch(`/api/clientes/${clienteId}`, { temperatura: v }),
    onSuccess: () => { toast.success("Temperatura atualizada!"); onSaved(); },
    onError: () => toast.error("Erro ao atualizar temperatura"),
  });

  return (
    <select
      value={valor ?? "MORNO"}
      onChange={e => mutation.mutate(e.target.value)}
      disabled={mutation.isPending}
      className="text-xs font-medium bg-transparent border border-border rounded px-2 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
    >
      <option value="QUENTE">🔥 Quente</option>
      <option value="MORNO">➖ Morno</option>
      <option value="FRIO">❄️ Frio</option>
    </select>
  );
}

function OrcamentoCard({
  clienteId, numeroOrcamento, valorOrcamento, orcamentoEnviadoEm, dataVenda, statusOrcamento, temperatura, onSaved,
}: {
  clienteId: string;
  numeroOrcamento?: string | null;
  valorOrcamento?: number | null;
  orcamentoEnviadoEm?: string | null;
  dataVenda?: string | null;
  statusOrcamento: string;
  temperatura: string;
  onSaved: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center mb-3">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Orçamento
        </p>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Número</span>
          <span className="font-medium font-mono">{numeroOrcamento || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor</span>
          <span className={valorOrcamento ? "font-semibold text-emerald-600" : "text-muted-foreground"}>
            {valorOrcamento ? formatCurrency(Number(valorOrcamento)) : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Data do Orçamento</span>
          <span className="font-medium">
            {orcamentoEnviadoEm ? new Date(orcamentoEnviadoEm).toLocaleDateString("pt-BR") : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Data da Venda</span>
          <span className="font-medium">
            {dataVenda ? new Date(dataVenda).toLocaleDateString("pt-BR") : "—"}
          </span>
        </div>
        <div className="flex justify-between items-center pt-1 border-t border-border">
          <span className="text-muted-foreground">Status</span>
          <Badge variant={
            statusOrcamento === "APROVADO" ? "success" :
            statusOrcamento === "NAO_APROVADO" ? "destructive" : "secondary"
          }>
            {statusOrcamento === "APROVADO" ? "✅ Confirmado" :
             statusOrcamento === "NAO_APROVADO" ? "❌ Cancelado" : "⏳ Pendente"}
          </Badge>
        </div>
        <div className="flex justify-between items-center pt-1 border-t border-border">
          <span className="text-muted-foreground flex items-center gap-1">
            {temperatura === "QUENTE" && <Flame className="w-3 h-3 text-red-500" />}
            {temperatura === "MORNO"  && <Minus className="w-3 h-3 text-amber-500" />}
            {temperatura === "FRIO"   && <Snowflake className="w-3 h-3 text-blue-500" />}
            Temperatura
          </span>
          <TemperaturaSelect clienteId={clienteId} valor={temperatura} onSaved={onSaved} />
        </div>
      </div>
    </Card>
  );
}

function ObservacoesCard({
  clienteId, observacoes, onSaved,
}: { clienteId: string; observacoes: string | null; onSaved: () => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(observacoes ?? "");

  const mutation = useMutation({
    mutationFn: () => axios.patch(`/api/clientes/${clienteId}`, { observacoes: texto }),
    onSuccess: () => { toast.success("Observações salvas!"); onSaved(); setEditando(false); },
    onError: () => toast.error("Erro ao salvar observações"),
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" /> Observações
        </p>
        {!editando ? (
          <button
            onClick={() => { setTexto(observacoes ?? ""); setEditando(true); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => setEditando(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="text-indigo-500 hover:text-indigo-400 font-medium text-xs flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        )}
      </div>
      {editando ? (
        <Textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          rows={4}
          placeholder="Adicione observações sobre este cliente..."
          className="text-sm resize-none"
          autoFocus
        />
      ) : (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap min-h-[40px]">
          {observacoes || <span className="italic">Nenhuma observação. Clique no lápis para adicionar.</span>}
        </p>
      )}
    </Card>
  );
}

export default function ClienteDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMINISTRADOR";

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente", id],
    queryFn: async () => {
      const { data } = await axios.get(`/api/clientes/${id}`);
      return data.data as Cliente & {
        atividades: Array<{ id: string; descricao: string; createdAt: string; user: { nome: string } }>;
        comentarios: Array<{ id: string; texto: string; createdAt: string; user: { nome: string } }>;
        leads: Array<{ id: string; titulo: string; estagio: string; valorEstimado: number }>;
        oportunidades: Array<{ id: string; titulo: string; valor: number; status: string }>;
        tarefas: Array<{ id: string; titulo: string; status: string; dataVencimento: string }>;
      };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => axios.delete(`/api/clientes/${id}`),
    onSuccess: () => { toast.success("Cliente removido"); router.push("/clientes"); },
    onError: () => toast.error("Erro ao remover"),
  });

  const revisarMutation = useMutation({
    mutationFn: () => axios.patch(`/api/clientes/${id}/revisar`),
    onSuccess: () => { toast.success("Cliente marcado como Em Processo!"); qc.invalidateQueries({ queryKey: ["cliente", id] }); },
    onError: () => toast.error("Erro ao marcar Em Processo"),
  });

  const [notifDialog, setNotifDialog] = useState(false);
  const [notifMensagem, setNotifMensagem] = useState("");

  const notifMutation = useMutation({
    mutationFn: (mensagem: string) => axios.post(`/api/clientes/${id}/notificar`, { mensagem }),
    onSuccess: () => {
      toast.success("Responsável notificado!");
      setNotifDialog(false);
      setNotifMensagem("");
      qc.invalidateQueries({ queryKey: ["cliente", id] });
    },
    onError: () => toast.error("Erro ao enviar notificação"),
  });

  const limite2d = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const leadEstagio = cliente?.leads?.[0]?.estagio as string | undefined;
  const fechado = leadEstagio === "FECHADO_GANHO" || leadEstagio === "FECHADO_PERDIDO"
    || cliente?.statusOrcamento === "APROVADO" || cliente?.statusOrcamento === "NAO_APROVADO";
  const clienteParado = !fechado && cliente?.updatedAt && new Date(cliente.updatedAt) < limite2d;

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-48 bg-muted rounded-xl" />
      </div>
    );
  }

  if (!cliente) return <div className="text-muted-foreground">Cliente não encontrado</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold">{cliente.nome}</h2>
            {cliente.porte && <Badge variant="secondary">{PORTE_LABELS[cliente.porte]}</Badge>}
            <Badge variant="info">{ORIGEM_LABELS[cliente.origem]}</Badge>
          </div>
          {cliente.nomeFantasia && <p className="text-muted-foreground">{cliente.nomeFantasia}</p>}
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          {isAdmin && cliente.responsavelId && (
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => { setNotifMensagem(""); setNotifDialog(true); }}
            >
              <Bell className="w-4 h-4 mr-2" />
              Notificar
            </Button>
          )}
          {clienteParado && (
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => revisarMutation.mutate()}
              disabled={revisarMutation.isPending}
            >
              ✅ Em Processo
            </Button>
          )}
          <Link href={`/clientes/${id}/editar`}>
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Remover
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={() => deleteMutation.mutate()}
                >
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Pipeline — sempre visível */}
      <PipelineTracker
        leadId={cliente.leads?.[0]?.id ?? null}
        clienteId={id}
        clienteNome={cliente.nome}
        estagio={(cliente.leads?.[0]?.estagio as EstagioLead) ?? "NOVO_LEAD"}
        onUpdate={() => qc.invalidateQueries({ queryKey: ["cliente", id] })}
      />

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Contato</p>
          <div className="space-y-1.5">
            {cliente.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <a href={`mailto:${cliente.email}`} className="hover:underline">{cliente.email}</a>
              </div>
            )}
            {cliente.telefone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{formatPhone(cliente.telefone)}</span>
              </div>
            )}
            {cliente.whatsapp && (
              <div className="flex items-center gap-2 text-sm">
                <a href={`https://wa.me/55${cliente.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" title="Abrir no WhatsApp" className="flex items-center gap-2 hover:opacity-80">
                  <MessageCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  <span>{formatPhone(cliente.whatsapp)}</span>
                </a>
              </div>
            )}
            {cliente.cpfCnpj && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{formatCPFCNPJ(cliente.cpfCnpj)}</span>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Endereço</p>
          {(cliente.logradouro || cliente.bairro || cliente.cidade || cliente.cep) ? (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                {cliente.tipoResidencia && (
                  <p className="font-medium text-xs text-muted-foreground">
                    {cliente.tipoResidencia === "CASA" ? "Casa" :
                     cliente.tipoResidencia === "APARTAMENTO" ? "Apartamento" :
                     cliente.tipoResidencia === "COMERCIAL" ? "Comercial" : "Outros"}
                  </p>
                )}
                {(cliente.logradouro || cliente.numero || cliente.complemento) && (
                  <p>
                    {[cliente.logradouro, cliente.numero, cliente.complemento].filter(Boolean).join(", ")}
                  </p>
                )}
                {(cliente.bairro || cliente.cidade || cliente.estado) && (
                  <p className="text-muted-foreground">
                    {[cliente.bairro, cliente.cidade && cliente.estado ? `${cliente.cidade}/${cliente.estado}` : (cliente.cidade || cliente.estado)].filter(Boolean).join(" — ")}
                  </p>
                )}
                {cliente.cep && (
                  <p className="text-muted-foreground">CEP: {cliente.cep}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem endereço cadastrado</p>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Vendedor</p>
          {cliente.responsavel ? (
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs bg-indigo-100 text-indigo-600">
                  {cliente.responsavel.nome.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{cliente.responsavel.nome}</p>
                <p className="text-xs text-muted-foreground">{cliente.responsavel.email}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem vendedor atribuído</p>
          )}
        </Card>
      </div>

      {/* Ficha de Atendimento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" /> Atendimento
          </p>
          <div className="space-y-2 text-sm">
            {cliente.dataInscricao && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data de inscrição</span>
                <span className="font-medium">{new Date(cliente.dataInscricao).toLocaleDateString("pt-BR")}</span>
              </div>
            )}
            {cliente.servicoBuscado && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Serviço buscado</span>
                <span className="font-medium">{cliente.servicoBuscado}</span>
              </div>
            )}
          </div>
        </Card>

        <OrcamentoCard
          clienteId={id}
          numeroOrcamento={cliente.numeroOrcamento as string | null}
          valorOrcamento={cliente.valorOrcamento ? Number(cliente.valorOrcamento) : null}
          orcamentoEnviadoEm={cliente.orcamentoEnviadoEm as string | null}
          dataVenda={cliente.dataVenda as string | null}
          statusOrcamento={cliente.statusOrcamento as string}
          temperatura={cliente.temperatura as string}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["cliente", id] });
            qc.invalidateQueries({ queryKey: ["dashboard"] });
          }}
        />
      </div>

      <ObservacoesCard
        clienteId={id}
        observacoes={cliente.observacoes as string | null}
        onSaved={() => qc.invalidateQueries({ queryKey: ["cliente", id] })}
      />

      {/* Card de Notificação — só aparece quando há notificação ativa */}
      {cliente.notificacaoMensagem && (
        <Card className="p-4 border-amber-500/50 bg-amber-500/5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-amber-400 font-medium uppercase tracking-wide flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" /> Notificação
            </p>
            {!cliente.notificacaoLida && (
              <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-medium">Não lida</span>
            )}
            {cliente.notificacaoLida && (
              <span className="text-xs text-muted-foreground">Lida</span>
            )}
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{cliente.notificacaoMensagem}</p>
          {cliente.notificacaoEm && (
            <p className="text-xs text-muted-foreground mt-2">
              Enviada em {new Date(cliente.notificacaoEm).toLocaleString("pt-BR")}
            </p>
          )}
        </Card>
      )}

      {/* Dialog Notificar Responsável */}
      <Dialog open={notifDialog} onOpenChange={(o) => { if (!o) setNotifDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <Bell className="w-4 h-4" /> Notificar Responsável
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Esta mensagem será exibida para <strong className="text-foreground">{cliente.responsavel?.nome}</strong> ao acessar o sistema.
            </p>
            <Textarea
              placeholder="Digite a mensagem para o responsável..."
              value={notifMensagem}
              onChange={(e) => setNotifMensagem(e.target.value)}
              rows={4}
              className={!notifMensagem.trim() ? "border-amber-400/50 focus-visible:ring-amber-400" : ""}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNotifDialog(false)}>Cancelar</Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              disabled={!notifMensagem.trim() || notifMutation.isPending}
              onClick={() => notifMutation.mutate(notifMensagem)}
            >
              {notifMutation.isPending ? "Enviando..." : "Enviar notificação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs defaultValue={isAdmin ? "historico" : "leads"}>
        <TabsList>
          {isAdmin && (
            <TabsTrigger value="historico">
              <Clock className="w-4 h-4 mr-2" />
              Histórico ({(cliente.atividades || []).length})
            </TabsTrigger>
          )}
          <TabsTrigger value="leads">
            <TrendingUp className="w-4 h-4 mr-2" />
            Leads ({(cliente.leads || []).length})
          </TabsTrigger>
          <TabsTrigger value="tarefas">
            <CheckSquare className="w-4 h-4 mr-2" />
            Tarefas ({(cliente.tarefas || []).length})
          </TabsTrigger>
          <TabsTrigger value="comentarios">
            <MessageSquare className="w-4 h-4 mr-2" />
            Comentários ({(cliente.comentarios || []).length})
          </TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="historico" className="mt-4">
            <div className="space-y-3">
              {(cliente.atividades || []).length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma atividade registrada</p>
              ) : (
                cliente.atividades.map(a => (
                  <div key={a.id} className="flex gap-3 items-start">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm">{a.descricao}</p>
                      <p className="text-xs text-muted-foreground">{a.user.nome} · {formatDateTime(a.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        )}

        <TabsContent value="leads" className="mt-4">
          <div className="space-y-2">
            {(cliente.leads || []).length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum lead vinculado</p>
            ) : (
              cliente.leads.map(l => (
                <Card key={l.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{l.titulo}</p>
                    <Badge variant="outline" className="text-xs mt-1">{l.estagio.replace("_", " ")}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.valorEstimado && <p className="text-sm font-semibold">{formatCurrency(l.valorEstimado)}</p>}
                    <Link href={`/leads`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="tarefas" className="mt-4">
          <div className="space-y-2">
            {(cliente.tarefas || []).length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma tarefa vinculada</p>
            ) : (
              cliente.tarefas.map(t => (
                <Card key={t.id} className="p-3 flex items-center justify-between">
                  <p className="font-medium text-sm">{t.titulo}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={t.status === "CONCLUIDA" ? "success" : t.status === "ATRASADA" ? "destructive" : "secondary"}>
                      {t.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground">{formatDateTime(t.dataVencimento)}</p>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="comentarios" className="mt-4">
          <div className="space-y-3">
            {(cliente.comentarios || []).length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum comentário</p>
            ) : (
              cliente.comentarios.map(c => (
                <Card key={c.id} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-600">
                        {c.user.nome.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-medium">{c.user.nome}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.texto}</p>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
