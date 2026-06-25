"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  Users,
  TrendingUp,
  Target,
  DollarSign,
  CheckCircle2,
  Percent,
  Receipt,
  BarChart2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  LineChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, ORIGEM_LABELS, ESTAGIO_LABELS } from "@/lib/utils/formatters";
import { useAuth } from "@/contexts/AuthContext";

const PERIOD_OPTIONS = [
  { label: "Hoje", value: "hoje" },
  { label: "Semana", value: "semana" },
  { label: "Mês", value: "mes" },
  { label: "Ano", value: "ano" },
];

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe"];

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  variacao?: number;
  prefix?: string;
  color?: string;
}

function KPICard({ title, value, icon, variacao, prefix = "", color = "bg-indigo-500" }: KPICardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 md:space-y-2 min-w-0">
            <p className="text-xs md:text-sm text-muted-foreground font-medium leading-tight">{title}</p>
            <p className="text-xl md:text-2xl font-bold truncate">
              {prefix}{typeof value === "number" ? value.toLocaleString("pt-BR") : value}
            </p>
            {variacao !== undefined && (
              <div className={`flex items-center gap-1 text-xs ${variacao >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {variacao >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                <span className="hidden sm:inline">{Math.abs(variacao)}% vs anterior</span>
                <span className="sm:hidden">{Math.abs(variacao)}%</span>
              </div>
            )}
          </div>
          <div className={`${color} p-2 md:p-3 rounded-xl shrink-0`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState("mes");
  const { user } = useAuth();
  const isGestor = user?.role === "ADMINISTRADOR" || user?.role === "GESTOR";

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", periodo],
    queryFn: async () => {
      const { data } = await axios.get(`/api/dashboard?periodo=${periodo}`);
      return data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl" />)}
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const funil = data?.funil || [];
  const vendasMes = Array.isArray(data?.vendasMes) ? data.vendasMes : [];
  const leadsPorOrigem = data?.leadsPorOrigem || [];
  const vendasPorVendedor = data?.vendasPorVendedor || [];
  const servicosMaisSolicitados: Array<{ servico: string; total: number }> = data?.servicosMaisSolicitados || [];

  const funnelOrdem = ["NOVO_LEAD", "CONTATO_INICIAL", "QUALIFICACAO", "PROPOSTA_ENVIADA", "NEGOCIACAO", "FECHADO_GANHO"];
  const funnelOrdenado = funnelOrdem.map((e) => funil.find((f: { estagio: string; total: number; valor: number }) => f.estagio === e)).filter(Boolean);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header com filtros */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">Dashboard Executivo</h2>
          <p className="text-sm text-muted-foreground">Visão geral do desempenho comercial</p>
        </div>
        {isGestor && (
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            {PERIOD_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={periodo === opt.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setPeriodo(opt.value)}
                className={periodo === opt.value ? "bg-background shadow-sm" : ""}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total de Clientes"
          value={kpis.totalClientes ?? 0}
          icon={<Users className="w-5 h-5 text-white" />}
          color="bg-indigo-500"
        />
        <KPICard
          title="Leads Ativos"
          value={kpis.leadsAtivos ?? 0}
          icon={<TrendingUp className="w-5 h-5 text-white" />}
          color="bg-violet-500"
        />
        <KPICard
          title="Oportunidades Abertas"
          value={kpis.oportunidadesAbertas ?? 0}
          icon={<Target className="w-5 h-5 text-white" />}
          color="bg-blue-500"
        />
        <KPICard
          title="Valor em Negociação"
          value={formatCurrency(kpis.valorNegociacao ?? 0)}
          icon={<DollarSign className="w-5 h-5 text-white" />}
          color="bg-emerald-500"
        />
        <KPICard
          title="Vendas Fechadas"
          value={kpis.vendasFechadas ?? 0}
          icon={<CheckCircle2 className="w-5 h-5 text-white" />}
          color="bg-green-500"
        />
        <KPICard
          title="Taxa de Conversão"
          value={`${kpis.taxaConversao ?? 0}%`}
          icon={<Percent className="w-5 h-5 text-white" />}
          color="bg-amber-500"
        />
        <KPICard
          title="Ticket Médio"
          value={formatCurrency(kpis.ticketMedio ?? 0)}
          icon={<BarChart2 className="w-5 h-5 text-white" />}
          color="bg-orange-500"
        />
        <KPICard
          title="Receita Fechada"
          value={formatCurrency(kpis.faturamentoPrevisto ?? 0)}
          icon={<Receipt className="w-5 h-5 text-white" />}
          color="bg-rose-500"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funil de Vendas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funil de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            {funnelOrdenado.length > 0 ? (
              <div className="space-y-2">
                {funnelOrdenado.map((f: { estagio: string; total: number; valor: number } | undefined, i: number) => {
                  if (!f) return null;
                  const max = Math.max(...funnelOrdenado.map((x: { total: number } | undefined) => x?.total || 0));
                  const pct = max > 0 ? (f.total / max) * 100 : 0;
                  return (
                    <div key={f.estagio} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{ESTAGIO_LABELS[f.estagio] || f.estagio}</span>
                        <span className="text-muted-foreground">{f.total} leads</span>
                      </div>
                      <div className="h-8 bg-muted rounded-lg overflow-hidden">
                        <div
                          className="h-full rounded-lg flex items-center pl-3 text-white text-xs font-medium transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: COLORS[i % COLORS.length],
                            minWidth: "40px",
                          }}
                        >
                          {f.total > 0 && formatCurrency(f.valor)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vendas por Dia — acumulado vs meta */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Vendas por Dia</CardTitle>
              <span className="text-xs text-amber-500 font-medium">Meta: {formatCurrency(100000)}/mês</span>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const META_MES = 100000;
              const acumulado: Array<{ dia: string; valor: number; acumulado: number }> = [];
              (vendasMes as Array<{ dia: string; valor: number }>).forEach((item, i) => {
                const prev = i > 0 ? acumulado[i - 1].acumulado : 0;
                acumulado.push({ dia: item.dia, valor: item.valor, acumulado: prev + item.valor });
              });
              return acumulado.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={acumulado} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} domain={[0, Math.max(META_MES, ...acumulado.map(d => d.acumulado)) * 1.1]} />
                    <RechartTooltip
                      formatter={(v: number, name: string) => [formatCurrency(v), name === "acumulado" ? "Acumulado" : "No dia"]}
                      labelFormatter={(l) => `Dia ${l}`}
                      contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                    />
                    <ReferenceLine y={META_MES} stroke="#f59e0b" strokeDasharray="5 3" label={{ value: "Meta 100k", position: "insideTopRight", fontSize: 11, fill: "#f59e0b" }} />
                    <Line type="monotone" dataKey="acumulado" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: "#6366f1", r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                  Sem vendas confirmadas no período
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Serviços Mais Solicitados — só Gestor/Admin */}
      {isGestor && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Serviços Mais Solicitados
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Gestores</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {servicosMaisSolicitados.length > 0 ? (
              <div className="space-y-2">
                {servicosMaisSolicitados.map((s, i) => {
                  const max = Math.max(...servicosMaisSolicitados.map(x => x.total));
                  const pct = max > 0 ? (s.total / max) * 100 : 0;
                  const totalGeral = servicosMaisSolicitados.reduce((acc, x) => acc + x.total, 0);
                  const pctReal = totalGeral > 0 ? Math.round((s.total / totalGeral) * 100) : 0;
                  return (
                    <div key={s.servico} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{s.servico}</span>
                        <span className="text-muted-foreground">{s.total} {s.total === 1 ? "cliente" : "clientes"} · {pctReal}%</span>
                      </div>
                      <div className="h-7 bg-muted rounded-lg overflow-hidden">
                        <div
                          className="h-full rounded-lg flex items-center pl-3 text-white text-xs font-medium transition-all"
                          style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                        >
                          {pct > 15 && s.servico}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Origem dos Leads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Origem dos Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {leadsPorOrigem.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={160} className="max-w-[180px] shrink-0">
                  <PieChart>
                    <Pie data={leadsPorOrigem} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="total" nameKey="origem" paddingAngle={3}>
                      {leadsPorOrigem.map((_: unknown, index: number) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartTooltip
                      formatter={(v: number, n: string) => [v, ORIGEM_LABELS[n] || n]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 w-full space-y-2">
                  {leadsPorOrigem.map((l: { origem: string; total: number }, i: number) => (
                    <div key={l.origem} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="truncate">{ORIGEM_LABELS[l.origem] || l.origem}</span>
                      </div>
                      <span className="font-medium ml-2">{l.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Vendedores */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance por Vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            {vendasPorVendedor.length > 0 ? (
              <div className="space-y-4">
                {vendasPorVendedor.map((v: { vendedor: string; total: number; valor: number }, i: number) => {
                  const max = Math.max(...vendasPorVendedor.map((x: { valor: number }) => x.valor));
                  const pct = max > 0 ? (v.valor / max) * 100 : 0;
                  return (
                    <div key={v.vendedor} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{v.vendedor}</span>
                        <div className="text-right">
                          <span className="text-muted-foreground">{v.total} vendas</span>
                          <span className="ml-2 font-semibold">{formatCurrency(v.valor)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
