"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
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
import {
  calcularItem, calcularOrcamento, dimensaoValidaParaModo, type ModoCalculo,
} from "@/lib/orcamentosTecnicos/calc";

interface LinhaOption { id: string; nome: string; }
interface ProdutoOption { id: string; linhaId: string; nome: string; modoCalculo: ModoCalculo; precoBase: string; }
interface VarianteOption { id: string; produtoId: string; nome: string; categoria: string | null; precoUnitario: string; }
interface ClienteOption { id: string; nome: string; }
interface UsuarioOption { id: string; nome: string; }

export interface ItemFormValue {
  produtoId: string;
  varianteId: string | null;
  larguraMm: number | null;
  alturaMm: number | null;
  comprimentoMm: number | null;
  quantidade: number;
  ambienteInstalacao: string;
  descricao: string;
  acrescimoValor: number;
  ordem: number;
  linhaNome: string;
  produtoNome: string;
  varianteNome: string | null;
  modoCalculo: ModoCalculo;
  precoCalculado: number;
  totalItem: number;
}

export interface OrcamentoFormInitial {
  id: string;
  numero: number;
  clienteId: string | null;
  responsavelId: string | null;
  bairroInstalacao: string | null;
  enderecoInstalacao: string | null;
  observacoes: string | null;
  descontoPercentual: string | null;
  descontoValor: string | null;
  itens: {
    produtoId: string;
    varianteId: string | null;
    larguraMm: number | null;
    alturaMm: number | null;
    comprimentoMm: number | null;
    quantidade: number;
    ambienteInstalacao: string | null;
    descricao: string | null;
    acrescimoValor: string;
    precoCalculado: string;
    totalItem: string;
    ordem: number;
    produto: { nome: string; modoCalculo: ModoCalculo; linha: { nome: string } };
    variante: { nome: string } | null;
  }[];
}

function formatDimensao(item: Pick<ItemFormValue, "modoCalculo" | "larguraMm" | "alturaMm" | "comprimentoMm" | "quantidade">) {
  if (item.modoCalculo === "AREA") return `${item.larguraMm}×${item.alturaMm}mm · qtd ${item.quantidade}`;
  if (item.modoCalculo === "LINEAR") return `${item.comprimentoMm}mm · qtd ${item.quantidade}`;
  return `qtd ${item.quantidade}`;
}

// ── Dialog de item (adicionar/editar) ───────────────────────────────────

