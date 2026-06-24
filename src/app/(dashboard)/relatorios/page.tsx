"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { TrendingUp, Users, DollarSign, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency, ROLE_LABELS } from "@/lib/utils/formatters";

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

  async function exportarCSV(tipo: string) {
    const params = `de=${de}&ate=${ate}`;
    const { data } = await axios.get(`/api/relatorios/${tipo}?${params}`);

    const rows = tipo === "equipe"
      ? data.data.map((r: Record<string, unknown>) =>
          `${r.nome},${r.leadsGerados},${r.vendasFechadas},${r.receitaGerada}`)
      : Object.entries(data.data).map(([k, v]) => `${k},${v}`);

    const csv = ["Métrica,Valor", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${tipo}-${de}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
            <Input type="date" value={de} onChange={e => setDe(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Data final</Label>
            <Input type="date" value={ate} onChange={e => setAte(e.target.value)} />
          </div>
        </div>
      </Card>

      <Tabs defaultValue="comercial">
        <TabsList>
          <TabsTrigger value="comercial">
            <TrendingUp className="w-4 h-4 mr-2" />
            Comercial
          </TabsTrigger>
          <TabsTrigger value="equipe">
            <Users className="w-4 h-4 mr-2" />
            Equipe
          </TabsTrigger>
          <TabsTrigger value="financeiro">
            <DollarSign className="w-4 h-4 mr-2" />
            Financeiro
          </TabsTrigger>
        </TabsList>

        {/* COMERCIAL */}
        <TabsContent value="comercial" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportarCSV("comercial")}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>

          {loadingComercial ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Leads Gerados</p>
                  <p className="text-2xl font-bold mt-1">{comercial?.leadsGerados ?? 0}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Leads Convertidos</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-600">{comercial?.leadsConvertidos ?? 0}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                  <p className="text-2xl font-bold mt-1">{comercial?.taxaConversaoLeads ?? 0}%</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Vendas Fechadas</p>
                  <p className="text-2xl font-bold mt-1">{comercial?.vendasFechadas ?? 0}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Receita Fechada</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-600">{formatCurrency(comercial?.receitaFechada ?? 0)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Ticket Médio</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(comercial?.ticketMedio ?? 0)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Em Aberto</p>
                  <p className="text-2xl font-bold mt-1">{comercial?.oportunidadesAbertas ?? 0}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Perdidas</p>
                  <p className="text-2xl font-bold mt-1 text-red-500">{comercial?.oportunidadesPerdidas ?? 0}</p>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* EQUIPE */}
        <TabsContent value="equipe" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportarCSV("equipe")}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>

          {loadingEquipe ? (
            <div className="h-64 bg-muted animate-pulse rounded-xl" />
          ) : equipe && equipe.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={equipe}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="nome" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      name === "receitaGerada" ? formatCurrency(v) : v,
                      name === "receitaGerada" ? "Receita" : name === "vendasFechadas" ? "Vendas" : "Leads",
                    ]}
                  />
                  <Bar dataKey="leadsGerados" fill="#6366f1" name="Leads" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="vendasFechadas" fill="#10b981" name="Vendas" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Vendedor</th>
                        <th className="text-center p-3 font-medium">Perfil</th>
                        <th className="text-center p-3 font-medium">Leads</th>
                        <th className="text-center p-3 font-medium">Vendas</th>
                        <th className="text-center p-3 font-medium">Tarefas</th>
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
                          <td className="p-3 text-center">{String(v.vendasFechadas)}</td>
                          <td className="p-3 text-center">{String(v.tarefasConcluidas)}</td>
                          <td className="p-3 text-right font-semibold text-emerald-600">
                            {formatCurrency(Number(v.receitaGerada))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
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

        {/* FINANCEIRO */}
        <TabsContent value="financeiro" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportarCSV("financeiro")}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>

          {loadingFinanceiro ? (
            <div className="h-48 bg-muted animate-pulse rounded-xl" />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 col-span-2">
                <p className="text-sm text-muted-foreground">Receita Prevista (Pipeline)</p>
                <p className="text-3xl font-bold mt-1 text-indigo-600">
                  {formatCurrency(financeiro?.receitaPrevista ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Oportunidades em aberto</p>
              </Card>
              <Card className="p-4 col-span-2">
                <p className="text-sm text-muted-foreground">Receita Fechada</p>
                <p className="text-3xl font-bold mt-1 text-emerald-600">
                  {formatCurrency(financeiro?.receitaFechada ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{financeiro?.totalVendas ?? 0} vendas no período</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(financeiro?.ticketMedio ?? 0)}</p>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
