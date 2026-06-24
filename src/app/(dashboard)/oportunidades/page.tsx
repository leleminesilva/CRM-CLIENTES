"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Target, MoreHorizontal, Eye, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency, formatDate, STATUS_OPO_LABELS } from "@/lib/utils/formatters";
import type { Oportunidade } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  ABERTA: "info",
  GANHA: "success",
  PERDIDA: "destructive",
  SUSPENSA: "warning",
};

export default function OportunidadesPage() {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["oportunidades", search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (search) params.set("search", search);
      const { data } = await axios.get(`/api/oportunidades?${params}`);
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/oportunidades/${id}`),
    onSuccess: () => {
      toast.success("Oportunidade removida");
      qc.invalidateQueries({ queryKey: ["oportunidades"] });
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const oportunidades: Oportunidade[] = data?.data || [];
  const totalValor = oportunidades.filter(o => o.status === "ABERTA").reduce((s, o) => s + Number(o.valor || 0), 0);
  const ganhas = oportunidades.filter(o => o.status === "GANHA");
  const totalGanho = ganhas.reduce((s, o) => s + Number(o.valor || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Oportunidades</h2>
          <p className="text-muted-foreground">{oportunidades.length} oportunidades</p>
        </div>
        <Link href="/oportunidades/nova">
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            Nova Oportunidade
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Em aberto</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(totalValor)}</p>
          <p className="text-xs text-muted-foreground">{oportunidades.filter(o => o.status === "ABERTA").length} oportunidades</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Fechadas (Ganhas)</p>
          <p className="text-xl font-bold mt-1 text-emerald-600">{formatCurrency(totalGanho)}</p>
          <p className="text-xs text-muted-foreground">{ganhas.length} oportunidades</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Taxa de conversão</p>
          <p className="text-xl font-bold mt-1">
            {oportunidades.length > 0 ? Math.round((ganhas.length / oportunidades.length) * 100) : 0}%
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Ticket médio</p>
          <p className="text-xl font-bold mt-1">
            {ganhas.length > 0 ? formatCurrency(totalGanho / ganhas.length) : formatCurrency(0)}
          </p>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Input
          placeholder="Buscar oportunidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
        <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 font-medium text-muted-foreground">Oportunidade</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Valor</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Probabilidade</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Previsão</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Responsável</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b">
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="p-4">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : oportunidades.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground">
                    <Target className="w-8 h-8 mx-auto mb-3 opacity-40" />
                    <p>Nenhuma oportunidade encontrada</p>
                  </td>
                </tr>
              ) : (
                oportunidades.map((o) => (
                  <tr key={o.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {o.status === "GANHA" ? (
                          <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : o.status === "PERDIDA" ? (
                          <TrendingDown className="w-4 h-4 text-red-500 shrink-0" />
                        ) : (
                          <Target className="w-4 h-4 text-indigo-500 shrink-0" />
                        )}
                        <span className="font-medium">{o.titulo}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm">
                      {o.cliente?.nome || o.empresa?.nomeFantasia || o.empresa?.razaoSocial || "—"}
                    </td>
                    <td className="p-4">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(o.valor)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress value={o.probabilidade} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground w-8">{o.probabilidade}%</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {o.dataPrevisao ? formatDate(o.dataPrevisao) : "—"}
                    </td>
                    <td className="p-4">
                      <Badge variant={STATUS_COLORS[o.status] as "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"}>
                        {STATUS_OPO_LABELS[o.status]}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm">{o.responsavel?.nome || "—"}</td>
                    <td className="p-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/oportunidades/${o.id}`}>
                              <Eye className="w-4 h-4 mr-2" />
                              Visualizar
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(o.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover oportunidade</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
