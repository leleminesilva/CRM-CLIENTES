"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  Wallet, TrendingUp, TrendingDown, ArrowRight, ArrowUpRight, ArrowDownRight, Landmark,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface ContaResumo {
  id: string;
  nome: string;
  tipo: string;
  cor: string | null;
  saldo: number;
}

interface LancamentoResumo {
  id: string;
  tipo: "ENTRADA" | "SAIDA";
  descricao: string;
  valor: string;
  data: string;
  conta: { id: string; nome: string; cor: string | null };
  categoria: { id: string; nome: string; cor: string | null } | null;
}

interface DashboardData {
  saldoTotal: number;
  contas: ContaResumo[];
  mesAtual: { entradas: number; saidas: number; saldo: number };
  mesAnterior: { entradas: number; saidas: number; saldo: number };
  serie: { mes: string; entradas: number; saidas: number }[];
  ultimosLancamentos: LancamentoResumo[];
}

function variacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

function ChipVariacao({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const positivo = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positivo ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
      {positivo ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(pct).toFixed(0)}% vs mês anterior
    </span>
  );
}

function mesLabel(chave: string) {
  const [ano, mes] = chave.split("-").map(Number);
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

export default function FinanceiroDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["financeiro-dashboard"],
    queryFn: async () => {
      const { data } = await axios.get("/api/financeiro/dashboard");
      return data.data as DashboardData;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
        </div>
        <div className="h-72 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  const serieFormatada = data.serie.map((s) => ({ ...s, label: mesLabel(s.mes) }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6" />
            Financeiro
          </h2>
          <p className="text-muted-foreground">Visão geral do caixa da Infinity Glass</p>
        </div>
        <Link href="/financeiro/caixa" className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
          Lançar entrada/saída <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Saldo total</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{formatCurrency(data.saldoTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">{data.contas.length} conta{data.contas.length !== 1 ? "s" : ""} ativa{data.contas.length !== 1 ? "s" : ""}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Entradas do mês
          </p>
          <p className="text-2xl font-bold mt-1 tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(data.mesAtual.entradas)}</p>
          <ChipVariacao pct={variacao(data.mesAtual.entradas, data.mesAnterior.entradas)} />
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-red-500" /> Saídas do mês
          </p>
          <p className="text-2xl font-bold mt-1 tabular-nums text-red-500">{formatCurrency(data.mesAtual.saidas)}</p>
          <ChipVariacao pct={variacao(data.mesAtual.saidas, data.mesAnterior.saidas)} />
        </Card>
      </div>

      {/* Gráfico + contas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <h3 className="font-semibold mb-4">Entradas x Saídas — últimos 6 meses</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={serieFormatada}>
              <defs>
                <linearGradient id="corEntrada" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="corSaida" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={70}
                tickFormatter={(v) => formatCurrency(v).replace("R$", "").trim()} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Area type="monotone" dataKey="entradas" name="Entradas" stroke="#10b981" fill="url(#corEntrada)" strokeWidth={2} />
              <Area type="monotone" dataKey="saidas" name="Saídas" stroke="#ef4444" fill="url(#corSaida)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><Landmark className="w-4 h-4" /> Contas</h3>
            <Link href="/financeiro/contas" className="text-xs text-emerald-600 hover:underline">Gerenciar</Link>
          </div>
          {data.contas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada</p>
          ) : (
            <div className="space-y-3">
              {data.contas.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.cor || "#10b981" }} />
                    <span className="text-sm truncate">{c.nome}</span>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums shrink-0 ${c.saldo < 0 ? "text-red-500" : ""}`}>
                    {formatCurrency(c.saldo)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Últimos lançamentos */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Últimos lançamentos</h3>
          <Link href="/financeiro/caixa" className="text-xs text-emerald-600 hover:underline">Ver todos</Link>
        </div>
        {data.ultimosLancamentos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum lançamento ainda</p>
        ) : (
          <div className="space-y-1">
            {data.ultimosLancamentos.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                <div className="min-w-0 flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${l.tipo === "ENTRADA" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                    {l.tipo === "ENTRADA" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{l.descricao}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {l.conta.nome}{l.categoria ? ` · ${l.categoria.nome}` : ""} · {formatDate(l.data)}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-semibold tabular-nums shrink-0 ${l.tipo === "ENTRADA" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                  {l.tipo === "ENTRADA" ? "+" : "-"}{formatCurrency(Number(l.valor))}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