function ItemDialog({
  open, onOpenChange, onConfirm, initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (item: ItemFormValue) => void;
  initial?: ItemFormValue | null;
}) {
  const [linhaId, setLinhaId] = useState<string | null>(null);
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [varianteId, setVarianteId] = useState<string | null>(null);
  const [larguraMm, setLarguraMm] = useState("");
  const [alturaMm, setAlturaMm] = useState("");
  const [comprimentoMm, setComprimentoMm] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [ambienteInstalacao, setAmbienteInstalacao] = useState("");
  const [descricao, setDescricao] = useState("");
  const [acrescimoValor, setAcrescimoValor] = useState("0");

  const { data: linhas = [] } = useQuery({
    queryKey: ["linhas-produto"],
    queryFn: async () => { const { data } = await axios.get("/api/orcamentos-tecnicos/linhas-produto"); return data.data as (LinhaOption & { ativo: boolean })[]; },
    enabled: open,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-catalogo", linhaId],
    queryFn: async () => { const { data } = await axios.get(`/api/orcamentos-tecnicos/produtos-catalogo?linhaId=${linhaId}`); return data.data as (ProdutoOption & { ativo: boolean })[]; },
    enabled: open && !!linhaId,
  });

  const { data: variantes = [] } = useQuery({
    queryKey: ["variantes-produto", produtoId],
    queryFn: async () => { const { data } = await axios.get(`/api/orcamentos-tecnicos/variantes-produto?produtoId=${produtoId}`); return data.data as (VarianteOption & { ativo: boolean })[]; },
    enabled: open && !!produtoId,
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const linha = linhas.find(l => l.nome === initial.linhaNome);
      setLinhaId(linha?.id ?? null);
      setProdutoId(initial.produtoId);
      setVarianteId(initial.varianteId);
      setLarguraMm(initial.larguraMm != null ? String(initial.larguraMm) : "");
      setAlturaMm(initial.alturaMm != null ? String(initial.alturaMm) : "");
      setComprimentoMm(initial.comprimentoMm != null ? String(initial.comprimentoMm) : "");
      setQuantidade(String(initial.quantidade));
      setAmbienteInstalacao(initial.ambienteInstalacao);
      setDescricao(initial.descricao);
      setAcrescimoValor(String(initial.acrescimoValor));
    } else {
      setLinhaId(null);
      setProdutoId(null);
      setVarianteId(null);
      setLarguraMm("");
      setAlturaMm("");
      setComprimentoMm("");
      setQuantidade("1");
      setAmbienteInstalacao("");
      setDescricao("");
      setAcrescimoValor("0");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const produtoSelecionado = produtos.find(p => p.id === produtoId);
  const varianteSelecionada = variantes.find(v => v.id === varianteId);
  const precoVariante = varianteSelecionada ? Number(varianteSelecionada.precoUnitario) : null;

  const preview = produtoSelecionado
    ? calcularItem({
        modoCalculo: produtoSelecionado.modoCalculo,
        precoBase: Number(produtoSelecionado.precoBase),
        precoVariante,
        larguraMm: Number(larguraMm) || null,
        alturaMm: Number(alturaMm) || null,
        comprimentoMm: Number(comprimentoMm) || null,
        quantidade: Number(quantidade) || 1,
        acrescimoValor: Number(acrescimoValor) || 0,
      })
    : { precoCalculado: 0, totalItem: 0 };

  const dimensaoOk = produtoSelecionado
    ? dimensaoValidaParaModo(produtoSelecionado.modoCalculo, Number(larguraMm) || null, Number(alturaMm) || null, Number(comprimentoMm) || null)
    : false;
  const valid = !!produtoSelecionado && dimensaoOk && Number(quantidade) >= 1;

  function handleConfirm() {
    if (!produtoSelecionado) return;
    const linha = linhas.find(l => l.id === linhaId);
    onConfirm({
      produtoId: produtoSelecionado.id,
      varianteId,
      larguraMm: Number(larguraMm) || null,
      alturaMm: Number(alturaMm) || null,
      comprimentoMm: Number(comprimentoMm) || null,
      quantidade: Number(quantidade) || 1,
      ambienteInstalacao,
      descricao,
      acrescimoValor: Number(acrescimoValor) || 0,
      ordem: 0,
      linhaNome: linha?.nome ?? "",
      produtoNome: produtoSelecionado.nome,
      varianteNome: varianteSelecionada?.nome ?? null,
      modoCalculo: produtoSelecionado.modoCalculo,
      precoCalculado: preview.precoCalculado,
      totalItem: preview.totalItem,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Editar item" : "Adicionar item"}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Linha *</Label>
            <Select value={linhaId ?? undefined} onValueChange={v => { setLinhaId(v); setProdutoId(null); setVarianteId(null); }}>
              <SelectTrigger><SelectValue placeholder="Selecione a linha" /></SelectTrigger>
              <SelectContent>
                {linhas.filter(l => l.ativo).map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {linhaId && (
            <div className="space-y-1.5">
              <Label>Produto *</Label>
              <Select value={produtoId ?? undefined} onValueChange={v => { setProdutoId(v); setVarianteId(null); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                <SelectContent>
                  {produtos.filter(p => p.ativo).map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {produtos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum produto cadastrado nessa linha ainda.</p>}
            </div>
          )}

          {produtoSelecionado?.modoCalculo === "AREA" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Largura do vão (mm) *</Label><Input type="number" min={0} value={larguraMm} onChange={e => setLarguraMm(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Altura do vão (mm) *</Label><Input type="number" min={0} value={alturaMm} onChange={e => setAlturaMm(e.target.value)} /></div>
            </div>
          )}
          {produtoSelecionado?.modoCalculo === "LINEAR" && (
            <div className="space-y-1.5"><Label>Comprimento (mm) *</Label><Input type="number" min={0} value={comprimentoMm} onChange={e => setComprimentoMm(e.target.value)} /></div>
          )}

          {produtoSelecionado && variantes.length > 0 && (
            <div className="space-y-1.5">
              <Label>Variante {precoVariante == null && "(nenhuma selecionada — usa preço base)"}</Label>
              <div className="flex flex-wrap gap-2">
                {variantes.filter(v => v.ativo).map(v => (
                  <button
                    key={v.id} type="button" onClick={() => setVarianteId(id => id === v.id ? null : v.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-sm transition-colors",
                      varianteId === v.id ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
                    )}
                  >
                    {v.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {produtoSelecionado && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Quantidade</Label><Input type="number" min={1} value={quantidade} onChange={e => setQuantidade(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Acréscimo (R$)</Label><Input type="number" min={0} step="0.01" value={acrescimoValor} onChange={e => setAcrescimoValor(e.target.value)} /></div>
              </div>
              <div className="space-y-1.5">
                <Label>Ambiente da instalação (opcional)</Label>
                <Input value={ambienteInstalacao} onChange={e => setAmbienteInstalacao(e.target.value)} placeholder="Ex: Sala, Cozinha..." />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição (opcional)</Label>
                <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} />
              </div>
              <div className="rounded-lg border p-3 bg-muted/30 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total do item</span>
                <span className="font-semibold text-base">{formatCurrency(preview.totalItem)}</span>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={!valid}>{initial ? "Salvar item" : "Adicionar"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Formulário principal ─────────────────────────────────────────────────

function mapItensFromInitial(itens: OrcamentoFormInitial["itens"]): ItemFormValue[] {
  return itens.map(it => ({
    produtoId: it.produtoId,
    varianteId: it.varianteId,
    larguraMm: it.larguraMm,
    alturaMm: it.alturaMm,
    comprimentoMm: it.comprimentoMm,
    quantidade: it.quantidade,
    ambienteInstalacao: it.ambienteInstalacao ?? "",
    descricao: it.descricao ?? "",
    acrescimoValor: Number(it.acrescimoValor),
    ordem: it.ordem,
    linhaNome: it.produto.linha.nome,
    produtoNome: it.produto.nome,
    varianteNome: it.variante?.nome ?? null,
    modoCalculo: it.produto.modoCalculo,
    precoCalculado: Number(it.precoCalculado),
    totalItem: Number(it.totalItem),
  }));
}

export function OrcamentoForm({ mode, orcamentoId, initialData }: {
  mode: "create" | "edit";
  orcamentoId?: string;
  initialData?: OrcamentoFormInitial;
}) {
  const router = useRouter();
  const qc = useQueryClient();

  const [clienteId, setClienteId] = useState<string | null>(initialData?.clienteId ?? null);
  const [responsavelId, setResponsavelId] = useState<string | null>(initialData?.responsavelId ?? null);
  const [bairroInstalacao, setBairroInstalacao] = useState(initialData?.bairroInstalacao ?? "");
  const [enderecoInstalacao, setEnderecoInstalacao] = useState(initialData?.enderecoInstalacao ?? "");
  const [observacoes, setObservacoes] = useState(initialData?.observacoes ?? "");
  const [descontoTipo, setDescontoTipo] = useState<"nenhum" | "percentual" | "valor">(
    initialData?.descontoPercentual ? "percentual" : initialData?.descontoValor ? "valor" : "nenhum"
  );
  const [descontoPercentual, setDescontoPercentual] = useState(initialData?.descontoPercentual ?? "");
  const [descontoValor, setDescontoValor] = useState(initialData?.descontoValor ?? "");
  const [itens, setItens] = useState<ItemFormValue[]>(initialData ? mapItensFromInitial(initialData.itens) : []);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [deleteItemIndex, setDeleteItemIndex] = useState<number | null>(null);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-select"],
    queryFn: async () => { const { data } = await axios.get("/api/clientes?limit=100"); return data.data as ClienteOption[]; },
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios-select"],
    queryFn: async () => { const { data } = await axios.get("/api/usuarios"); return data.data as UsuarioOption[]; },
  });

  const totais = useMemo(
    () => calcularOrcamento(
      itens.map(i => i.totalItem),
      descontoTipo === "percentual" ? Number(descontoPercentual) || 0 : null,
      descontoTipo === "valor" ? Number(descontoValor) || 0 : null
    ),
    [itens, descontoTipo, descontoPercentual, descontoValor]
  );

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      mode === "create"
        ? axios.post("/api/orcamentos-tecnicos/orcamentos", payload)
        : axios.put(`/api/orcamentos-tecnicos/orcamentos/${orcamentoId}`, payload),
    onSuccess: (res) => {
      toast.success(mode === "create" ? "Orçamento criado" : "Orçamento atualizado");
      qc.invalidateQueries({ queryKey: ["orcamentos-tecnicos"] });
      router.push(`/orcamentos-tecnicos/orcamentos/${res.data.data.id}`);
    },
    onError: (e: unknown) => {
      const msg = axios.isAxiosError(e) ? e.response?.data?.error : undefined;
      toast.error(msg || "Erro ao salvar orçamento");
    },
  });

  function handleSave() {
    saveMutation.mutate({
      clienteId,
      responsavelId,
      bairroInstalacao: bairroInstalacao || undefined,
      enderecoInstalacao: enderecoInstalacao || undefined,
      observacoes: observacoes || undefined,
      descontoPercentual: descontoTipo === "percentual" ? Number(descontoPercentual) || 0 : null,
      descontoValor: descontoTipo === "valor" ? Number(descontoValor) || 0 : null,
      itens: itens.map((it, idx) => ({
        produtoId: it.produtoId,
        varianteId: it.varianteId,
        larguraMm: it.larguraMm,
        alturaMm: it.alturaMm,
        comprimentoMm: it.comprimentoMm,
        quantidade: it.quantidade,
        ambienteInstalacao: it.ambienteInstalacao || undefined,
        descricao: it.descricao || undefined,
        acrescimoValor: it.acrescimoValor,
        ordem: idx,
      })),
    });
  }

  function handleConfirmItem(item: ItemFormValue) {
    if (editingItemIndex !== null) {
      setItens(prev => prev.map((it, i) => (i === editingItemIndex ? item : it)));
    } else {
      setItens(prev => [...prev, item]);
    }
    setItemDialogOpen(false);
    setEditingItemIndex(null);
  }

  return (
    <div className="space-y-4 pb-24">
      <Card className="p-4 space-y-4">
        <h3 className="font-semibold">Dados gerais</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={clienteId ?? "none"} onValueChange={v => setClienteId(v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Sem cliente vinculado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem cliente vinculado</SelectItem>
                {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Select value={responsavelId ?? "none"} onValueChange={v => setResponsavelId(v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {usuarios.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Bairro de instalação</Label>
            <Input value={bairroInstalacao} onChange={e => setBairroInstalacao(e.target.value)} placeholder="Ex: Centro" />
          </div>
          <div className="space-y-1.5">
            <Label>Endereço de instalação</Label>
            <Input value={enderecoInstalacao} onChange={e => setEnderecoInstalacao(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Observações</Label>
          <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Itens</h3>
          <Button size="sm" onClick={() => { setEditingItemIndex(null); setItemDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />Adicionar item
          </Button>
        </div>

        {itens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <FileText className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Clique em &quot;Adicionar item&quot; para começar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {itens.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.produtoNome}
                    {item.varianteNome && <span className="text-muted-foreground font-normal"> · {item.varianteNome}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.linhaNome} · {formatDimensao(item)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold">{formatCurrency(item.totalItem)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingItemIndex(idx); setItemDialogOpen(true); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => setDeleteItemIndex(idx)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Desconto e total</h3>
        <div className="flex items-center gap-2">
          {(["nenhum", "percentual", "valor"] as const).map(t => (
            <button
              key={t} type="button" onClick={() => setDescontoTipo(t)}
              className={cn(
                "px-3 py-1.5 rounded-lg border text-sm",
                descontoTipo === t ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
              )}
            >
              {t === "nenhum" ? "Sem desconto" : t === "percentual" ? "Percentual (%)" : "Valor (R$)"}
            </button>
          ))}
          {descontoTipo === "percentual" && (
            <Input className="max-w-[140px]" type="number" min={0} max={100} value={descontoPercentual} onChange={e => setDescontoPercentual(e.target.value)} />
          )}
          {descontoTipo === "valor" && (
            <Input className="max-w-[140px]" type="number" min={0} step="0.01" value={descontoValor} onChange={e => setDescontoValor(e.target.value)} />
          )}
        </div>
        <div className="pt-2 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(totais.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span className="text-red-600">- {formatCurrency(totais.desconto)}</span></div>
          <div className="flex justify-between text-base font-bold pt-1 border-t"><span>Total</span><span>{formatCurrency(totais.valorTotal)}</span></div>
        </div>
      </Card>

      <div className="fixed bottom-0 left-0 right-0 md:left-auto md:right-6 md:bottom-6 md:w-auto p-4 md:p-0 bg-background md:bg-transparent border-t md:border-0 flex justify-end">
        <Button size="lg" onClick={handleSave} disabled={saveMutation.isPending || itens.length === 0}>
          {saveMutation.isPending ? "Salvando..." : "Salvar orçamento"}
        </Button>
      </div>

      <ItemDialog
        open={itemDialogOpen}
        onOpenChange={v => { setItemDialogOpen(v); if (!v) setEditingItemIndex(null); }}
        onConfirm={handleConfirmItem}
        initial={editingItemIndex !== null ? itens[editingItemIndex] : null}
      />

      <AlertDialog open={deleteItemIndex !== null} onOpenChange={v => !v && setDeleteItemIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita depois de salvar o orçamento.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteItemIndex !== null) setItens(prev => prev.filter((_, i) => i !== deleteItemIndex));
                setDeleteItemIndex(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
