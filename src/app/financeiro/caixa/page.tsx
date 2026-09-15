"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, ArrowUpRight, ArrowDownRight, ArrowLeftRight, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

interface Conta { id: string; nome: string; ativa: boolean }
interface Categoria { id: string; nome: string; tipo: "ENTRADA" | "SAIDA" }
interface Lancamento {
  id: string;
  tipo: "ENTRADA" | "SAIDA";
  descricao: string;
  valor: string;
  data: string;
  conta: { id: string; nome: string };
  categoria: { id: string; nome: string } | null;
  criadoPor: { id: string; nome: string } | null;
}

const hojeISO = () => new Date().toISOString().slice(0, 10);
const emptyForm = { contaId: "", categoriaId: "", tipo: "SAIDA" as "ENTRADA" | "SAIDA", descricao: "", valor: "", data: hojeISO() };

function LancamentoFormDialog({
  trigger, title, contas, categorias, defaultValues, onSubmit, isPending,
}: {
  trigger: React.ReactNode;
  title: string;
  contas: Conta[];
  categorias: Categoria[];
  defaultValues?: Partial<typeof emptyForm>;
  onSubmit: (values: typeof emptyForm) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, ...defaultValues });

  const handleOpen = (v: boolean) => {
    if (v) setForm({ ...emptyForm, contaId: contas[0]?.id ?? "", ...defaultValues });
    setOpen(v);
  };

  const categoriasDoTipo = categorias.filter((c) => c.tipo === form.tipo);
  const valorNumero = Number(form.valor.replace(",", "."));
  const valido = form.contaId && form.descricao.trim().length >= 2 && valorNumero > 0 && form.data;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-muted">
            {(["ENTRADA", "SAIDA"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, tipo: t, categoriaId: "" }))}
                className={`h-9 rounded-md text-sm font-semibold transition-colors ${
                  form.tipo === t
                    ? t === "ENTRADA" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                    : "text-muted-foreground"
                }`}
              >
                {t === "ENTRADA" ? "Entrada" : "Saída"}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Descrição *</Label>
            <Input
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex: Pagamento fornecedor de vidro"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (R$) *</Label>
              <Input
                inputMode="decimal"
                value={form.valor}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Conta *</Label>
            <Select value={form.contaId} onValueChange={(v) => setForm((f) => ({ ...f, contaId: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>
                {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={form.categoriaId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, categoriaId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categoriasDoTipo.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!valido || isPending}
              onClick={() => { onSubmit({ ...form, valor: String(valorNumero) }); setOpen(false); }}
            >
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CaixaPage() {
  const qc = useQueryClient();
  const [filtros, setFiltros] = useState({ contaId: "", categoriaId: "", tipo: "", de: "", ate: "", busca: "" });
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Lancamento | null>(null);
  const limit = 20;

  const { data: contasData } = useQuery({
    queryKey: ["financeiro-contas"],
    queryFn: async () => (await axios.get("/api/financeiro/contas")).data.data as Conta[],
  });
  const { data: categoriasData } = useQuery({
    queryKey: ["financeiro-categorias"],
    queryFn: async () => (await axios.get("/api/financeiro/categorias")).data.data as Categoria[],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["financeiro-lancamentos", filtros, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filtros.contaId) params.set("contaId", filtros.contaId);
      if (filtros.categoriaId) params.set("categoriaId", filtros.categoriaId);
      if (filtros.tipo) params.set("tipo", filtros.tipo);
      if (filtros.de) params.set("de", filtros.de);
      if (filtros.ate) params.set("ate", filtros.ate);
      if (filtros.busca) params.set("busca", filtros.busca);
      const { data } = await axios.get(`/api/financeiro/lancamentos?${params}`);
      return data as { data: Lancamento[]; total: number };
    },
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["financeiro-lancamentos"] });
    qc.invalidateQueries({ queryKey: ["financeiro-dashboard"] });
    qc.invalidateQueries({ queryKey: ["financeiro-contas"] });
  }

  const createMutation = useMutation({
    mutationFn: (body: typeof emptyForm) => axios.post("/api/financeiro/lancamentos", { ...body, valor: Number(body.valor) }),
    onSuccess: () => { toast.success("Lançamento adicionado"); invalidar(); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Erro ao salvar"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & typeof emptyForm) =>
      axios.put(`/api/financeiro/lancamentos/${id}`, { ...body, valor: Number(body.valor) }),
    onSuccess: () => { toast.success("Lançamento atualizado"); invalidar(); },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/financeiro/lancamentos/${id}`),
    onSuccess: () => { toast.success("Lançamento excluído"); invalidar(); setDeleteTarget(null); },
    onError: () => toast.error("Erro ao excluir"),
  });

  const contas = contasData ?? [];
  const categorias = categoriasData ?? [];
  const lancamentos = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6" />
            Caixa
          </h2>
          <p className="text-muted-foreground">Entradas e saídas do dia a dia</p>
        </div>
        <LancamentoFormDialog
          title="Novo lançamento"
          contas={contas.filter((c) => c.ativa)}
          categorias={categorias}
          onSubmit={(values) => createMutation.mutate(values)}
          isPending={createMutation.isPending}
          trigger={
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" /> Novo lançamento
            </Button>
          }
        />
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={filtros.tipo || "todos"} onValueChange={(v) => { setFiltros((f) => ({ ...f, tipo: v === "todos" ? "" : v })); setPage(1); }}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ENTRADA">Entrada</SelectItem>
                <SelectItem value="SAIDA">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Conta</Label>
            <Select value={filtros.contaId || "todas"} onValueChange={(v) => { setFiltros((f) => ({ ...f, contaId: v === "todas" ? "" : v })); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <Select value={filtros.categoriaId || "todas"} onValueChange={(v) => { setFiltros((f) => ({ ...f, categoriaId: v === "todas" ? "" : v })); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <Input type="date" className="w-36" value={filtros.de} onChange={(e) => { setFiltros((f) => ({ ...f, de: e.target.value })); setPage(1); }} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <Input type="date" className="w-36" value={filtros.ate} onChange={(e) => { setFiltros((f) => ({ ...f, ate: e.target.value })); setPage(1); }} />
          </div>
          <div className="space-y-1.5 flex-1 min-w-[160px]">
            <Label className="text-xs">Buscar</Label>
            <Input placeholder="Descrição..." value={filtros.busca} onChange={(e) => { setFiltros((f) => ({ ...f, busca: e.target.value })); setPage(1); }} />
          </div>
        </div>
      </Card>

      {/* Lista */}
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
                <th className="p-3 w-16" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
              ) : lancamentos.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum lançamento encontrado</td></tr>
              ) : (
                lancamentos.map((l) => (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 whitespace-nowrap">{formatDate(l.data)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {l.tipo === "ENTRADA"
                          ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          : <ArrowDownRight className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                        {l.descricao}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{l.conta.nome}</td>
                    <td className="p-3 text-muted-foreground">{l.categoria?.nome ?? "—"}</td>
                    <td className={`p-3 text-right font-semibold tabular-nums ${l.tipo === "ENTRADA" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                      {l.tipo === "ENTRADA" ? "+" : "-"}{formatCurrency(Number(l.valor))}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <LancamentoFormDialog
                          title="Editar lançamento"
                          contas={contas.filter((c) => c.ativa || c.id === l.conta.id)}
                          categorias={categorias}
                          defaultValues={{
                            contaId: l.conta.id,
                            categoriaId: l.categoria?.id ?? "",
                            tipo: l.tipo,
                            descricao: l.descricao,
                            valor: String(Number(l.valor)),
                            data: l.data.slice(0, 10),
                          }}
                          onSubmit={(values) => updateMutation.mutate({ id: l.id, ...values })}
                          isPending={updateMutation.isPending}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button>
                          }
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => setDeleteTarget(l)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t">
            <p className="text-xs text-muted-foreground">{total} lançamento{total !== 1 ? "s" : ""}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.descricao}&quot; ({deleteTarget && formatCurrency(Number(deleteTarget.valor))}) será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
