"use client";

import { useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Shield, ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime, formatCurrency } from "@/lib/utils/formatters";

interface AuditLog {
  id: string;
  entidade: string;
  entidadeId: string;
  acao: string;
  dadosAntigos: Record<string, unknown> | null;
  dadosNovos: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; nome: string } | null;
}

const ENTIDADE_LABEL: Record<string, string> = {
  FinanceiroCarroUso: "Uso de carro",
  FinanceiroCarro: "Carro",
  FinanceiroMotorista: "Motorista",
  FinanceiroLancamento: "Lançamento",
  FinanceiroConta: "Conta",
  FinanceiroCategoria: "Categoria",
};
const ACAO_LABEL: Record<string, { label: string; cor: "success" | "warning" | "destructive" }> = {
  CREATE: { label: "Criação", cor: "success" },
  UPDATE: { label: "Edição", cor: "warning" },
  DELETE: { label: "Exclusão", cor: "destructive" },
};
const CAMPO_LABEL: Record<string, string> = {
  carro: "Carro", motorista: "Motorista", kmSaida: "Km de saída", saidaEm: "Horário de saída",
  kmChegada: "Km de chegada", chegadaEm: "Horário de chegada", observacoes: "Observações",
  valorCombustivel: "Valor de gasolina", conta: "Conta", valor: "Valor", descricao: "Descrição",
};

function formatCampoValor(campo: string, valor: unknown): string {
  if (valor == null || valor === "") return "—";
  if (/Em$/.test(campo) && typeof valor === "string") {
    const d = new Date(valor);
    if (!isNaN(d.getTime())) return formatDateTime(valor);
  }
  if ((campo === "valor" || campo === "valorCombustivel") && typeof valor === "number") return formatCurrency(valor);
  if ((campo === "kmSaida" || campo === "kmChegada") && typeof valor === "number") return `${valor} km`;
  return String(valor);
}

function DetalhesLog({ log }: { log: AuditLog }) {
  const antigos = log.dadosAntigos ?? {};
  const novos = log.dadosNovos ?? {};
  const campos = Array.from(new Set([...Object.keys(antigos), ...Object.keys(novos)]));

  if (campos.length === 0) return <p className="text-xs text-muted-foreground">Sem detalhes registrados.</p>;

  return (
    <div className="space-y-1.5">
      {campos.map((campo) => {
        const temAntigo = campo in antigos;
        const temNovo = campo in novos;
        return (
          <div key={campo} className="flex items-center gap-2 text-xs">
            <span className="font-medium w-32 shrink-0">{CAMPO_LABEL[campo] ?? campo}</span>
            {temAntigo && temNovo ? (
              <span className="text-muted-foreground">
                {formatCampoValor(campo, antigos[campo])} <span className="mx-1">→</span>
                <span className="text-foreground font-medium">{formatCampoValor(campo, novos[campo])}</span>
              </span>
            ) : temNovo ? (
              <span className="text-foreground font-medium">{formatCampoValor(campo, novos[campo])}</span>
            ) : (
              <span className="text-muted-foreground line-through">{formatCampoValor(campo, antigos[campo])}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function FinanceiroAuditoriaPage() {
  const [page, setPage] = useState(1);
  const [entidade, setEntidade] = useState("");
  const [acao, setAcao] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["financeiro-auditoria", page, entidade, acao, de, ate],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (entidade) params.set("entidade", entidade);
      if (acao) params.set("acao", acao);
      if (de) params.set("de", de);
      if (ate) params.set("ate", ate);
      const { data } = await axios.get(`/api/financeiro/auditoria?${params}`);
      return data as { data: AuditLog[]; totalPages: number; total: number };
    },
  });

  const logs = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const filtrosAtivos = !!(entidade || acao || de || ate);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6" />
          Auditoria
        </h2>
        <p className="text-muted-foreground">Quem mexeu em quê no Financeiro — carros, caixa e contas.</p>
      </div>

      <Card className="p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5">
            <Label className="text-xs">O quê</Label>
            <Select value={entidade || "todas"} onValueChange={(v) => { setEntidade(v === "todas" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Tudo</SelectItem>
                {Object.entries(ENTIDADE_LABEL).map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ação</Label>
            <Select value={acao || "todas"} onValueChange={(v) => { setAcao(v === "todas" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="CREATE">Criação</SelectItem>
                <SelectItem value="UPDATE">Edição</SelectItem>
                <SelectItem value="DELETE">Exclusão</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <Input type="date" className="w-36" value={de} onChange={(e) => { setDe(e.target.value); setPage(1); }} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <Input type="date" className="w-36" value={ate} onChange={(e) => { setAte(e.target.value); setPage(1); }} />
          </div>
          {filtrosAtivos && (
            <Button variant="ghost" size="sm" onClick={() => { setEntidade(""); setAcao(""); setDe(""); setAte(""); setPage(1); }}>
              Limpar filtros
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-8 p-3"></th>
                <th className="text-left p-3 font-medium">Usuário</th>
                <th className="text-left p-3 font-medium">O quê</th>
                <th className="text-left p-3 font-medium">Ação</th>
                <th className="text-left p-3 font-medium">Data/Hora</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b">
                    {[...Array(5)].map((_, j) => <td key={j} className="p-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-muted-foreground">
                    <Shield className="w-8 h-8 mx-auto mb-3 opacity-40" />
                    <p>{filtrosAtivos ? "Nenhum registro para esses filtros" : "Nenhuma alteração registrada ainda"}</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const aberto = expandido === log.id;
                  return (
                    <Fragment key={log.id}>
                      <tr
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                        onClick={() => setExpandido(aberto ? null : log.id)}
                      >
                        <td className="p-3 text-muted-foreground">
                          {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="p-3 font-medium">{log.user?.nome ?? "—"}</td>
                        <td className="p-3">{ENTIDADE_LABEL[log.entidade] ?? log.entidade}</td>
                        <td className="p-3">
                          <Badge variant={ACAO_LABEL[log.acao]?.cor ?? "default"}>{ACAO_LABEL[log.acao]?.label ?? log.acao}</Badge>
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                      </tr>
                      {aberto && (
                        <tr className="border-b last:border-0 bg-muted/20">
                          <td></td>
                          <td colSpan={4} className="p-3 pt-1">
                            <DetalhesLog log={log} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t">
            <p className="text-xs text-muted-foreground">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
