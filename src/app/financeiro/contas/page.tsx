"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Pencil, Archive, ArchiveRestore, Landmark, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/formatters";

interface Conta {
  id: string;
  nome: string;
  tipo: string;
  instituicao: string | null;
  saldoInicial: string;
  saldo: number;
  cor: string | null;
  ativa: boolean;
  _count: { lancamentos: number };
}

const TIPO_LABELS: Record<string, string> = {
  CAIXA: "Caixa",
  CORRENTE: "Conta corrente",
  POUPANCA: "Poupança",
  INVESTIMENTO: "Investimento",
  CARTAO: "Cartão",
};

const CORES = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#6b7280"];

const emptyForm = { nome: "", tipo: "CORRENTE", instituicao: "", saldoInicial: "0", cor: CORES[0] };

function ContaFormDialog({
  trigger, title, defaultValues, onSubmit, isPending,
}: {
  trigger: React.ReactNode;
  title: string;
  defaultValues?: Partial<typeof emptyForm>;
  onSubmit: (values: typeof emptyForm) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, ...defaultValues });

  const handleOpen = (v: boolean) => {
    if (v) setForm({ ...emptyForm, ...defaultValues });
    setOpen(v);
  };

  const valido = form.nome.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Conta Itaú PJ" />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Instituição</Label>
            <Input value={form.instituicao} onChange={(e) => setForm((f) => ({ ...f, instituicao: e.target.value }))} placeholder="Ex: Itaú, Nubank..." />
          </div>
          {!defaultValues && (
            <div className="space-y-1.5">
              <Label>Saldo inicial (R$)</Label>
              <Input inputMode="decimal" value={form.saldoInicial} onChange={(e) => setForm((f) => ({ ...f, saldoInicial: e.target.value }))} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {CORES.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, cor }))}
                  className={`w-7 h-7 rounded-full transition-transform ${form.cor === cor ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""}`}
                  style={{ background: cor }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!valido || isPending}
              onClick={() => {
                onSubmit({ ...form, saldoInicial: String(Number(form.saldoInicial.replace(",", ".")) || 0) });
                setOpen(false);
              }}
            >
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ContasPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["financeiro-contas", "todas"],
    queryFn: async () => (await axios.get("/api/financeiro/contas?todas=true")).data.data as Conta[],
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["financeiro-contas"] });
    qc.invalidateQueries({ queryKey: ["financeiro-dashboard"] });
  }

  const createMutation = useMutation({
    mutationFn: (body: typeof emptyForm) => axios.post("/api/financeiro/contas", { ...body, saldoInicial: Number(body.saldoInicial) }),
    onSuccess: () => { toast.success("Conta criada"); invalidar(); },
    onError: () => toast.error("Erro ao criar conta"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<typeof emptyForm & { ativa: boolean }>) =>
      axios.put(`/api/financeiro/contas/${id}`, body),
    onSuccess: () => { toast.success("Conta atualizada"); invalidar(); },
    onError: () => toast.error("Erro ao atualizar conta"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/financeiro/contas/${id}`),
    onSuccess: (res) => {
      toast.success(res.data?.arquivada ? "Conta arquivada (já tinha lançamentos)" : "Conta excluída");
      invalidar();
    },
    onError: () => toast.error("Erro ao excluir conta"),
  });

  const contas = data ?? [];
  const ativas = contas.filter((c) => c.ativa);
  const arquivadas = contas.filter((c) => !c.ativa);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="w-6 h-6" />
            Contas
          </h2>
          <p className="text-muted-foreground">Contas de banco e caixa usadas nos lançamentos</p>
        </div>
        <ContaFormDialog
          title="Nova conta"
          onSubmit={(values) => createMutation.mutate(values)}
          isPending={createMutation.isPending}
          trigger={<Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-2" /> Nova conta</Button>}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ativas.map((c) => (
              <Card key={c.id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.cor || "#10b981" }} />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{c.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {TIPO_LABELS[c.tipo] ?? c.tipo}{c.instituicao ? ` · ${c.instituicao}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <ContaFormDialog
                      title="Editar conta"
                      defaultValues={{ nome: c.nome, tipo: c.tipo, instituicao: c.instituicao ?? "", cor: c.cor ?? CORES[0] }}
                      onSubmit={(values) => updateMutation.mutate({ id: c.id, nome: values.nome, tipo: values.tipo, instituicao: values.instituicao, cor: values.cor })}
                      isPending={updateMutation.isPending}
                      trigger={<Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button>}
                    />
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
                      title={c._count.lancamentos > 0 ? "Arquivar" : "Excluir"}
                      onClick={() => deleteMutation.mutate(c.id)}
                    >
                      {c._count.lancamentos > 0 ? <Archive className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
                <p className={`text-2xl font-bold mt-4 tabular-nums ${c.saldo < 0 ? "text-red-500" : ""}`}>{formatCurrency(c.saldo)}</p>
                <p className="text-xs text-muted-foreground mt-1">{c._count.lancamentos} lançamento{c._count.lancamentos !== 1 ? "s" : ""}</p>
              </Card>
            ))}
            {ativas.length === 0 && (
              <Card className="p-8 text-center col-span-full text-muted-foreground">Nenhuma conta ativa — crie uma pra começar a lançar.</Card>
            )}
          </div>

          {arquivadas.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 text-sm text-muted-foreground">Arquivadas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {arquivadas.map((c) => (
                  <Card key={c.id} className="p-5 opacity-60">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.cor || "#6b7280" }} />
                        <p className="font-semibold text-sm truncate">{c.nome}</p>
                        <Badge variant="secondary" className="text-xs">Arquivada</Badge>
                      </div>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                        title="Reativar"
                        onClick={() => updateMutation.mutate({ id: c.id, ativa: true })}
                      >
                        <ArchiveRestore className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <p className="text-lg font-semibold mt-3 tabular-nums">{formatCurrency(c.saldo)}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
