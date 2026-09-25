"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import type { EstagioLead } from "@/types";

// Sequência do funil (fora as etapas terminais Confirmado/Cancelado, que têm
// ações próprias) — usada tanto pelo tracker visual do cliente quanto pelo
// atalho "Próximo passo" na listagem.
export const ETAPAS_PIPELINE: { estagio: EstagioLead; label: string }[] = [
  { estagio: "NOVO_LEAD", label: "Entrar em Contato" },
  { estagio: "CONTATO_INICIAL", label: "Contato Feito" },
  { estagio: "PRIMEIRO_ORCAMENTO", label: "Primeiro Orçamento" },
  { estagio: "QUALIFICACAO", label: "Visita / Medição" },
  { estagio: "PROPOSTA_ENVIADA", label: "Orçamento Final" },
  { estagio: "NEGOCIACAO", label: "Em Negociação" },
];

const MOTIVOS_CANCELAMENTO = ["Prazo", "Preço", "Distância", "Não Realizamos", "Cliente não responde", "Outros"];

// Interpreta valores em formato brasileiro (4.562,98) ou americano (4562.98)
function parseBRL(raw: string): number {
  const s = raw.trim();
  if (!s) return 0;
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) return parseFloat(s.replace(/\./g, "").replace(",", "."));
  if (hasComma) return parseFloat(s.replace(",", "."));
  return parseFloat(s);
}

/** Próxima etapa do funil depois de `estagio`, ou null se já fechado (Confirmado/Cancelado) ou no fim do funil. */
export function proximaEtapaPipeline(estagio: EstagioLead): { estagio: EstagioLead; label: string } | null {
  if (estagio === "FECHADO_GANHO" || estagio === "FECHADO_PERDIDO") return null;
  const idx = ETAPAS_PIPELINE.findIndex((e) => e.estagio === estagio);
  return ETAPAS_PIPELINE[idx + 1] ?? null;
}

export interface PipelineCtx {
  leadId: string | null;
  clienteId: string;
  clienteNome: string;
  estagioAtual: EstagioLead;
  numeroOrcamentoAtual?: string | null;
}

/**
 * Estado + mutação + diálogos por trás das ações do funil (avançar etapa,
 * confirmar venda, cancelar). Compartilhado entre o tracker do cliente e o
 * atalho de "..." da listagem — o alvo (`ctx`) é passado explicitamente em
 * cada chamada (não fica em closure) pra funcionar com uma única instância
 * do hook agindo sobre várias linhas da tabela sem risco de pegar o cliente
 * errado por causa de state assíncrono do React.
 */
