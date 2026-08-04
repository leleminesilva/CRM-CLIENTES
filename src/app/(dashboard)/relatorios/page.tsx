"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { TrendingUp, Users, DollarSign, Download, Receipt, XCircle, ExternalLink, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, ReferenceLine,
} from "recharts";
import { formatCurrency, ROLE_LABELS, ORIGEM_LABELS, ESTAGIO_LABELS } from "@/lib/utils/formatters";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#f97316", "#14b8a6"];

const STATUS_LABELS: Record<string, string> = { PENDENTE: "Pendente", APROVADO: "Aprovado", NAO_APROVADO: "Não Aprovado" };
const STATUS_COLORS: Record<string, string> = { PENDENTE: "text-amber-500", APROVADO: "text-emerald-600", NAO_APROVADO: "text-red-500" };

function KPICard({ title, value, sub, color = "text-foreground" }: { title: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}

export default function RelatoriosPage() {
  const [de, setDe] = useState(new Date(new Date().setDate(1)).toISOString().split("T")[0]);
  const [ate, setAte] = useState(new Date().toISOString().split("T")[0]);

  const { data: comercial, isLoading: loadingComercial } = useQuery({
    queryKey: ["relatorio-comercial", de, ate],
    queryFn: async () => {
      const { data } = await axios.get(`/api/relatorios/comercial?de=${de}&ate=${ate}`);
      return data.data;
    },
  });

  const { data: equipe, isLoading: loadingEquipe } = useQuery({
    queryKey: ["relatorio-equipe", de, ate],
    queryFn: async () => {
      const { data } = await axios.get(`/api/relatorios/equipe?de=${de}&ate=${ate}`);
      return data.data;
    },
  });

  const { data: financeiro, isLoading: loadingFinanceiro } = useQuery({
    queryKey: ["relatorio-financeiro", de, ate],
    queryFn: async () => {
      const { data } = await axios.get(`/api/relatorios/financeiro?de=${de}&ate=${ate}`);
      return data.data;
    },
  });

  const { data: cancelados, isLoading: loadingCancelados } = useQuery({
    queryKey: ["relatorio-cancelados", de, ate],
    queryFn: async () => {
      const { data } = await axios.get(`/api/relatorios/cancelados?de=${de}&ate=${ate}`);
      return data.data;
    },
  });

  const { data: deletados, isLoading: loadingDeletados } = useQuery({
    queryKey: ["relatorio-clientes-deletados", de, ate],
    queryFn: async () => {
      const { data } = await axios.get(`/api/relatorios/clientes-deletados?de=${de}&ate=${ate}`);
      return data.data;
    },
  });

  const TEMP_LABELS: Record<string, string> = { QUENTE: "🔥 Quente", MORNO: "🌡️ Morno", FRIO: "❄️ Frio" };

  function exportarCSV(tipo: string) {
    if (tipo === "cancelados" && cancelados) {
      const header = "Cliente,Responsável,Serviço,Temperatura,Data,Motivo,Valor";
      const rows = (cancelados.lista as Array<Record<string, unknown>>).map((r) =>
        `"${r.clienteNome}","${r.responsavel}","${r.servico}","${TEMP_LABELS[String(r.temperatura)] || String(r.temperatura)}","${r.dataFechamento ? new Date(String(r.dataFechamento)).toLocaleDateString("pt-BR") : ""}","${r.motivoPerda || ""}",${r.valor}`
      );
      baixarCSV([header, ...rows].join("\n"), `relatorio-cancelados-${de}`);
    } else if (tipo === "deletados" && deletados) {
      const header = "Cliente,Responsável,Excluído por,Serviço,Temperatura,Data Exclusão,Motivo,Valor";
      const rows = (deletados.lista as Array<Record<string, unknown>>).map((r) =>
        `"${r.nome}","${r.responsavel}","${r.excluidoPor}","${r.servico}","${TEMP_LABELS[String(r.temperatura)] || String(r.temperatura)}","${r.deletedAt ? new Date(String(r.deletedAt)).toLocaleDateString("pt-BR") : ""}","${r.motivoExclusao || ""}",${r.valor}`
      );
      baixarCSV([header, ...rows].join("\n"), `relatorio-clientes-deletados-${de}`);
    } else if (tipo === "equipe" && equipe) {
      const header = "Vendedor,Cargo,Leads Gerados,Vendas Fechadas,Tarefas Concluídas,Receita,Ticket Médio";
      const rows = equipe.map((r: Record<string, unknown>) =>
        `${r.nome},${ROLE_LABELS[String(r.role)] || r.role},${r.leadsGerados},${r.vendasFechadas},${r.tarefasConcluidas},${r.receitaGerada},${r.ticketMedio}`
      );
      baixarCSV([header, ...rows].join("\n"), `relatorio-equipe-${de}`);
    } else if (tipo === "comercial" && comercial) {
      const rows = [
        `Leads Gerados,${comercial.leadsGerados}`,
        `Leads Convertidos,${comercial.leadsConvertidos}`,
        `Taxa de Conversão,${comercial.taxaConversaoLeads}%`,
        `Vendas Fechadas,${comercial.vendasFechadas}`,
        `Receita Fechada,${comercial.receitaFechada}`,
        `Ticket Médio,${comercial.ticketMedio}`,
        `Em Aberto,${comercial.leadsAtivos}`,
        `Perdidos,${comercial.leadsPerdidos}`,
      ];
      baixarCSV(["Métrica,Valor", ...rows].join("\n"), `relatorio-comercial-${de}`);
    } else if (tipo === "financeiro" && financeiro) {
      const rows = [
        `Receita Fechada,${financeiro.receitaFechada}`,
        `Receita em Negociação,${financeiro.receitaPrevista}`,
        `Total de Vendas,${financeiro.totalVendas}`,
        `Ticket Médio,${financeiro.ticketMedio}`,
      ];
      baixarCSV(["Métrica,Valor", ...rows].join("\n"), `relatorio-financeiro-${de}`);
    }
  }

  function baixarCSV(csv: string, nome: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nome}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const leadsPorEstagio: Array<{ estagio: string; total: number }> = comercial?.leadsPorEstagio || [];
  const leadsPorOrigem: Array<{ origem: string; total: number }> = comercial?.leadsPorOrigem || [];
  const receitaPorMes: Array<{ mes: string; total: number; receita: number }> = financeiro?.receitaPorMes || [];
  const funnelFin: Array<{ estagio: string; total: number; valor: number }> = financeiro?.funil || [];
  const topClientes: Array<{ id: string; nome: string; valor: number; status: string; responsavel: string }> = financeiro?.topClientes || [];
  const canceladosLista: Array<{ id: string; clienteId?: string; clienteNome: string; responsavel: string; servico: string; temperatura: string; dataFechamento: string; motivoPerda?: string; valor: number }> = cancelados?.lista || [];
  const canceladosPorMotivo: Array<{ motivo: string; total: number }> = cancelados?.porMotivo || [];
  const canceladosPorResponsavel: Array<{ nome: string; total: number; valor: number }> = cancelados?.porResponsavel || [];
  const deletadosLista: Array<{ id: string; nome: string; responsavel: string; excluidoPor: string; servico: string; temperatura: string; deletedAt: string; motivoExclusao?: string; valor: number }> = deletados?.lista || [];

  const funnelOrdem = ["NOVO_LEAD", "CONTATO_INICIAL", "QUALIFICACAO", "PROPOSTA_ENVIADA", "NEGOCIACAO", "FECHADO_GANHO"];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Relatórios</h2>
          <p className="text-muted-foreground">Análise de performance comercial</p>
        </div>
      </div>

      {/* Filtro de período */}
      <Card className="p-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-1.5">
            <Label>Data inicial</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label>Data final</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-40" />
          </div>
          <p className="text-xs text-muted-foreground pb-1">Período aplicado a todos os relatórios</p>
        </div>
      </Card>

      <Tabs defaultValue="comercial">
        <TabsList>
          <TabsTrigger value="comercial">
            <TrendingUp className="w-4 h-4 mr-2" />Comercial
          </TabsTrigger>
          <TabsTrigger value="equipe">
            <Users className="w-4 h-4 mr-2" />Equipe
          </TabsTrigger>
          <TabsTrigger value="financeiro">
            <DollarSign className="w-4 h-4 mr-2" />Financeiro
          </TabsTrigger>
          <TabsTrigger value="cancelados">
            <XCircle className="w-4 h-4 mr-2" />Cancelados
          </TabsTrigger>
          <TabsTrigger value="deletados">
            <Trash2 className="w-4 h-4 mr-2" />Clientes Deletados
          </TabsTrigger>
        </TabsList>

        {/* ── COMERCIAL ── */}
        <TabsContent value="comercial" className="space-y-6 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportarCSV("comercial")}>
              <Download className="w-4 h-4 mr-2" />Exportar CSV
            </Button>
          </div>

          {loadingComercial ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title="Leads Gerados" value={comercial?.leadsGerados ?? 0} />
                <KPICard title="Leads Convertidos" value={comercial?.leadsConvertidos ?? 0} color="text-emerald-600" />
                <KPICard title="Taxa de Conversão" value={`${comercial?.taxaConversaoLeads ?? 0}%`} color="text-indigo-600" />
                <KPICard title="Vendas Fechadas" value={comercial?.vendasFechadas ?? 0} color="text-emerald-600" />
                <KPICard title="Receita Fechada" value={formatCurrency(comercial?.receitaFechada ?? 0)} color="text-emerald-600" />
                <KPICard title="Ticket Médio" value={formatCurrency(comercial?.ticketMedio ?? 0)} />
                <KPICard title="Leads em Aberto" value={comercial?.leadsAtivos ?? 0} color="text-amber-500" sub="Estado atual" />
                <KPICard title="Leads Perdidos" value={comercial?.leadsPerdidos ?? 0} color="text-red-500" />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Leads por estágio */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Leads por Estágio (atual)</CardTitle></CardHeader>
                  <CardContent>
                    {leadsPorEstagio.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={funnelOrdem
                            .map((e) => leadsPorEstagio.find((l) => l.estagio === e))
                            .filter(Boolean)
                            .map((l) => ({ ...l, label: ESTAGIO_LABELS[l!.estagio] || l!.estagio }))}
                          layout="vertical"
                          margin={{ left: 0, right: 16 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis dataKey="label" type="category" width={110} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number) => [v, "Leads"]} />
                          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                            {funnelOrdem.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Sem dados</div>
                    )}
                  </CardContent>
                </Card>

                {/* Leads por origem */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Leads por Origem (período)</CardTitle></CardHeader>
                  <CardContent>
                    {leadsPorOrigem.length > 0 ? (
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <ResponsiveContainer width="100%" height={180} className="max-w-[180px] shrink-0">
                          <PieChart>
                            <Pie data={leadsPorOrigem} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                              dataKey="total" nameKey="origem" paddingAngle={3}>
                              {leadsPorOrigem.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v: number, n: string) => [v, ORIGEM_LABELS[n] || n]} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex-1 space-y-2 w-full">
                          {leadsPorOrigem.map((l: { origem: string; total: number }, i: number) => {
                            const total = leadsPorOrigem.reduce((acc: number, x: { total: number }) => acc + x.total, 0);
                            return (
                              <div key={l.origem} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                  <span className="truncate">{ORIGEM_LABELS[l.origem] || l.origem}</span>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  <span className="font-medium">{l.total}</span>
                                  <span className="text-muted-foreground text-xs">{total > 0 ? Math.round((l.total / total) * 100) : 0}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                        Sem leads no período
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── EQUIPE ── */}
        <TabsContent value="equipe" className="space-y-6 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportarCSV("equipe")}>
              <Download className="w-4 h-4 mr-2" />Exportar CSV
            </Button>
          </div>

          {loadingEquipe ? (
            <div className="h-64 bg-muted animate-pulse rounded-xl" />
          ) : equipe && equipe.length > 0 ? (
            <>
              {/* Gráfico comparativo */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Leads vs Vendas por Vendedor</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={equipe} margin={{ left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v: number, name: string) => [
                          name === "receitaGerada" ? formatCurrency(v) : v,
                          name === "receitaGerada" ? "Receita" : name === "vendasFechadas" ? "Vendas" : "Leads",
                        ]}
                      />
                      <Legend formatter={(v) => v === "receitaGerada" ? "Receita" : v === "vendasFechadas" ? "Vendas" : "Leads"} />
                      <Bar dataKey="leadsGerados" fill="#6366f1" name="leadsGerados" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="vendasFechadas" fill="#10b981" name="vendasFechadas" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Tabela detalhada */}
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Vendedor</th>
                        <th className="text-center p-3 font-medium">Cargo</th>
                        <th className="text-center p-3 font-medium">Leads</th>
                        <th className="text-center p-3 font-medium">Em Aberto</th>
                        <th className="text-center p-3 font-medium">Vendas</th>
                        <th className="text-center p-3 font-medium">Tarefas</th>
                        <th className="text-center p-3 font-medium">Ticket Médio</th>
                        <th className="text-right p-3 font-medium">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipe.map((v: Record<string, unknown>) => (
                        <tr key={String(v.id)} className="border-b hover:bg-muted/30">
                          <td className="p-3 font-medium">{String(v.nome)}</td>
                          <td className="p-3 text-center text-xs text-muted-foreground">
                            {ROLE_LABELS[String(v.role)] || String(v.role)}
                          </td>
                          <td className="p-3 text-center">{String(v.leadsGerados)}</td>
                          <td className="p-3 text-center text-amber-500">{String(v.leadsAtivos)}</td>
                          <td className="p-3 text-center text-emerald-600 font-medium">{String(v.vendasFechadas)}</td>
                          <td className="p-3 text-center">{String(v.tarefasConcluidas)}</td>
                          <td className="p-3 text-center">{formatCurrency(Number(v.ticketMedio))}</td>
                          <td className="p-3 text-right font-semibold text-emerald-600">
                            {formatCurrency(Number(v.receitaGerada))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30">
                        <td className="p-3 font-semibold" colSpan={2}>Total</td>
                        <td className="p-3 text-center font-semibold">
                          {equipe.reduce((s: number, v: Record<string, unknown>) => s + Number(v.leadsGerados), 0)}
                        </td>
                        <td className="p-3 text-center font-semibold text-amber-500">
                          {equipe.reduce((s: number, v: Record<string, unknown>) => s + Number(v.leadsAtivos), 0)}
                        </td>
                        <td className="p-3 text-center font-semibold text-emerald-600">
                          {equipe.reduce((s: number, v: Record<string, unknown>) => s + Number(v.vendasFechadas), 0)}
                        </td>
                        <td className="p-3 text-center font-semibold">
                          {equipe.reduce((s: number, v: Record<string, unknown>) => s + Number(v.tarefasConcluidas), 0)}
                        </td>
                        <td className="p-3" />
                        <td className="p-3 text-right font-semibold text-emerald-600">
                          {formatCurrency(equipe.reduce((s: number, v: Record<string, unknown>) => s + Number(v.receitaGerada), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p>Nenhum dado de equipe encontrado</p>
            </div>
          )}
        </TabsContent>

        {/* ── FINANCEIRO ── */}
        <TabsContent value="financeiro" className="space-y-6 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportarCSV("financeiro")}>
              <Download className="w-4 h-4 mr-2" />Exportar CSV
            </Button>
          </div>

          {loadingFinanceiro ? (
            <div className="h-48 bg-muted animate-pulse rounded-xl" />
          ) : (
            <>
              {/* KPIs financeiros */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 col-span-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Receipt className="w-4 h-4 text-emerald-500" />
                    <p className="text-sm text-muted-foreground">Receita Fechada no Período</p>
                  </div>
                  <p className="text-3xl font-bold text-emerald-600">{formatCurrency(financeiro?.receitaFechada ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{financeiro?.totalVendas ?? 0} vendas concluídas</p>
                </Card>
                <Card className="p-4 col-span-2">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-indigo-500" />
                    <p className="text-sm text-muted-foreground">Em Negociação (Pipeline Atual)</p>
                  </div>
                  <p className="text-3xl font-bold text-indigo-600">{formatCurrency(financeiro?.receitaPrevista ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Orçamentos pendentes de aprovação</p>
                </Card>
                <KPICard title="Ticket Médio" value={formatCurrency(financeiro?.ticketMedio ?? 0)} />
                <KPICard title="Total de Vendas" value={financeiro?.totalVendas ?? 0} color="text-emerald-600" />
              </div>

              {/* Receita por mês */}
              {receitaPorMes.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Receita por Mês</CardTitle>
                      <span className="text-xs text-amber-500 font-medium">Meta: {formatCurrency(100000)}/mês</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const META = 100000;
                      const acumulado: Array<{ mes: string; receita: number; acumulado: number; total: number }> = [];
                      receitaPorMes.forEach((item, i) => {
                        const prev = i > 0 ? acumulado[i - 1].acumulado : 0;
                        acumulado.push({ ...item, acumulado: prev + item.receita });
                      });
                      const maxVal = Math.max(META, ...acumulado.map((d) => d.acumulado)) * 1.1;
                      return (
                        <ResponsiveContainer width="100%" height={240}>
                          <LineChart data={acumulado} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.6} />
                            <XAxis
                              dataKey="mes"
                              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                              axisLine={false}
                              tickLine={false}
                              domain={[0, maxVal]}
                              width={36}
                            />
                            <Tooltip
                              formatter={(v: number, name: string) => [
                                formatCurrency(v),
                                name === "acumulado" ? "Acumulado" : "No mês",
                              ]}
                              labelFormatter={(l) => `Mês ${l}`}
                              contentStyle={{
                                borderRadius: "8px",
                                border: "1px solid hsl(var(--border))",
                                backgroundColor: "hsl(var(--card))",
                                color: "hsl(var(--card-foreground))",
                              }}
                            />
                            <ReferenceLine
                              y={META}
                              stroke="#f59e0b"
                              strokeDasharray="5 3"
                              strokeWidth={1.5}
                              label={{ value: "Meta 100k", position: "insideTopRight", fontSize: 11, fill: "#f59e0b" }}
                            />
                            <Line
                              type="monotone"
                              dataKey="acumulado"
                              stroke="#6366f1"
                              strokeWidth={3}
                              dot={{ fill: "#6366f1", r: 5, strokeWidth: 2, stroke: "#fff" }}
                              activeDot={{ r: 7, stroke: "#6366f1", strokeWidth: 2, fill: "#fff" }}
                              name="acumulado"
                            />
                            <Line
                              type="monotone"
                              dataKey="receita"
                              stroke="#10b981"
                              strokeWidth={2}
                              strokeDasharray="4 2"
                              dot={{ fill: "#10b981", r: 4, strokeWidth: 2, stroke: "#fff" }}
                              activeDot={{ r: 6, stroke: "#10b981", strokeWidth: 2, fill: "#fff" }}
                              name="receita"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* Funil com valores */}
              {funnelFin.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Valor no Pipeline por Estágio</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {funnelOrdem
                      .map((e) => funnelFin.find((f) => f.estagio === e))
                      .filter(Boolean)
                      .map((f, i) => {
                        if (!f) return null;
                        const max = Math.max(...funnelFin.map((x) => x.valor));
                        const pct = max > 0 ? (f.valor / max) * 100 : 0;
                        return (
                          <div key={f.estagio} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{ESTAGIO_LABELS[f.estagio] || f.estagio}</span>
                              <span className="text-muted-foreground">{f.total} leads · {formatCurrency(f.valor)}</span>
                            </div>
                            <div className="h-7 bg-muted rounded-lg overflow-hidden">
                              <div
                                className="h-full rounded-lg flex items-center pl-3 text-white text-xs font-medium transition-all"
                                style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: COLORS[i % COLORS.length], minWidth: 40 }}
                              >
                                {pct > 20 && formatCurrency(f.valor)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>
              )}

              {/* Top clientes */}
              {topClientes.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Top Clientes por Valor de Orçamento</CardTitle></CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium">#</th>
                          <th className="text-left p-3 font-medium">Cliente</th>
                          <th className="text-left p-3 font-medium">Responsável</th>
                          <th className="text-center p-3 font-medium">Status</th>
                          <th className="text-right p-3 font-medium">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topClientes.map((c, i) => (
                          <tr key={c.id} className="border-b hover:bg-muted/30">
                            <td className="p-3 text-muted-foreground">{i + 1}</td>
                            <td className="p-3 font-medium">{c.nome}</td>
                            <td className="p-3 text-muted-foreground">{c.responsavel}</td>
                            <td className="p-3 text-center">
                              <span className={`text-xs font-medium ${STATUS_COLORS[c.status] || ""}`}>
                                {STATUS_LABELS[c.status] || c.status}
                              </span>
                            </td>
                            <td className="p-3 text-right font-semibold">{formatCurrency(c.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}
        </TabsContent>
        {/* ── CANCELADOS ── */}
        <TabsContent value="cancelados" className="space-y-6 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportarCSV("cancelados")}>
              <Download className="w-4 h-4 mr-2" />Exportar CSV
            </Button>
          </div>

          {loadingCancelados ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KPICard
                  title="Total Cancelados"
                  value={cancelados?.total ?? 0}
                  color="text-red-500"
                  sub="no período selecionado"
                />
                <KPICard
                  title="Valor Total Perdido"
                  value={formatCurrency(cancelados?.valorPerdido ?? 0)}
                  color="text-red-500"
                  sub="soma dos orçamentos cancelados"
                />
                <KPICard
                  title="Ticket Médio Perdido"
                  value={formatCurrency(cancelados?.ticketMedio ?? 0)}
                  sub="por cancelamento"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico por motivo */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Cancelamentos por Motivo</CardTitle></CardHeader>
                  <CardContent>
                    {canceladosPorMotivo.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={canceladosPorMotivo} layout="vertical" margin={{ left: 0, right: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                          <YAxis dataKey="motivo" type="category" width={130} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number) => [v, "Cancelamentos"]} />
                          <Bar dataKey="total" fill="#ef4444" radius={[0, 4, 4, 0]}>
                            {canceladosPorMotivo.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                        Nenhum cancelamento no período
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Por responsável */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Cancelamentos por Responsável</CardTitle></CardHeader>
                  <CardContent>
                    {canceladosPorResponsavel.length > 0 ? (
                      <div className="space-y-3">
                        {canceladosPorResponsavel.map((r, i) => {
                          const max = Math.max(...canceladosPorResponsavel.map((x) => x.total));
                          const pct = max > 0 ? (r.total / max) * 100 : 0;
                          return (
                            <div key={r.nome} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="font-medium">{r.nome}</span>
                                <span className="text-muted-foreground text-xs">
                                  {r.total} cancel. · {formatCurrency(r.valor)}
                                </span>
                              </div>
                              <div className="h-6 bg-muted rounded-lg overflow-hidden">
                                <div
                                  className="h-full rounded-lg transition-all"
                                  style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                        Nenhum cancelamento no período
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Tabela detalhada */}
              {canceladosLista.length > 0 ? (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Lista de Cancelamentos</CardTitle></CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium">Cliente</th>
                          <th className="text-left p-3 font-medium">Responsável</th>
                          <th className="text-left p-3 font-medium">Serviço</th>
                          <th className="text-left p-3 font-medium">Temp.</th>
                          <th className="text-left p-3 font-medium">Data</th>
                          <th className="text-left p-3 font-medium">Motivo</th>
                          <th className="text-right p-3 font-medium">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {canceladosLista.map((c) => {
                          const [categoria, detalhe] = (c.motivoPerda || "").split(" — ");
                          return (
                            <tr key={c.id} className="border-b hover:bg-muted/30">
                              <td className="p-3 font-medium">
                                {c.clienteId ? (
                                  <Link href={`/clientes/${c.clienteId}`} className="hover:text-indigo-400 flex items-center gap-1">
                                    {c.clienteNome}
                                    <ExternalLink className="w-3 h-3 opacity-50" />
                                  </Link>
                                ) : c.clienteNome}
                              </td>
                              <td className="p-3 text-muted-foreground">{c.responsavel}</td>
                              <td className="p-3 max-w-[160px]">
                                <div className="flex flex-wrap gap-1">
                                  {c.servico !== "—"
                                    ? c.servico.split(",").map((s) => s.trim()).filter(Boolean).map((s) => (
                                        <span key={s} className="inline-flex px-1.5 py-0.5 rounded text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{s}</span>
                                      ))
                                    : <span className="text-muted-foreground">—</span>}
                                </div>
                              </td>
                              <td className="p-3 text-sm">{TEMP_LABELS[c.temperatura] ?? "—"}</td>
                              <td className="p-3 text-muted-foreground whitespace-nowrap">
                                {c.dataFechamento ? new Date(c.dataFechamento).toLocaleDateString("pt-BR") : "—"}
                              </td>
                              <td className="p-3 max-w-[200px]">
                                {c.motivoPerda ? (
                                  <div>
                                    <span className="font-medium text-red-400">{categoria}</span>
                                    {detalhe && <p className="text-xs text-muted-foreground mt-0.5">{detalhe}</p>}
                                  </div>
                                ) : <span className="text-muted-foreground text-xs">Não informado</span>}
                              </td>
                              <td className="p-3 text-right font-semibold">
                                {c.valor > 0 ? formatCurrency(c.valor) : <span className="text-muted-foreground">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-muted/30">
                          <td className="p-3 font-semibold" colSpan={6}>Total</td>
                          <td className="p-3 text-right font-semibold text-red-500">
                            {formatCurrency(canceladosLista.reduce((s, c) => s + c.valor, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              ) : (
                <Card className="p-12 text-center text-muted-foreground">
                  <XCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  <p>Nenhum cancelamento encontrado no período</p>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ── CLIENTES DELETADOS ── */}
        <TabsContent value="deletados" className="space-y-6 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportarCSV("deletados")}>
              <Download className="w-4 h-4 mr-2" />Exportar CSV
            </Button>
          </div>

          {loadingDeletados ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KPICard
                  title="Total Deletados"
                  value={deletados?.total ?? 0}
                  color="text-red-500"
                  sub="no período selecionado"
                />
                <KPICard
                  title="Valor Total Perdido"
                  value={formatCurrency(deletados?.valorPerdido ?? 0)}
                  color="text-red-500"
                  sub="soma dos orçamentos dos clientes deletados"
                />
                <KPICard
                  title="Ticket Médio Perdido"
                  value={formatCurrency(deletados?.ticketMedio ?? 0)}
                  sub="por exclusão"
                />
              </div>

              {/* Tabela detalhada */}
              {deletadosLista.length > 0 ? (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Lista de Clientes Deletados</CardTitle></CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium">Cliente</th>
                          <th className="text-left p-3 font-medium">Responsável</th>
                          <th className="text-left p-3 font-medium">Excluído por</th>
                          <th className="text-left p-3 font-medium">Serviço</th>
                          <th className="text-left p-3 font-medium">Temp.</th>
                          <th className="text-left p-3 font-medium">Data Exclusão</th>
                          <th className="text-left p-3 font-medium">Motivo</th>
                          <th className="text-right p-3 font-medium">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deletadosLista.map((c) => (
                          <tr key={c.id} className="border-b hover:bg-muted/30">
                            <td className="p-3 font-medium">{c.nome}</td>
                            <td className="p-3 text-muted-foreground">{c.responsavel}</td>
                            <td className="p-3 text-muted-foreground">{c.excluidoPor}</td>
                            <td className="p-3 max-w-[160px]">
                              <div className="flex flex-wrap gap-1">
                                {c.servico !== "—"
                                  ? c.servico.split(",").map((s) => s.trim()).filter(Boolean).map((s) => (
                                      <span key={s} className="inline-flex px-1.5 py-0.5 rounded text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{s}</span>
                                    ))
                                  : <span className="text-muted-foreground">—</span>}
                              </div>
                            </td>
                            <td className="p-3 text-sm">{TEMP_LABELS[c.temperatura] ?? "—"}</td>
                            <td className="p-3 text-muted-foreground whitespace-nowrap">
                              {c.deletedAt ? new Date(c.deletedAt).toLocaleDateString("pt-BR") : "—"}
                            </td>
                            <td className="p-3 max-w-[200px]">
                              {c.motivoExclusao ? (
                                <span>{c.motivoExclusao}</span>
                              ) : <span className="text-muted-foreground text-xs">Não informado</span>}
                            </td>
                            <td className="p-3 text-right font-semibold">
                              {c.valor > 0 ? formatCurrency(c.valor) : <span className="text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-muted/30">
                          <td className="p-3 font-semibold" colSpan={7}>Total</td>
                          <td className="p-3 text-right font-semibold text-red-500">
                            {formatCurrency(deletadosLista.reduce((s, c) => s + c.valor, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              ) : (
                <Card className="p-12 text-center text-muted-foreground">
                  <Trash2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  <p>Nenhum cliente deletado encontrado no período</p>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
