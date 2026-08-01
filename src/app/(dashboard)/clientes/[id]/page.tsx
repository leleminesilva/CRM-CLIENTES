"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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
import { formatCurrency, formatCPFCNPJ, formatPhone, ORIGEM_LABELS, PORTE_LABELS, formatDateTime, formatDataVencimento } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";
import type { Cliente } from "@/types";

type EstagioLead = "NOVO_LEAD" | "CONTATO_INICIAL" | "PRIMEIRO_ORCAMENTO" | "QUALIFICACAO" | "PROPOSTA_ENVIADA" | "NEGOCIACAO" | "FECHADO_GANHO" | "FECHADO_PERDIDO" | "REENGAJAR";

const ETAPAS: { estagio: EstagioLead; label: string; icon: React.ElementType }[] = [
  { estagio: "NOVO_LEAD",           label: "Entrar em Contato",   icon: PhoneCall },
  { estagio: "CONTATO_INICIAL",     label: "Contato Feito",       icon: MessageCircle },
  { estagio: "PRIMEIRO_ORCAMENTO",  label: "Primeiro Orçamento",  icon: FileText },
  { estagio: "QUALIFICACAO",        label: "Visita / Medição",    icon: ClipboardList },
  { estagio: "PROPOSTA_ENVIADA", label: "Orçamento Final",    icon: FileCheck },
  { estagio: "NEGOCIACAO",       label: "Em Negociação",      icon: Handshake },
];

// Interpreta valores em formato brasileiro (4.562,98) ou americano (4562.98)
function parseBRL(raw: string): number {
  const s = raw.trim();
  if (!s) return 0;
  const hasDot   = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) return parseFloat(s.replace(/\./g, "").replace(",", "."));
  if (hasComma)           return parseFloat(s.replace(",", "."));
  return parseFloat(s);
}