export function usePipelineActions({ onUpdate }: { onUpdate: () => void }) {
  const hoje = new Date().toISOString().slice(0, 10);

  const [ctx, setCtx] = useState<PipelineCtx | null>(null);

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

  const mutation = useMutation({
    mutationFn: async ({
      ctx, novoEstagio, motivoPerda, dataFechamento, proximoContato, clientePatch, venda,
    }: {
      ctx: PipelineCtx;
      novoEstagio: EstagioLead;
      motivoPerda?: string;
      dataFechamento?: string;
      proximoContato?: string;
      clientePatch?: Record<string, unknown>;
      venda?: { numeroOrcamento: string; valor: number; data: string };
    }) => {
      // Captura ANTES de mover o lead: se o cliente já estava Confirmado e o
      // vendedor aciona "Confirmado" de novo pra registrar outra venda, o lead
      // já tem uma Venda vinculada (Venda.leadId é único) — nesse caso a nova
      // venda entra sem leadId, como uma venda adicional, em vez de colidir
      // com a constraint e falhar silenciosamente.
      const jaEstavaFechado = ctx.estagioAtual === "FECHADO_GANHO";

      let resolvedLeadId = ctx.leadId;
      if (ctx.leadId) {
        await axios.patch(`/api/leads/${ctx.leadId}/mover`, { estagio: novoEstagio, motivoPerda, dataFechamento, proximoContato });
      } else {
        const res = await axios.post("/api/leads", { titulo: ctx.clienteNome, estagio: novoEstagio, origem: "OUTROS", clienteId: ctx.clienteId });
        resolvedLeadId = res.data?.data?.id ?? null;
      }

      const statusMap: Partial<Record<EstagioLead, string>> = {
        FECHADO_GANHO: "APROVADO",
        FECHADO_PERDIDO: "NAO_APROVADO",
      };
      const novoStatus = statusMap[novoEstagio] ?? "PENDENTE";
      await axios.patch(`/api/clientes/${ctx.clienteId}`, { statusOrcamento: novoStatus, ...clientePatch });

      if (venda) {
        await axios.post(`/api/clientes/${ctx.clienteId}/vendas`, { ...venda, leadId: jaEstavaFechado ? null : resolvedLeadId });
      }
    },
    onSuccess: () => { toast.success("Etapa atualizada!"); onUpdate(); },
    onError: () => toast.error("Erro ao atualizar etapa"),
  });

  function abrirEtapa(alvo: PipelineCtx, etapa: EstagioLead) {
    if (etapa === "PRIMEIRO_ORCAMENTO" || etapa === "PROPOSTA_ENVIADA") {
      setCtx(alvo);
      setOrcTargetEstagio(etapa);
      setOrcData(hoje);
      setOrcNumero("");
      setOrcValor("");
      setOrcDialog(true);
    } else {
      mutation.mutate({ ctx: alvo, novoEstagio: etapa });
    }
  }

  function abrirConfirmar(alvo: PipelineCtx) {
    setCtx(alvo);
    setConfNumero(alvo.numeroOrcamentoAtual || "");
    setConfValor("");
    setConfData(hoje);
    setConfDialog(true);
  }

  function abrirCancelar(alvo: PipelineCtx) {
    setCtx(alvo);
    setDataCancelamento(hoje);
    setCancelDialog(true);
  }

  function confirmarCancelamento() {
    if (!ctx) return;
    if (!dataCancelamento) { toast.error("Informe a data do cancelamento"); return; }
    if (!motivoCategoria) { toast.error("Selecione o motivo do cancelamento"); return; }
    if (reengajar && !proximoContato) { toast.error("Informe a data do próximo contato"); return; }
    const motivoPerda = motivoCancelamento.trim()
      ? `${motivoCategoria} — ${motivoCancelamento.trim()}`
      : motivoCategoria;
    mutation.mutate({
      ctx,
      novoEstagio: "FECHADO_PERDIDO",
      motivoPerda,
      dataFechamento: dataCancelamento,
      proximoContato: reengajar ? proximoContato : undefined,
    });
    setCancelDialog(false);
    setMotivoCategoria("");
    setMotivoCancelamento("");
    setReengajar(false);
    setProximoContato("");
  }

  const dialogs = (
    <>
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
              <p className="text-sm font-medium">
                Observação <span className="text-muted-foreground font-normal">(opcional)</span>
              </p>
              <Textarea
                placeholder="Descreva o motivo do cancelamento..."
                value={motivoCancelamento}
                onChange={(e) => setMotivoCancelamento(e.target.value)}
                rows={3}
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
              disabled={!dataCancelamento || !motivoCategoria || (reengajar && !proximoContato) || mutation.isPending}
              onClick={confirmarCancelamento}
            >
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Primeiro Orçamento / Orçamento Final */}
      <Dialog open={orcDialog} onOpenChange={(o) => { if (!o) setOrcDialog(false); }}>
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
              disabled={!ctx || !orcNumero || !orcValor || isNaN(parseBRL(orcValor)) || !orcData || mutation.isPending}
              onClick={async () => {
                if (!ctx) return;
                const valor = parseBRL(orcValor);
                if (orcTargetEstagio === "PROPOSTA_ENVIADA") {
                  // Orçamento Final → campos separados, não sobrescreve o Primeiro Orçamento
                  await axios.patch(`/api/clientes/${ctx.clienteId}`, {
                    orcamentoFinalNumero: orcNumero,
                    orcamentoFinalValor: valor,
                    orcamentoFinalEm: orcData,
                  });
                } else {
                  // Primeiro Orçamento → campos originais
                  await axios.patch(`/api/clientes/${ctx.clienteId}`, {
                    numeroOrcamento: orcNumero,
                    valorOrcamento: valor,
                    orcamentoEnviadoEm: orcData,
                  });
                }
                mutation.mutate({ ctx, novoEstagio: orcTargetEstagio });
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
            {ctx?.estagioAtual === "FECHADO_GANHO" && (
              <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                Isso registra uma <strong>nova venda</strong> pra esse cliente. Pra corrigir número/valor/data de uma venda que já existe, use o ✏️ na aba &quot;Vendas&quot;.
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
              disabled={!ctx || !confNumero || !confValor || isNaN(parseBRL(confValor)) || !confData || mutation.isPending}
              onClick={() => {
                if (!ctx) return;
                mutation.mutate({
                  ctx,
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

  return { abrirEtapa, abrirConfirmar, abrirCancelar, isPending: mutation.isPending, dialogs };
}
