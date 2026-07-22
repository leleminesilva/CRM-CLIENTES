"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, MoreVertical, Layers, Package, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";

type ModoCalculo = "AREA" | "LINEAR" | "UNIDADE";

const MODO_CALCULO_LABELS: Record<ModoCalculo, string> = {
  AREA: "Área (m²)",
  LINEAR: "Linear (m)",
  UNIDADE: "Unidade (fixo)",
};

interface Linha {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  _count: { produtos: number };
}

interface Produto {
  id: string;
  linhaId: string;
  nome: string;
  modoCalculo: ModoCalculo;
  precoBase: string;
  ordem: number;
  ativo: boolean;
  _count: { variantes: number };
}

interface Variante {
  id: string;
  produtoId: string;
  nome: string;
  categoria: string | null;
  precoUnitario: string;
  ordem: number;
  ativo: boolean;
}

// ── Linha ────────────────────────────────────────────────────────────────

const emptyLinhaForm = { nome: "", ordem: 0, ativo: true };

function LinhaFormDialog({
  trigger, title, defaultValues, onSubmit, isPending,
}: {
  trigger: React.ReactNode;
  title: string;
  defaultValues?: Partial<typeof emptyLinhaForm>;
  onSubmit: (values: typeof emptyLinhaForm) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyLinhaForm, ...defaultValues });

  const handleOpen = (v: boolean) => {
    if (v) setForm({ ...emptyLinhaForm, ...defaultValues });
    setOpen(v);
  };

  const valid = form.nome.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nome da linha *</Label>
            <Input
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value.toUpperCase() }))}
              placeholder="Ex: VIDROS"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Ativa</Label>
            <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => { onSubmit(form); setOpen(false); }} disabled={!valid || isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Produto ──────────────────────────────────────────────────────────────

const emptyProdutoForm = { nome: "", modoCalculo: "AREA" as ModoCalculo, precoBase: "0", ordem: 0, ativo: true };

function ProdutoFormDialog({
  trigger, title, defaultValues, onSubmit, isPending,
}: {
  trigger: React.ReactNode;
  title: string;
  defaultValues?: Partial<typeof emptyProdutoForm>;
  onSubmit: (values: typeof emptyProdutoForm) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyProdutoForm, ...defaultValues });

  const handleOpen = (v: boolean) => {
    if (v) setForm({ ...emptyProdutoForm, ...defaultValues });
    setOpen(v);
  };

  const valid = form.nome.trim().length >= 2 && !Number.isNaN(Number(form.precoBase));

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nome do produto *</Label>
            <Input
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: VIDROS COMUNS COLOCADOS"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Modo de cálculo *</Label>
            <Select value={form.modoCalculo} onValueChange={v => setForm(f => ({ ...f, modoCalculo: v as ModoCalculo }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(MODO_CALCULO_LABELS) as ModoCalculo[]).map(m => (
                  <SelectItem key={m} value={m}>{MODO_CALCULO_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {form.modoCalculo === "AREA" && "Preço calculado por m² (largura × altura do vão)."}
              {form.modoCalculo === "LINEAR" && "Preço calculado por metro linear (comprimento)."}
              {form.modoCalculo === "UNIDADE" && "Preço fixo, sem dimensão."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Preço base (R$)</Label>
            <Input
              type="number" min={0} step="0.01"
              value={form.precoBase}
              onChange={e => setForm(f => ({ ...f, precoBase: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Só é usado se o produto não tiver nenhuma variante cadastrada.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Label>Ativo</Label>
            <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => { onSubmit(form); setOpen(false); }} disabled={!valid || isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Variante ─────────────────────────────────────────────────────────────

const emptyVarianteForm = { nome: "", categoria: "", precoUnitario: "0", ordem: 0, ativo: true };

function VarianteFormDialog({
  trigger, title, defaultValues, onSubmit, isPending,
}: {
  trigger: React.ReactNode;
  title: string;
  defaultValues?: Partial<typeof emptyVarianteForm>;
  onSubmit: (values: typeof emptyVarianteForm) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyVarianteForm, ...defaultValues });

  const handleOpen = (v: boolean) => {
    if (v) setForm({ ...emptyVarianteForm, ...defaultValues });
    setOpen(v);
  };

  const valid = form.nome.trim().length >= 1 && !Number.isNaN(Number(form.precoUnitario));

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nome (SKU já combinado) *</Label>
            <Input
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: 6mm Temperado Liso"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria (opcional, só exibição)</Label>
            <Input
              value={form.categoria}
              onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              placeholder="Ex: ESPESSURA, COR..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Preço unitário (R$) *</Label>
            <Input
              type="number" min={0} step="0.01"
              value={form.precoUnitario}
              onChange={e => setForm(f => ({ ...f, precoUnitario: e.target.value }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Ativa</Label>
            <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => { onSubmit(form); setOpen(false); }} disabled={!valid || isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VariantesManagerDialog({ produto, open, onOpenChange }: {
  produto: Produto | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Variante | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["variantes-produto", produto?.id],
    queryFn: async () => {
      const { data } = await axios.get(`/api/orcamentos-tecnicos/variantes-produto?produtoId=${produto?.id}`);
      return data.data as Variante[];
    },
    enabled: open && !!produto,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["variantes-produto", produto?.id] });
    qc.invalidateQueries({ queryKey: ["produtos-catalogo"] });
  }

  const createMutation = useMutation({
    mutationFn: (values: typeof emptyVarianteForm) =>
      axios.post("/api/orcamentos-tecnicos/variantes-produto", {
        produtoId: produto?.id,
        nome: values.nome,
        categoria: values.categoria || undefined,
        precoUnitario: Number(values.precoUnitario),
      }),
    onSuccess: () => { toast.success("Variante criada"); invalidate(); },
    onError: () => toast.error("Erro ao criar variante"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...values }: { id: string } & Partial<typeof emptyVarianteForm>) =>
      axios.put(`/api/orcamentos-tecnicos/variantes-produto/${id}`, {
        ...values,
        precoUnitario: values.precoUnitario !== undefined ? Number(values.precoUnitario) : undefined,
      }),
    onSuccess: () => { toast.success("Variante atualizada"); invalidate(); },
    onError: () => toast.error("Erro ao atualizar variante"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/orcamentos-tecnicos/variantes-produto/${id}`),
    onSuccess: () => { toast.success("Variante removida"); invalidate(); setDeleteTarget(null); },
    onError: () => toast.error("Erro ao remover variante"),
  });

  const variantes = data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Variantes — {produto?.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <VarianteFormDialog
            title="Nova variante"
            trigger={
              <Button size="sm" className="w-full">
                <Plus className="w-4 h-4 mr-2" />Nova variante
              </Button>
            }
            onSubmit={values => createMutation.mutate(values)}
            isPending={createMutation.isPending}
          />

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : variantes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma variante cadastrada — o preço base do produto será usado.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {variantes.map(v => (
                <div key={v.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border bg-card">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {v.nome}
                      {v.categoria && <span className="text-muted-foreground font-normal"> · {v.categoria}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(Number(v.precoUnitario))}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!v.ativo && <Badge variant="secondary" className="text-xs">Inativa</Badge>}
                    <VarianteFormDialog
                      title="Editar variante"
                      defaultValues={{ nome: v.nome, categoria: v.categoria ?? "", precoUnitario: v.precoUnitario, ativo: v.ativo }}
                      trigger={<Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button>}
                      onSubmit={values => updateMutation.mutate({ id: v.id, ...values })}
                      isPending={updateMutation.isPending}
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => setDeleteTarget(v)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover variante?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{deleteTarget?.nome}</strong> não poderá mais ser escolhida em novos itens de orçamento.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ─────────────────────────────────────────────────────

export default function CatalogoPage() {
  const qc = useQueryClient();
  const [selectedLinhaId, setSelectedLinhaId] = useState<string | null>(null);
  const [deleteLinhaTarget, setDeleteLinhaTarget] = useState<Linha | null>(null);
  const [deleteProdutoTarget, setDeleteProdutoTarget] = useState<Produto | null>(null);
  const [variantesProduto, setVariantesProduto] = useState<Produto | null>(null);

  const { data: linhasData, isLoading: loadingLinhas } = useQuery({
    queryKey: ["linhas-produto"],
    queryFn: async () => {
      const { data } = await axios.get("/api/orcamentos-tecnicos/linhas-produto");
      return data.data as Linha[];
    },
  });

  const linhas = linhasData ?? [];
  const linhaAtual = linhas.find(l => l.id === selectedLinhaId) ?? linhas[0] ?? null;
  const linhaAtualId = linhaAtual?.id ?? null;

  const { data: produtosData, isLoading: loadingProdutos } = useQuery({
    queryKey: ["produtos-catalogo", linhaAtualId],
    queryFn: async () => {
      const { data } = await axios.get(`/api/orcamentos-tecnicos/produtos-catalogo?linhaId=${linhaAtualId}`);
      return data.data as Produto[];
    },
    enabled: !!linhaAtualId,
  });

  const produtos = produtosData ?? [];

  const createLinhaMutation = useMutation({
    mutationFn: (values: typeof emptyLinhaForm) => axios.post("/api/orcamentos-tecnicos/linhas-produto", values),
    onSuccess: (res) => {
      toast.success("Linha criada");
      qc.invalidateQueries({ queryKey: ["linhas-produto"] });
      setSelectedLinhaId(res.data.data.id);
    },
    onError: () => toast.error("Erro ao criar linha"),
  });

  const updateLinhaMutation = useMutation({
    mutationFn: ({ id, ...values }: { id: string } & Partial<typeof emptyLinhaForm>) =>
      axios.put(`/api/orcamentos-tecnicos/linhas-produto/${id}`, values),
    onSuccess: () => { toast.success("Linha atualizada"); qc.invalidateQueries({ queryKey: ["linhas-produto"] }); },
    onError: () => toast.error("Erro ao atualizar linha"),
  });

  const deleteLinhaMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/orcamentos-tecnicos/linhas-produto/${id}`),
    onSuccess: () => {
      toast.success("Linha removida");
      qc.invalidateQueries({ queryKey: ["linhas-produto"] });
      setDeleteLinhaTarget(null);
      setSelectedLinhaId(null);
    },
    onError: () => toast.error("Erro ao remover linha"),
  });

  const createProdutoMutation = useMutation({
    mutationFn: (values: typeof emptyProdutoForm) =>
      axios.post("/api/orcamentos-tecnicos/produtos-catalogo", { ...values, linhaId: linhaAtualId, precoBase: Number(values.precoBase) }),
    onSuccess: () => { toast.success("Produto criado"); qc.invalidateQueries({ queryKey: ["produtos-catalogo", linhaAtualId] }); qc.invalidateQueries({ queryKey: ["linhas-produto"] }); },
    onError: () => toast.error("Erro ao criar produto"),
  });

  const updateProdutoMutation = useMutation({
    mutationFn: ({ id, ...values }: { id: string } & Partial<typeof emptyProdutoForm>) =>
      axios.put(`/api/orcamentos-tecnicos/produtos-catalogo/${id}`, {
        ...values,
        precoBase: values.precoBase !== undefined ? Number(values.precoBase) : undefined,
      }),
    onSuccess: () => { toast.success("Produto atualizado"); qc.invalidateQueries({ queryKey: ["produtos-catalogo", linhaAtualId] }); },
    onError: () => toast.error("Erro ao atualizar produto"),
  });

  const deleteProdutoMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/orcamentos-tecnicos/produtos-catalogo/${id}`),
    onSuccess: () => {
      toast.success("Produto removido");
      qc.invalidateQueries({ queryKey: ["produtos-catalogo", linhaAtualId] });
      qc.invalidateQueries({ queryKey: ["linhas-produto"] });
      setDeleteProdutoTarget(null);
    },
    onError: () => toast.error("Erro ao remover produto"),
  });

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Catálogo</h2>
          <p className="text-sm text-muted-foreground">Linhas, produtos e variantes de preço do motor de orçamento</p>
        </div>
        <LinhaFormDialog
          title="Nova linha"
          trigger={<Button size="sm"><Plus className="w-4 h-4 mr-2" />Nova linha</Button>}
          onSubmit={values => createLinhaMutation.mutate(values)}
          isPending={createLinhaMutation.isPending}
        />
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        {/* Coluna: Linhas */}
        <Card className="p-2 overflow-y-auto">
          {loadingLinhas ? (
            <div className="space-y-2 p-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : linhas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center p-6">Nenhuma linha cadastrada</p>
          ) : (
            <div className="space-y-0.5">
              {linhas.map(l => (
                <div
                  key={l.id}
                  onClick={() => setSelectedLinhaId(l.id)}
                  className={cn(
                    "flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm",
                    l.id === linhaAtualId ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    !l.ativo && "opacity-50"
                  )}
                >
                  <span className="truncate font-medium">{l.nome}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={cn("text-xs", l.id === linhaAtualId ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {l._count.produtos}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className={cn("h-6 w-6", l.id === linhaAtualId && "hover:bg-primary-foreground/20")}>
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                        <LinhaFormDialog
                          title="Editar linha"
                          defaultValues={{ nome: l.nome, ordem: l.ordem, ativo: l.ativo }}
                          trigger={
                            <DropdownMenuItem onSelect={e => e.preventDefault()} className="cursor-pointer">
                              <Pencil className="w-4 h-4 mr-2" />Editar
                            </DropdownMenuItem>
                          }
                          onSubmit={values => updateLinhaMutation.mutate({ id: l.id, ...values })}
                          isPending={updateLinhaMutation.isPending}
                        />
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600 cursor-pointer" onSelect={() => setDeleteLinhaTarget(l)}>
                          <Trash2 className="w-4 h-4 mr-2" />Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Coluna: Produtos da linha selecionada */}
        <Card className="p-4 overflow-y-auto">
          {!linhaAtual ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2">
              <Layers className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Selecione uma linha à esquerda</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="font-semibold">{linhaAtual.nome}</h3>
                <ProdutoFormDialog
                  title="Novo produto"
                  trigger={<Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" />Novo produto</Button>}
                  onSubmit={values => createProdutoMutation.mutate(values)}
                  isPending={createProdutoMutation.isPending}
                />
              </div>

              {loadingProdutos ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}
                </div>
              ) : produtos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                  <Package className="w-10 h-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Nenhum produto cadastrado nesta linha</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {produtos.map(p => (
                    <div key={p.id} className={cn("flex items-center justify-between gap-3 p-3 rounded-lg border", !p.ativo && "opacity-50")}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.nome}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-xs">{MODO_CALCULO_LABELS[p.modoCalculo]}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {p._count.variantes > 0
                              ? `${p._count.variantes} variante(s)`
                              : `base: ${formatCurrency(Number(p.precoBase))}`}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => setVariantesProduto(p)}>
                          <Tag className="w-3.5 h-3.5 mr-1.5" />Variantes
                        </Button>
                        <ProdutoFormDialog
                          title="Editar produto"
                          defaultValues={{ nome: p.nome, modoCalculo: p.modoCalculo, precoBase: p.precoBase, ativo: p.ativo }}
                          trigger={<Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button>}
                          onSubmit={values => updateProdutoMutation.mutate({ id: p.id, ...values })}
                          isPending={updateProdutoMutation.isPending}
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => setDeleteProdutoTarget(p)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <VariantesManagerDialog
        produto={variantesProduto}
        open={!!variantesProduto}
        onOpenChange={v => !v && setVariantesProduto(null)}
      />

      <AlertDialog open={!!deleteLinhaTarget} onOpenChange={v => !v && setDeleteLinhaTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover linha?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteLinhaTarget?.nome}</strong> e seus produtos deixarão de aparecer no motor de orçamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteLinhaTarget && deleteLinhaMutation.mutate(deleteLinhaTarget.id)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteProdutoTarget} onOpenChange={v => !v && setDeleteProdutoTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover produto?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteProdutoTarget?.nome}</strong> e suas variantes deixarão de aparecer no motor de orçamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteProdutoTarget && deleteProdutoMutation.mutate(deleteProdutoTarget.id)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