function PipelineTracker({
  leadId, clienteId, clienteNome, estagio, numeroOrcamentoAtual, onUpdate,
}: {
  leadId: string | null;
  clienteId: string;
  clienteNome: string;
  estagio: EstagioLead;
  numeroOrcamentoAtual?: string | null;
  onUpdate: () => void;
}) {
  const hoje = new Date().toISOString().slice(0, 10);

  // Dialog cancelamento
  const [cancelDialog, setCancelDialog] = useState(false);
  const [motivoCategoria, setMotivoCategoria] = useState("");
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [dataCancelamento, setDataCancelamento] = useState(hoje);
  const [reengajar, setReengajar] = useState(false);
  const [proximoContato, setProximoContato] = useState("");

  // Dialog Primeiro Orçamento / Orçamento Final
  const [orcDialog, setOrcDialog] = useState(false);
  const [orcTargetEstagio, setOrcTargetEstagio] = useState<EstagioLead>("PRIMEIRO_ORCAMENTO");
  const [orcNumero, setOrcNumero] = useState("");
  const [orcValor, setOrcValor] = useState("");
  const [orcData, setOrcData] = useState(hoje);

  // Dialog Confirmado (FECHADO_GANHO)
  const [confDialog, setConfDialog] = useState(false);
  const [confNumero, setConfNumero] = useState("");
  const [confValor, setConfValor] = useState("");
  const [confData, setConfData] = useState(hoje);

  const MOTIVOS_CANCELAMENTO = ["Prazo", "Preço", "Distância", "Não Realizamos", "Outros"];

  const mutation = useMutation({
    mutationFn: async ({ novoEstagio, motivoPerda, dataFechamento, proximoContato, clientePatch, venda }: {
      novoEstagio: EstagioLead;
      motivoPerda?: string;
      dataFechamento?: string;
      proximoContato?: string;
      clientePatch?: Record<string, unknown>;
      venda?: { numeroOrcamento: string; valor: number; data: string };
    }) => {
      // Captura ANTES de mover o lead: se o cliente já estava Confirmado e o
      // vendedor clica em "Confirmado" de novo pra registrar outra venda, o
      // lead já tem uma Venda vinculada (Venda.leadId é único) — nesse caso a
      // nova venda entra sem leadId, como uma venda adicional, em vez de
      // colidir com a constraint e falhar silenciosamente.
      const jaEstavaFechado = estagio === "FECHADO_GANHO";

      let resolvedLeadId = leadId;
      if (leadId) {
        await axios.patch(`/api/leads/${leadId}/mover`, { estagio: novoEstagio, motivoPerda, dataFechamento, proximoContato });
      } else {
        const res = await axios.post("/api/leads", { titulo: clienteNome, estagio: novoEstagio, origem: "OUTROS", clienteId });
        resolvedLeadId = res.data?.data?.id ?? null;
      }

      const statusMap: Partial<Record<EstagioLead, string>> = {
        FECHADO_GANHO:   "APROVADO",
        FECHADO_PERDIDO: "NAO_APROVADO",
      };
      const novoStatus = statusMap[novoEstagio] ?? "PENDENTE";
      await axios.patch(`/api/clientes/${clienteId}`, { statusOrcamento: novoStatus, ...clientePatch });

      if (venda) {
        await axios.post(`/api/clientes/${clienteId}/vendas`, { ...venda, leadId: jaEstavaFechado ? null : resolvedLeadId });
      }
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
    if (reengajar && !proximoContato) {
      toast.error("Informe a data do próximo contato");
      return;
    }
    const motivoPerda = motivoCancelamento.trim()
      ? `${motivoCategoria} — ${motivoCancelamento.trim()}`
      : motivoCategoria;
    mutation.mutate({
      novoEstagio: "FECHADO_PERDIDO",
      motivoPerda,
      dataFechamento: dataCancelamento,
      proximoContato: reengajar ? proximoContato : undefined,
    });
    setCancelDialog(false);
    setMotivoCategoria("");
    setMotivoCancelamento("");
    setDataCancelamento(new Date().toISOString().slice(0, 10));
    setReengajar(false);
    setProximoContato("");
  }

  const isFechado = estagio === "FECHADO_GANHO" || estagio === "FECHADO_PERDIDO";
  const currentIdx = ETAPAS.findIndex(e => e.estagio === estagio);

  return (
    <>
      {estagio === "REENGAJAR" && (
        <div className="bg-purple-500/10 border border-purple-500/40 rounded-xl p-4 flex items-center gap-2 text-purple-500">
          <Bell className="w-4 h-4 shrink-0" />
          <p className="text-sm font-medium">Entrar em Contato Novamente — a data de reengajamento chegou</p>
        </div>
      )}
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
            onClick={() => { setConfNumero(numeroOrcamentoAtual || ""); setConfValor(""); setConfData(hoje); setConfDialog(true); }}
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

      <Dialog open={cancelDialog} onOpenChange={(open) => { setCancelDialog(open); if (!open) { setMotivoCategoria(""); setMotivoCancelamento(""); setReengajar(false); setProximoContato(""); } }}>
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
                    Ao chegar essa data, o cliente volta ao topo da lista em roxo, na etapa &quot;Entrar em Contato Novamente&quot;.
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCancelDialog(false); setMotivoCategoria(""); setMotivoCancelamento(""); setReengajar(false); setProximoContato(""); }}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={!dataCancelamento || !motivoCategoria || !motivoCancelamento.trim() || (reengajar && !proximoContato) || mutation.isPending}
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
                type="text"
                inputMode="decimal"
                value={orcValor}
                onChange={(e) => setOrcValor(e.target.value)}
                placeholder="Ex: 4.562,98"
                className={`w-full h-9 rounded-md border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${!orcValor || isNaN(parseBRL(orcValor)) ? "border-red-400" : "border-input"}`}
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
              disabled={!orcNumero || !orcValor || isNaN(parseBRL(orcValor)) || !orcData || mutation.isPending}
              onClick={async () => {
                const valor = parseBRL(orcValor);
                if (orcTargetEstagio === "PROPOSTA_ENVIADA") {
                  // Orçamento Final → campos separados, não sobrescreve o Primeiro Orçamento
                  await axios.patch(`/api/clientes/${clienteId}`, {
                    orcamentoFinalNumero: orcNumero,
                    orcamentoFinalValor: valor,
                    orcamentoFinalEm: orcData,
                  });
                } else {
                  // Primeiro Orçamento → campos originais
                  await axios.patch(`/api/clientes/${clienteId}`, {
                    numeroOrcamento: orcNumero,
                    valorOrcamento: valor,
                    orcamentoEnviadoEm: orcData,
                  });
                }
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
            {estagio === "FECHADO_GANHO" && (
              <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                Isso registra uma <strong>nova venda</strong> pra esse cliente. Pra corrigir número/valor/data de uma venda que já existe, use o ✏️ na aba &quot;Vendas&quot; mais abaixo.
              </p>
            )}
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Número do Orçamento <span className="text-red-500">*</span></p>
              <input
                value={confNumero}
                onChange={(e) => setConfNumero(e.target.value)}
                placeholder="Ex: 11241"
                className={`w-full h-9 rounded-md border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${!confNumero ? "border-red-400" : "border-input"}`}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Valor (R$) <span className="text-red-500">*</span></p>
              <input
                type="text"
                inputMode="decimal"
                value={confValor}
                onChange={(e) => setConfValor(e.target.value)}
                placeholder="Ex: 4.562,98"
                className={`w-full h-9 rounded-md border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${!confValor || isNaN(parseBRL(confValor)) ? "border-red-400" : "border-input"}`}
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
              disabled={!confNumero || !confValor || isNaN(parseBRL(confValor)) || !confData || mutation.isPending}
              onClick={() => {
                mutation.mutate({
                  novoEstagio: "FECHADO_GANHO",
                  dataFechamento: confData,
                  clientePatch: { numeroOrcamento: confNumero, valorOrcamento: parseBRL(confValor), dataVenda: confData },
                  venda: { numeroOrcamento: confNumero, valor: parseBRL(confValor), data: confData },
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
  clienteId, numeroOrcamento, valorOrcamento, orcamentoEnviadoEm,
  orcamentoFinalNumero, orcamentoFinalValor, orcamentoFinalEm,
  dataVenda, statusOrcamento, temperatura, onSaved,
}: {
  clienteId: string;
  numeroOrcamento?: string | null;
  valorOrcamento?: number | null;
  orcamentoEnviadoEm?: string | null;
  orcamentoFinalNumero?: string | null;
  orcamentoFinalValor?: number | null;
  orcamentoFinalEm?: string | null;
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
        {/* Primeiro Orçamento */}
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">Primeiro Orçamento</p>
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
          <span className="text-muted-foreground">Data</span>
          <span className="font-medium">
            {orcamentoEnviadoEm ? new Date(orcamentoEnviadoEm).toLocaleDateString("pt-BR") : "—"}
          </span>
        </div>

        {/* Orçamento Final — só aparece se preenchido */}
        {orcamentoFinalEm && (
          <>
            <div className="border-t border-border pt-2">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">Orçamento Final</p>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Número</span>
              <span className="font-medium font-mono">{orcamentoFinalNumero || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor</span>
              <span className={orcamentoFinalValor ? "font-semibold text-emerald-600" : "text-muted-foreground"}>
                {orcamentoFinalValor ? formatCurrency(Number(orcamentoFinalValor)) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data</span>
              <span className="font-medium">{new Date(orcamentoFinalEm).toLocaleDateString("pt-BR")}</span>
            </div>
          </>
        )}

        <div className="flex justify-between pt-1 border-t border-border">
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
  const isAdmin = user?.role === "ADMINISTRADOR" || user?.role === "DESENVOLVEDOR";

  // Dialog de exclusão do cliente
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [motivoExclusao, setMotivoExclusao] = useState("");

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
    mutationFn: (motivo: string) => axios.delete(`/api/clientes/${id}`, { data: { motivo } }),
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
  const [notifPopupAberto, setNotifPopupAberto] = useState(false);
  const [notifResposta, setNotifResposta] = useState("");
  const [cardResposta, setCardResposta] = useState("");

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

  const marcarLidaMutation = useMutation({
    mutationFn: () => axios.patch(`/api/clientes/${id}/notificar`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente", id] }),
  });

  // Responder à notificação — usado tanto no popup quanto no card fixo
  const responderMutation = useMutation({
    mutationFn: (resposta: string) => axios.patch(`/api/clientes/${id}/notificar`, { resposta }),
    onSuccess: () => {
      toast.success("Resposta enviada!");
      qc.invalidateQueries({ queryKey: ["cliente", id] });
    },
    onError: () => toast.error("Erro ao enviar resposta"),
  });

  // Nova Venda — registra uma venda adicional pro mesmo cliente, sem
  // precisar recriar um pipeline inteiro (Entrar em Contato → ... → Confirmado)
  // pra um negócio que já aconteceu.
  const [novaVendaDialog, setNovaVendaDialog] = useState(false);
  const [nvNumero, setNvNumero] = useState("");
  const [nvValor, setNvValor] = useState("");
  const [nvData, setNvData] = useState(() => new Date().toISOString().slice(0, 10));

  const novaVendaMutation = useMutation({
    mutationFn: () => axios.post(`/api/clientes/${id}/vendas`, {
      numeroOrcamento: nvNumero,
      valor: parseBRL(nvValor),
      data: nvData,
    }),
    onSuccess: () => {
      toast.success("Venda registrada!");
      setNovaVendaDialog(false);
      setNvNumero(""); setNvValor(""); setNvData(new Date().toISOString().slice(0, 10));
      qc.invalidateQueries({ queryKey: ["cliente", id] });
    },
    onError: () => toast.error("Erro ao registrar venda"),
  });

  const removerVendaMutation = useMutation({
    mutationFn: (vendaId: string) => axios.delete(`/api/vendas/${vendaId}`),
    onSuccess: () => {
      toast.success("Venda removida");
      qc.invalidateQueries({ queryKey: ["cliente", id] });
    },
    onError: () => toast.error("Erro ao remover venda"),
  });

  // Editar Venda — corrige número/valor/data de uma venda já registrada, sem
  // criar uma nova (diferente do fluxo "Confirmado"/"Nova Venda", que sempre adiciona).
  const [editVendaId, setEditVendaId] = useState<string | null>(null);
  const [evNumero, setEvNumero] = useState("");
  const [evValor, setEvValor] = useState("");
  const [evData, setEvData] = useState("");

  function abrirEdicaoVenda(v: { id: string; numeroOrcamento: string; valor: number; data: string }) {
    setEditVendaId(v.id);
    setEvNumero(v.numeroOrcamento);
    setEvValor(String(v.valor).replace(".", ","));
    setEvData(new Date(v.data).toISOString().slice(0, 10));
  }

  const editarVendaMutation = useMutation({
    mutationFn: () => axios.patch(`/api/vendas/${editVendaId}`, {
      numeroOrcamento: evNumero,
      valor: parseBRL(evValor),
      data: evData,
    }),
    onSuccess: () => {
      toast.success("Venda atualizada!");
      setEditVendaId(null);
      qc.invalidateQueries({ queryKey: ["cliente", id] });
    },
    onError: () => toast.error("Erro ao atualizar venda"),
  });

  // Abre o popup assim que os dados carregam e há notificação não lida para o usuário atual
  const jaAbriuPopup = useState(false);
  useEffect(() => {
    if (
      cliente &&
      cliente.notificacaoMensagem &&
      !cliente.notificacaoLida &&
      cliente.responsavelId === user?.id &&
      !jaAbriuPopup[0]
    ) {
      jaAbriuPopup[1](true);
      setNotifPopupAberto(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente]);

  function fecharPopup() {
    setNotifPopupAberto(false);
    setNotifResposta("");
    marcarLidaMutation.mutate();
  }

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
      {/* Popup de notificação — abre quando o responsável entra na tela do cliente */}
      {notifPopupAberto && cliente.notificacaoMensagem && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-amber-500/50 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none mt-0.5">🔔</span>
              <div>
                <p className="text-xs text-amber-400 font-medium uppercase tracking-wide mb-0.5">Notificação do Sistema</p>
                <h2 className="text-lg font-bold text-foreground leading-tight">
                  {cliente.nome}
                </h2>
              </div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {cliente.notificacaoMensagem}
              </p>
            </div>
            <Textarea
              placeholder="Responder a esta notificação (opcional)..."
              value={notifResposta}
              onChange={(e) => setNotifResposta(e.target.value)}
              rows={2}
            />
            <div className="flex gap-3">
              <button
                onClick={fecharPopup}
                className="flex-1 py-2.5 rounded-lg border border-border text-center text-sm font-semibold hover:bg-muted transition-colors"
              >
                Entendido
              </button>
              <button
                onClick={() => {
                  const texto = notifResposta.trim();
                  if (!texto) return;
                  responderMutation.mutate(texto, {
                    onSuccess: () => { setNotifResposta(""); setNotifPopupAberto(false); },
                  });
                }}
                disabled={!notifResposta.trim() || responderMutation.isPending}
                className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                Enviar resposta
              </button>
            </div>
          </div>
        </div>
      )}

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
          <AlertDialog open={deleteDialog} onOpenChange={(open) => { setDeleteDialog(open); if (!open) setMotivoExclusao(""); }}>
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
              <div className="space-y-2">
                <p className="text-sm font-medium">Motivo da exclusão <span className="text-red-500">*</span></p>
                <Textarea
                  placeholder="Explique por que este cliente está sendo removido..."
                  value={motivoExclusao}
                  onChange={(e) => setMotivoExclusao(e.target.value)}
                  rows={3}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  disabled={!motivoExclusao.trim() || deleteMutation.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    if (motivoExclusao.trim()) deleteMutation.mutate(motivoExclusao.trim());
                  }}
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
        numeroOrcamentoAtual={cliente.numeroOrcamento}
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
          orcamentoFinalNumero={cliente.orcamentoFinalNumero}
          orcamentoFinalValor={cliente.orcamentoFinalValor ? Number(cliente.orcamentoFinalValor) : null}
          orcamentoFinalEm={cliente.orcamentoFinalEm}
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

          {cliente.notificacaoResposta ? (
            <div className="mt-3 pt-3 border-t border-amber-500/20">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Resposta</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{cliente.notificacaoResposta}</p>
              {cliente.notificacaoRespondidaEm && (
                <p className="text-xs text-muted-foreground mt-1">
                  Respondida em {new Date(cliente.notificacaoRespondidaEm).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          ) : cliente.responsavelId === user?.id ? (
            <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-2">
              <Textarea
                placeholder="Responder a esta notificação..."
                value={cardResposta}
                onChange={(e) => setCardResposta(e.target.value)}
                rows={2}
              />
              <Button
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-white"
                disabled={!cardResposta.trim() || responderMutation.isPending}
                onClick={() => {
                  const texto = cardResposta.trim();
                  if (!texto) return;
                  responderMutation.mutate(texto, { onSuccess: () => setCardResposta("") });
                }}
              >
                Responder
              </Button>
            </div>
          ) : null}
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

      {/* Nova Venda — registra outra venda pro mesmo cliente */}
      <Dialog open={novaVendaDialog} onOpenChange={(o) => { if (!o) setNovaVendaDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-500">
              <ThumbsUp className="w-4 h-4" /> Nova Venda
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Número do Orçamento <span className="text-red-500">*</span></p>
              <input
                value={nvNumero}
                onChange={(e) => setNvNumero(e.target.value)}
                placeholder="Ex: 11241"
                className={`w-full h-9 rounded-md border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${!nvNumero ? "border-red-400" : "border-input"}`}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Valor (R$) <span className="text-red-500">*</span></p>
              <input
                type="text"
                inputMode="decimal"
                value={nvValor}
                onChange={(e) => setNvValor(e.target.value)}
                placeholder="Ex: 4.562,98"
                className={`w-full h-9 rounded-md border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${!nvValor || isNaN(parseBRL(nvValor)) ? "border-red-400" : "border-input"}`}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Data da Venda <span className="text-red-500">*</span></p>
              <input
                type="date"
                value={nvData}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setNvData(e.target.value)}
                className={`w-full h-9 rounded-md border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${!nvData ? "border-red-400" : "border-input"}`}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNovaVendaDialog(false)}>Voltar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!nvNumero || !nvValor || isNaN(parseBRL(nvValor)) || !nvData || novaVendaMutation.isPending}
              onClick={() => novaVendaMutation.mutate()}
            >
              {novaVendaMutation.isPending ? "Salvando..." : "Registrar venda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar Venda — corrige uma venda já registrada (não cria outra) */}
      <Dialog open={!!editVendaId} onOpenChange={(o) => { if (!o) setEditVendaId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Editar Venda
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Número do Orçamento <span className="text-red-500">*</span></p>
              <input
                value={evNumero}
                onChange={(e) => setEvNumero(e.target.value)}
                className={`w-full h-9 rounded-md border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${!evNumero ? "border-red-400" : "border-input"}`}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Valor (R$) <span className="text-red-500">*</span></p>
              <input
                type="text"
                inputMode="decimal"
                value={evValor}
                onChange={(e) => setEvValor(e.target.value)}
                className={`w-full h-9 rounded-md border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${!evValor || isNaN(parseBRL(evValor)) ? "border-red-400" : "border-input"}`}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Data da Venda <span className="text-red-500">*</span></p>
              <input
                type="date"
                value={evData}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setEvData(e.target.value)}
                className={`w-full h-9 rounded-md border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring ${!evData ? "border-red-400" : "border-input"}`}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditVendaId(null)}>Voltar</Button>
            <Button
              disabled={!evNumero || !evValor || isNaN(parseBRL(evValor)) || !evData || editarVendaMutation.isPending}
              onClick={() => editarVendaMutation.mutate()}
            >
              {editarVendaMutation.isPending ? "Salvando..." : "Salvar alterações"}
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
          <TabsTrigger value="vendas">
            <ThumbsUp className="w-4 h-4 mr-2" />
            Vendas ({(cliente.vendas || []).length})
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

        <TabsContent value="vendas" className="mt-4">
          <div className="space-y-2">
            <div className="flex justify-end">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setNovaVendaDialog(true)}>
                <ThumbsUp className="w-3.5 h-3.5 mr-2" />
                Nova Venda
              </Button>
            </div>
            {(cliente.vendas || []).length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma venda registrada</p>
            ) : (
              (cliente.vendas || []).map(v => (
                <Card key={v.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Orçamento {v.numeroOrcamento}</p>
                    <p className="text-xs text-muted-foreground">{new Date(v.data).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-emerald-600">{formatCurrency(v.valor)}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => abrirEdicaoVenda(v)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={removerVendaMutation.isPending}
                      onClick={() => removerVendaMutation.mutate(v.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
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
                    <p className="text-xs text-muted-foreground">{formatDataVencimento(t.dataVencimento)}</p>
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
