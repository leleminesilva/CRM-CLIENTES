"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { BarChart3, Download, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

const CORES_ENTRADA = ["#10b981", "#34d399", "#6ee7b7", "#059669", "#a7f3d0"];
const CORES_SAIDA = ["#ef4444", "#f97316", "#f59e0b", "#dc2626", "#fb923c", "#eab308"];

interface CategoriaResumo { categoriaId: string | null; nome: string; cor: string | null; total: number }
interface LancamentoLinha {
  id: string; tipo: "ENTRADA" | "SAIDA"; descricao: string; valor: string; data: string;
  conta: { nome: string }; categoria: { nome: string } | null;
}
interface RelatorioMensal {
  ano: number; mes: number;
  saldoInicial: number; saldoFinal: number;
  totalEntradas: number; totalSaidas: number; resultado: number;
  entradasPorCategoria: CategoriaResumo[]; saidasPorCategoria: CategoriaResumo[];
  lancamentos: LancamentoLinha[];
}

function mesAtualISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function GraficoCategoria({ dados, cores, titulo }: { dados: CategoriaResumo[]; cores: string[]; titulo: string }) {
  if (dados.length === 0) {
    return (
      <div>
        <h4 className="text-sm font-medium mb-3">{titulo}</h4>
        <p className="text-sm text-muted-foreground text-center py-10">Sem lançamentos</p>
      </div>
    );
  }
  return (
    <div>
      <h4 className="text-sm font-medium mb-1">{titulo}</h4>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={dados} dataKey="total" nameKey="nome" innerRadius={45} outerRadius={75} paddingAngle={2}>
            {dados.map((d, i) => <Cell key={d.categoriaId ?? i} fill={d.cor || cores[i % cores.length]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function RelatorioMensalPage() {
  const [competencia, setCompetencia] = useState(mesAtualISO());
  const [ano, mesStr] = competencia.split("-");
  const mes = Number(mesStr);

  const { data, isLoading } = useQuery({
    queryKey: ["financeiro-relatorio-mensal", ano, mes],
    queryFn: async () => {
      const { data } = await axios.get(`/api/financeiro/relatorios/mensal?ano=${ano}&mes=${mes}`);
      return data.data as RelatorioMensal;
    },
  });

  function exportarCSV() {
    if (!data) return;
    const header = "Data,Tipo,Descrição,Conta,Categoria,Valor";
    const linhas = data.lancamentos.map((l) =>
      [formatDate(l.data), l.tipo === "ENTRADA" ? "Entrada" : "Saída", `"${l.descricao.replace(/"/g, '""')}"`, l.conta.nome, l.categoria?.nome ?? "", Number(l.valor).toFixed(2)].join(",")
    );
    const csv = [header, ...linhas].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-${competencia}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Relatório mensal
          </h2>
          <p className="text-muted-foreground">Resultado do caixa por competência</p>
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Competência</Label>
            <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="w-40" />
          </div>
          <Button variant="outline" size="sm" onClick={exportarCSV} disabled={!data || data.lancamentos.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Saldo inicial</p>
              <p className="text-lg font-bold mt-1 tabular-nums">{formatCurrency(data.saldoInicial)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-emerald-500" /> Entradas</p>
              <p className="text-lg font-bold mt-1 tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(data.totalEntradas)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowDownRight className="w-3 h-3 text-red-500" /> Saídas</p>
              <p className="text-lg font-bold mt-1 tabular-nums text-red-500">{formatCurrency(data.totalSaidas)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Resultado</p>
              <p className={`text-lg font-bold mt-1 tabular-nums ${data.resultado < 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                {formatCurrency(data.resultado)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Saldo final</p>
              <p className="text-lg font-bold mt-1 tabular-nums">{formatCurrency(data.saldoFinal)}</p>
            </Card>
          </div>

          <Card className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GraficoCategoria dados={data.entradasPorCategoria} cores={CORES_ENTRADA} titulo="Entradas por categoria" />
              <GraficoCategoria dados={data.saidasPorCategoria} cores={CORES_SAIDA} titulo="Saídas por categoria" />
            </div>
          </Card>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Data</th>
                    <th className="text-left p-3 font-medium">Descrição</th>
                    <th className="text-left p-3 font-medium">Conta</th>
                    <th className="text-left p-3 font-medium">Categoria</th>
                    <th className="text-right p-3 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lancamentos.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum lançamento nessa competência</td></tr>
                  ) : (
                    data.lancamentos.map((l) => (
                      <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 whitespace-nowrap">{formatDate(l.data)}</td>
                        <td className="p-3">{l.descricao}</td>
                        <td className="p-3 text-muted-foreground">{l.conta.nome}</td>
                        <td className="p-3 text-muted-foreground">{l.categoria?.nome ?? "—"}</td>
                        <td className={`p-3 text-right font-semibold tabular-nums ${l.tipo === "ENTRADA" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                          {l.tipo === "ENTRADA" ? "+" : "-"}{formatCurrency(Number(l.valor))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
