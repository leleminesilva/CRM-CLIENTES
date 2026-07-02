"use client";

import { useState, useMemo } from "react";
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
  XCircle,
  TrendingDown,
  CalendarRange,
  X,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, ORIGEM_LABELS, ESTAGIO_LABELS } from "@/lib/utils/formatters";
import { useAuth } from "@/contexts/AuthContext";


// Cores distintas por estágio do funil (alta legibilidade em light e dark)
const FUNIL_COLORS: Record<string, string> = {
  NOVO_LEAD:           "#3b82f6", // blue
  CONTATO_INICIAL:     "#8b5cf6", // violet
  PRIMEIRO_ORCAMENTO:  "#6366f1", // indigo
  QUALIFICACAO:        "#a855f7", // purple
  PROPOSTA_ENVIADA: "#f59e0b", // amber
  NEGOCIACAO:       "#f97316", // orange
  FECHADO_GANHO:    "#10b981", // emerald
};

const SERVICE_COLORS = ["#6366f1","#3b82f6","#10b981","#f59e0b","#f97316","#ec4899","#8b5cf6","#14b8a6"];
const VENDOR_COLORS  = ["#6366f1","#10b981","#f59e0b","#3b82f6","#f97316","#ec4899"];

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  variacao?: number;
  prefix?: string;
  color?: string;
  subtitle?: string;
}

