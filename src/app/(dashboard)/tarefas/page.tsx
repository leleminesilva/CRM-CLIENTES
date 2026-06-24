"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Plus, CheckSquare, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, TIPO_TAREFA_LABELS, PRIORIDADE_LABELS } from "@/lib/utils/formatters";
import type { Tarefa } from "@/types";

const PRIORIDADE_COLORS: Record<string, string> = {
  ALTA: "destructive",
  MEDIA: "warning",
  BAIXA: "info",
};

const STATUS_GROUPS = [
  { label: "Pendentes", value: "PENDENTE", icon: Clock, color: "text-amber-500" },
  { label: "Em Andamento", value: "EM_ANDAMENTO", icon: AlertTriangle, color: "text-blue-500" },
  { label: "Concluídas", value: "CONCLUIDA", icon: CheckCircle2, color: "text-emerald-500" },
];

function NovaTarefaDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    titulo: "", descricao: "", tipo: "TAREFA", prioridade: "MEDIA", dataVencimento: "",
  });

  const mutation = useMutation({
    mutationFn: () => axios.post("/api/tarefas", form),
    onSuccess: () => { toast.success("Tarefa criada!"); setOpen(false); onSuccess(); },
    onError: () => toast.error("Erro ao criar tarefa"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />
          Nova Tarefa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Título da tarefa" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_TAREFA_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={v => setForm(f => ({ ...f, prioridade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALTA">🔴 Alta</SelectItem>
                  <SelectItem value="MEDIA">🟡 Média</SelectItem>
                  <SelectItem value="BAIXA">🟢 Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Data de Vencimento *</Label>
            <Input type="date" value={form.dataVencimento} onChange={e => setForm(f => ({ ...f, dataVencimento: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => mutation.mutate()}
              disabled={!form.titulo || !form.dataVencimento || mutation.isPending}
            >
              {mutation.isPending ? "Criando..." : "Criar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TarefasPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["tarefas"],
    queryFn: async () => {
      const { data } = await axios.get("/api/tarefas");
      return data.data as Tarefa[];
    },
  });

  const concluirMutation = useMutation({
    mutationFn: (id: string) => axios.put(`/api/tarefas/${id}`, { concluir: true }),
    onSuccess: () => {
      toast.success("Tarefa concluída!");
      qc.invalidateQueries({ queryKey: ["tarefas"] });
    },
    onError: () => toast.error("Erro ao concluir tarefa"),
  });

  const tarefas = data || [];
  const hoje = new Date();

  const atrasadas = tarefas.filter(t =>
    t.status !== "CONCLUIDA" && new Date(t.dataVencimento) < hoje
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Tarefas</h2>
          <p className="text-muted-foreground">{tarefas.length} tarefas</p>
        </div>
        <NovaTarefaDialog onSuccess={() => qc.invalidateQueries({ queryKey: ["tarefas"] })} />
      </div>

      {atrasadas.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">
              <strong>{atrasadas.length} tarefa{atrasadas.length > 1 ? "s" : ""} atrasada{atrasadas.length > 1 ? "s" : ""}</strong>
              {" — "}{atrasadas.map(t => t.titulo).join(", ")}
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {STATUS_GROUPS.map(({ label, value, icon: Icon, color }) => {
            const grupo = tarefas.filter(t => t.status === value);
            if (grupo.length === 0) return null;

            return (
              <div key={value}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <h3 className="font-semibold text-sm">{label}</h3>
                  <Badge variant="secondary" className="text-xs">{grupo.length}</Badge>
                </div>

                <div className="space-y-2">
                  {grupo.map(t => {
                    const vencida = t.status !== "CONCLUIDA" && new Date(t.dataVencimento) < hoje;

                    return (
                      <Card key={t.id} className={`hover:shadow-sm transition-shadow ${vencida ? "border-red-200 dark:border-red-800" : ""}`}>
                        <CardContent className="flex items-center gap-4 p-4">
                          <Checkbox
                            checked={t.status === "CONCLUIDA"}
                            onCheckedChange={() => {
                              if (t.status !== "CONCLUIDA") concluirMutation.mutate(t.id);
                            }}
                            disabled={t.status === "CONCLUIDA" || concluirMutation.isPending}
                          />

                          <div className="flex-1 min-w-0">
                            <p className={`font-medium text-sm ${t.status === "CONCLUIDA" ? "line-through text-muted-foreground" : ""}`}>
                              {t.titulo}
                            </p>
                            {t.descricao && (
                              <p className="text-xs text-muted-foreground truncate">{t.descricao}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {TIPO_TAREFA_LABELS[t.tipo]}
                              </span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className={`text-xs ${vencida ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                                {vencida ? "Atrasada — " : ""}
                                {formatDate(t.dataVencimento)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {t.responsavel && (
                              <span className="text-xs text-muted-foreground hidden sm:block">
                                {t.responsavel.nome.split(" ")[0]}
                              </span>
                            )}
                            <Badge
                              variant={PRIORIDADE_COLORS[t.prioridade] as "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"}
                              className="text-xs"
                            >
                              {PRIORIDADE_LABELS[t.prioridade]}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {tarefas.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <CheckSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Nenhuma tarefa encontrada</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