function KPICard({ title, value, icon, variacao, prefix = "", color = "bg-indigo-500", subtitle }: KPICardProps) {
  return (
    <Card className="hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 overflow-hidden">
      {/* Accent strip */}
      <div className={`h-1 w-full ${color}`} />
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide leading-tight">{title}</p>
            <p className="text-2xl md:text-3xl font-bold truncate leading-none mt-1.5">
              {prefix}{typeof value === "number" ? value.toLocaleString("pt-BR") : value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
            )}
            {variacao !== undefined && (
              <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${variacao >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {variacao >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {Math.abs(variacao)}% vs anterior
              </div>
            )}
          </div>
          <div className={`${color} p-2.5 rounded-xl shrink-0 opacity-90`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }); // YYYY-MM ou "_ano"
  const [vendedorId, setVendedorId] = useState("");           // UUID
  const [dataInicio, setDataInicio] = useState("");            // YYYY-MM-DD
  const [dataFim, setDataFim] = useState("");                  // YYYY-MM-DD
  const usandoDataCustom = !!(dataInicio && dataFim);
  const { user } = useAuth();
  const isGestor = user?.role === "ADMINISTRADOR" || user?.role === "GESTOR";

  const { data: primeiroMesData } = useQuery({
    queryKey: ["dashboard-primeiro-mes"],
    queryFn: async () => {
      const { data } = await axios.get("/api/dashboard/primeiro-mes");
      return data.mes as string;
    },
    staleTime: Infinity,
  });

  const mesesDisponiveis = useMemo(() => {
    const primeiromes = primeiroMesData ?? "2026-01";
    const [anoI, mesI] = primeiromes.split("-").map(Number);
    const inicio = new Date(anoI, mesI - 1, 1);
    const now = new Date();
    const atual = new Date(now.getFullYear(), now.getMonth(), 1);
    const opts: { value: string; label: string }[] = [];
    const cursor = new Date(inicio);
    while (cursor <= atual) {
      const value = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      const label = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return opts.reverse(); // mais recente primeiro
  }, [primeiroMesData]);

  const { data: vendedoresData } = useQuery({
    queryKey: ["usuarios-ativos-dashboard"],
    queryFn: async () => {
      const { data } = await axios.get("/api/usuarios/ativos");
      return data.data as Array<{ id: string; nome: string }>;
    },
    enabled: isGestor,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", mesSelecionado, vendedorId, dataInicio, dataFim],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (usandoDataCustom) {
        params.set("dataInicio", dataInicio);
        params.set("dataFim", dataFim);
      } else if (mesSelecionado === "_ano") {
        params.set("periodo", "ano");
      } else {
        params.set("mes", mesSelecionado);
      }
      if (vendedorId) params.set("vendedorId", vendedorId);
      const { data } = await axios.get(`/api/dashboard?${params}`);
      return data.data;
    },
    refetchInterval: 60000,
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

  const funnelOrdem = ["NOVO_LEAD", "CONTATO_INICIAL", "PRIMEIRO_ORCAMENTO", "QUALIFICACAO", "PROPOSTA_ENVIADA", "NEGOCIACAO", "FECHADO_GANHO"];
  const funnelOrdenado = funnelOrdem.map((e) => funil.find((f: { estagio: string; total: number; valor: number }) => f.estagio === e)).filter(Boolean);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header com filtros */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">Dashboard Executivo</h2>
          <p className="text-sm text-muted-foreground">Visão geral do desempenho comercial</p>
        </div>

        {isGestor && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de período */}
            <Select
              value={mesSelecionado}
              onValueChange={(v) => { setMesSelecionado(v); setDataInicio(""); setDataFim(""); }}
            >
              <SelectTrigger className={`h-9 w-48 text-sm ${usandoDataCustom ? "opacity-40 pointer-events-none" : ""}`}>
                <SelectValue placeholder="Selecionar período..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_ano">📅 Ano completo</SelectItem>
                {mesesDisponiveis.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Seletor de intervalo de datas customizado */}
            <div className={`flex items-center gap-1.5 bg-muted px-2 py-1 rounded-lg border ${usandoDataCustom ? "border-indigo-500" : "border-transparent"}`}>
              <CalendarRange className={`w-4 h-4 shrink-0 ${usandoDataCustom ? "text-indigo-500" : "text-muted-foreground"}`} />
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => { setDataInicio(e.target.value); setMesSelecionado(""); }}
                className="h-7 bg-transparent text-sm outline-none w-32 cursor-pointer"
                title="Data início"
              />
              <span className="text-muted-foreground text-xs">até</span>
              <input
                type="date"
                value={dataFim}
                min={dataInicio || undefined}
                onChange={(e) => { setDataFim(e.target.value); setMesSelecionado(""); }}
                className="h-7 bg-transparent text-sm outline-none w-32 cursor-pointer"
                title="Data fim"
              />
              {usandoDataCustom && (
                <button
                  onClick={() => { setDataInicio(""); setDataFim(""); }}
                  className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
                  title="Limpar intervalo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Seletor de vendedor — Gestor/Admin */}
            <Select
              value={vendedorId || "_all"}
              onValueChange={(v) => setVendedorId(v === "_all" ? "" : v)}
            >
              <SelectTrigger className={`h-9 w-48 text-sm ${vendedorId ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" : ""}`}>
                <SelectValue placeholder="Todos os vendedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos os vendedores</SelectItem>
                {(vendedoresData || []).map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        <KPICard
          title="Cancelamentos"
          value={kpis.canceladosPeriodo ?? 0}
          icon={<XCircle className="w-5 h-5 text-white" />}
          color="bg-red-500"
        />
        <KPICard
          title="Valor Cancelado"
          value={formatCurrency(kpis.canceladosValor ?? 0)}
          icon={<TrendingDown className="w-5 h-5 text-white" />}
          color="bg-red-700"
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
                {funnelOrdenado.map((f: { estagio: string; total: number; valor: number } | undefined) => {
                  if (!f) return null;
                  const max = Math.max(...funnelOrdenado.map((x: { total: number } | undefined) => x?.total || 0));
                  const pct = max > 0 ? (f.total / max) * 100 : 0;
                  const barColor = FUNIL_COLORS[f.estagio] ?? "#6366f1";
                  return (
                    <div key={f.estagio} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: barColor }} />
                          <span className="font-medium">{ESTAGIO_LABELS[f.estagio] || f.estagio}</span>
                        </div>
                        <span className="text-muted-foreground text-xs">{f.total} leads</span>
                      </div>
                      <div className="h-9 bg-muted/60 rounded-lg overflow-hidden">
                        <div
                          className="h-full rounded-lg flex items-center pl-3 text-white text-xs font-semibold transition-all duration-500"
                          style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: barColor, minWidth: "50px" }}
                        >
                          {f.total > 0 && f.total}
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
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.6} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} domain={[0, Math.max(META_MES, ...acumulado.map(d => d.acumulado)) * 1.1]} width={36} />
                    <RechartTooltip
                      formatter={(v: number, name: string) => [formatCurrency(v), name === "acumulado" ? "Acumulado" : "No dia"]}
                      labelFormatter={(l) => `Dia ${l}`}
                      contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }}
                    />
                    <ReferenceLine y={META_MES} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: "Meta 100k", position: "insideTopRight", fontSize: 11, fill: "#f59e0b" }} />
                    <Line type="monotone" dataKey="acumulado" stroke="#6366f1" strokeWidth={3} dot={{ fill: "#6366f1", r: 5, strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 7, stroke: "#6366f1", strokeWidth: 2, fill: "#fff" }} />
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

      {/* Performance por Vendedor — largura total */}
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
                const barColor = VENDOR_COLORS[i % VENDOR_COLORS.length];
                return (
                  <div key={v.vendedor} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: barColor }} />
                        <span className="font-medium">{v.vendedor}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground text-xs">{v.total} {v.total === 1 ? "venda" : "vendas"}</span>
                        <span className="ml-2 font-bold">{formatCurrency(v.valor)}</span>
                      </div>
                    </div>
                    <div className="h-3 bg-muted/60 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-20 text-muted-foreground">
              Sem dados para exibir
            </div>
          )}
        </CardContent>
      </Card>

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

        {/* Serviços Mais Solicitados — só Gestor/Admin */}
        {isGestor ? (
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
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SERVICE_COLORS[i % SERVICE_COLORS.length] }} />
                            <span className="font-medium">{s.servico}</span>
                          </div>
                          <span className="text-muted-foreground text-xs">{s.total} {s.total === 1 ? "cliente" : "clientes"} · {pctReal}%</span>
                        </div>
                        <div className="h-8 bg-muted/60 rounded-lg overflow-hidden">
                          <div
                            className="h-full rounded-lg flex items-center pl-3 text-white text-xs font-semibold transition-all duration-500"
                            style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: SERVICE_COLORS[i % SERVICE_COLORS.length] }}
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
        ) : null}
      </div>
    </div>
  );
}
