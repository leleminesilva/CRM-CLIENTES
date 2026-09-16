"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import {
  Car, Settings, Users, Pencil, Trash2, ArchiveRestore,
  LogOut, LogIn, Clock, Gauge, ChevronLeft, ChevronRight, Fuel,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatDateTime, formatCurrency } from "@/lib/utils/formatters";

interface Carro {
  id: string; numero: string; modelo: string; ano: number; placa: string; cor: string | null;
  ativo: boolean; totalUsos: number; kmAtual: number | null;
  usoAtual: { id: string; motorista: { id: string; nome: string }; kmSaida: number; saidaEm: string; valorCombustivel: string | null } | null;
}
interface Motorista { id: string; nome: string; telefone: string | null; ativo: boolean; _count: { usos: number } }
interface Uso {
  id: string; kmSaida: number; saidaEm: string; kmChegada: number | null; chegadaEm: string | null; observacoes: string | null;
  valorCombustivel: string | null;
  carro: { id: string; numero: string; modelo: string; placa: string };
  motorista: { id: string; nome: string };
  registradoPor: { id: string; nome: string } | null;
}
interface ContaFinanceira { id: string; nome: string; tipo: string; ativa: boolean }

// Formata pro valor que <input type="datetime-local"> espera, em horário local
// (não UTC) — é assim que o navegador interpreta esse tipo de input.
function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function useCarros() {
  return useQuery({
    queryKey: ["financeiro-carros"],
    queryFn: async () => (await axios.get("/api/financeiro/carros")).data.data as Carro[],
  });
}
function useMotoristas() {
  return useQuery({
    queryKey: ["financeiro-motoristas"],
    queryFn: async () => (await axios.get("/api/financeiro/motoristas")).data.data as Motorista[],
  });
}
// Listas completas (incluindo arquivados) pra permitir filtrar o histórico por
// um carro/motorista que já foi excluído/arquivado depois de ter uso registrado.
function useCarrosTodos() {
  return useQuery({
    queryKey: ["financeiro-carros", "todos"],
    queryFn: async () => (await axios.get("/api/financeiro/carros?todos=true")).data.data as Carro[],
  });
}
function useMotoristasTodos() {
  return useQuery({
    queryKey: ["financeiro-motoristas", "todos"],
    queryFn: async () => (await axios.get("/api/financeiro/motoristas?todos=true")).data.data as Motorista[],
  });
}
function useContasFinanceiro() {
  return useQuery({
    queryKey: ["financeiro-contas"],
    queryFn: async () => (await axios.get("/api/financeiro/contas")).data.data as ContaFinanceira[],
  });
}

// ── Cadastro de carros (ícone no canto) ─────────────────────────────────
const emptyCarroForm = { numero: "", modelo: "", ano: String(new Date().getFullYear()), placa: "", cor: "#10b981" };
const CORES = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#6b7280", "#111827", "#ffffff"];

function GerenciarCarrosDialog() {
  const qc = useQueryClient();
  const { data: carros } = useCarros();
  const [form, setForm] = useState(emptyCarroForm);
  const [editId, setEditId] = useState<string | null>(null);

  function invalidar() { qc.invalidateQueries({ queryKey: ["financeiro-carros"] }); }

  const createMutation = useMutation({
    mutationFn: (body: typeof emptyCarroForm) => axios.post("/api/financeiro/carros", { ...body, ano: Number(body.ano) }),
    onSuccess: () => { toast.success("Carro cadastrado"); invalidar(); setForm(emptyCarroForm); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Erro ao cadastrar"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<typeof emptyCarroForm & { ativo: boolean }>) =>
      axios.put(`/api/financeiro/carros/${id}`, "ano" in body && body.ano ? { ...body, ano: Number(body.ano) } : body),
    onSuccess: () => { toast.success("Carro atualizado"); invalidar(); setEditId(null); setForm(emptyCarroForm); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Erro ao atualizar"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/financeiro/carros/${id}`),
    onSuccess: (res) => { toast.success(res.data?.arquivado ? "Carro arquivado (já tinha uso registrado)" : "Carro excluído"); invalidar(); },
    onError: () => toast.error("Erro ao excluir"),
  });

  const valido = form.numero.trim() && form.modelo.trim().length >= 2 && form.placa.trim().length >= 6 && Number(form.ano) > 1950;

  function iniciarEdicao(c: Carro) {
    setEditId(c.id);
    setForm({ numero: c.numero, modelo: c.modelo, ano: String(c.ano), placa: c.placa, cor: c.cor || CORES[0] });
  }
  function cancelarEdicao() { setEditId(null); setForm(emptyCarroForm); }

  return (
    <Dialog onOpenChange={(v) => !v && cancelarEdicao()}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Cadastrar carros"><Car className="w-4 h-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Carros da empresa</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">Número *</Label><Input value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} placeholder="Ex: 01" /></div>
            <div className="space-y-1"><Label className="text-xs">Ano *</Label><Input inputMode="numeric" value={form.ano} onChange={(e) => setForm((f) => ({ ...f, ano: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Modelo *</Label><Input value={form.modelo} onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))} placeholder="Ex: Fiat Fiorino" /></div>
            <div className="space-y-1"><Label className="text-xs">Placa *</Label><Input value={form.placa} onChange={(e) => setForm((f) => ({ ...f, placa: e.target.value.toUpperCase() }))} placeholder="ABC1D23" /></div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {CORES.map((cor) => (
                <button key={cor} type="button" onClick={() => setForm((f) => ({ ...f, cor }))}
                  className={`w-6 h-6 rounded-full border ${form.cor === cor ? "ring-2 ring-offset-1 ring-foreground" : ""}`}
                  style={{ background: cor }} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {editId && <Button variant="ghost" size="sm" onClick={cancelarEdicao}>Cancelar edição</Button>}
            <Button
              size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={!valido || createMutation.isPending || updateMutation.isPending}
              onClick={() => editId ? updateMutation.mutate({ id: editId, ...form }) : createMutation.mutate(form)}
            >
              {editId ? "Salvar alterações" : "Adicionar carro"}
            </Button>
          </div>

          <div className="border-t pt-3 space-y-2 max-h-72 overflow-y-auto">
            {(carros ?? []).map((c) => (
              <div key={c.id} className={`flex items-center justify-between gap-2 p-2 rounded-lg ${!c.ativo ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 border" style={{ background: c.cor || "#10b981" }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.numero} · {c.modelo} ({c.ano})</p>
                    <p className="text-xs text-muted-foreground">{c.placa}{!c.ativo ? " · arquivado" : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => iniciarEdicao(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                  {c.ativo ? (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteMutation.mutate(c.id)}>
                      {c.totalUsos > 0 ? <ArchiveRestore className="w-3.5 h-3.5 rotate-180" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Reativar" onClick={() => updateMutation.mutate({ id: c.id, ativo: true })}>
                      <ArchiveRestore className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {(carros ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum carro cadastrado ainda</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Cadastro de motoristas (ícone no canto) ─────────────────────────────
const emptyMotoristaForm = { nome: "", telefone: "" };

function GerenciarMotoristasDialog() {
  const qc = useQueryClient();
  const { data: motoristas } = useMotoristas();
  const [form, setForm] = useState(emptyMotoristaForm);
  const [editId, setEditId] = useState<string | null>(null);

  function invalidar() { qc.invalidateQueries({ queryKey: ["financeiro-motoristas"] }); }

  const createMutation = useMutation({
    mutationFn: (body: typeof emptyMotoristaForm) => axios.post("/api/financeiro/motoristas", body),
    onSuccess: () => { toast.success("Motorista cadastrado"); invalidar(); setForm(emptyMotoristaForm); },
    onError: () => toast.error("Erro ao cadastrar"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<typeof emptyMotoristaForm & { ativo: boolean }>) =>
      axios.put(`/api/financeiro/motoristas/${id}`, body),
    onSuccess: () => { toast.success("Motorista atualizado"); invalidar(); setEditId(null); setForm(emptyMotoristaForm); },
    onError: () => toast.error("Erro ao atualizar"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/financeiro/motoristas/${id}`),
    onSuccess: (res) => { toast.success(res.data?.arquivado ? "Motorista arquivado (já tinha uso registrado)" : "Motorista excluído"); invalidar(); },
    onError: () => toast.error("Erro ao excluir"),
  });

  const valido = form.nome.trim().length >= 2;

  function iniciarEdicao(m: Motorista) { setEditId(m.id); setForm({ nome: m.nome, telefone: m.telefone ?? "" }); }
  function cancelarEdicao() { setEditId(null); setForm(emptyMotoristaForm); }

  return (
    <Dialog onOpenChange={(v) => !v && cancelarEdicao()}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Cadastrar motoristas"><Users className="w-4 h-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Motoristas</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">Nome *</Label><Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: João Silva" /></div>
            <div className="space-y-1"><Label className="text-xs">Telefone</Label><Input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" /></div>
          </div>
          <div className="flex justify-end gap-2">
            {editId && <Button variant="ghost" size="sm" onClick={cancelarEdicao}>Cancelar edição</Button>}
            <Button
              size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={!valido || createMutation.isPending || updateMutation.isPending}
              onClick={() => editId ? updateMutation.mutate({ id: editId, ...form }) : createMutation.mutate(form)}
            >
              {editId ? "Salvar alterações" : "Adicionar motorista"}
            </Button>
          </div>

          <div className="border-t pt-3 space-y-2 max-h-72 overflow-y-auto">
            {(motoristas ?? []).map((m) => (
              <div key={m.id} className={`flex items-center justify-between gap-2 p-2 rounded-lg ${!m.ativo ? "opacity-50" : ""}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.nome}</p>
                  <p className="text-xs text-muted-foreground">{m.telefone || "sem telefone"}{!m.ativo ? " · arquivado" : ""}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => iniciarEdicao(m)}><Pencil className="w-3.5 h-3.5" /></Button>
                  {m.ativo ? (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteMutation.mutate(m.id)}>
                      {m._count.usos > 0 ? <ArchiveRestore className="w-3.5 h-3.5 rotate-180" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Reativar" onClick={() => updateMutation.mutate({ id: m.id, ativo: true })}>
                      <ArchiveRestore className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {(motoristas ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum motorista cadastrado ainda</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Registrar saída ──────────────────────────────────────────────────────
function SaidaDialog({ carro }: { carro: Carro }) {
  const qc = useQueryClient();
  const { data: motoristas } = useMotoristas();
  const { data: contas } = useContasFinanceiro();
  const [open, setOpen] = useState(false);
  const [motoristaId, setMotoristaId] = useState("");
  const [km, setKm] = useState("");
  const [obs, setObs] = useState("");
  const [valorGas, setValorGas] = useState("");
  const [contaGasId, setContaGasId] = useState("");
  const [saidaEmInput, setSaidaEmInput] = useState(() => toDatetimeLocalValue(new Date()));

  // Sempre que o diálogo abre, começa com "agora" — mas quem registra pode
  // voltar pro horário real em que o carro saiu (ela chega depois do carro).
  useEffect(() => {
    if (open) setSaidaEmInput(toDatetimeLocalValue(new Date()));
  }, [open]);

  // Assim que o valor da gasolina é preenchido, já pré-seleciona a conta Caixa
  // (de onde o dinheiro físico normalmente sai) pra evitar um clique a mais.
  useEffect(() => {
    if (valorGas && !contaGasId && contas?.length) {
      setContaGasId(contas.find((c) => c.tipo === "CAIXA")?.id ?? contas[0].id);
    }
  }, [valorGas, contaGasId, contas]);

  const mutation = useMutation({
    mutationFn: () => axios.post("/api/financeiro/carros/usos", {
      carroId: carro.id,
      motoristaId,
      kmSaida: Number(km),
      saidaEm: saidaEmInput ? new Date(saidaEmInput).toISOString() : undefined,
      observacoes: obs || undefined,
      valorCombustivel: valorGas ? Number(valorGas) : undefined,
      contaCombustivelId: valorGas ? contaGasId : undefined,
    }),
    onSuccess: () => {
      toast.success(`Saída registrada — ${carro.numero} com ${motoristas?.find((m) => m.id === motoristaId)?.nome}`);
      qc.invalidateQueries({ queryKey: ["financeiro-carros"] });
      qc.invalidateQueries({ queryKey: ["financeiro-carro-usos"] });
      qc.invalidateQueries({ queryKey: ["financeiro-contas"] });
      setOpen(false); setMotoristaId(""); setKm(""); setObs(""); setValorGas(""); setContaGasId("");
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Erro ao registrar saída"),
  });

  const invalido = !motoristaId || !km || !saidaEmInput || (!!valorGas && !contaGasId) || mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 w-full"><LogOut className="w-3.5 h-3.5 mr-1.5" /> Registrar saída</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Saída — {carro.numero} · {carro.modelo}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Motorista *</Label>
            <Select value={motoristaId} onValueChange={setMotoristaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(motoristas ?? []).filter((m) => m.ativo).map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Horário de saída *</Label>
            <Input type="datetime-local" value={saidaEmInput} onChange={(e) => setSaidaEmInput(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Quilometragem de saída *</Label>
            <Input inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} placeholder={carro.kmAtual != null ? `Última: ${carro.kmAtual} km` : "Ex: 45000"} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Fuel className="w-3.5 h-3.5" /> Valor entregue pra gasolina</Label>
            <Input inputMode="decimal" value={valorGas} onChange={(e) => setValorGas(e.target.value)} placeholder="Opcional — ex: 50,00" />
          </div>
          {!!valorGas && (
            <div className="space-y-1.5">
              <Label className="text-xs">Sai de qual conta *</Label>
              <Select value={contaGasId} onValueChange={setContaGasId}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent>
                  {(contas ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Gera automaticamente uma saída no Caixa, categoria &quot;Combustível&quot;.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Opcional" />
          </div>
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={invalido}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Registrando..." : "Confirmar saída"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Registrar chegada ────────────────────────────────────────────────────
function ChegadaDialog({ carro }: { carro: Carro }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [km, setKm] = useState("");
  const [obs, setObs] = useState("");
  const uso = carro.usoAtual!;

  const mutation = useMutation({
    mutationFn: () => axios.put(`/api/financeiro/carros/usos/${uso.id}`, { kmChegada: Number(km), observacoes: obs || undefined }),
    onSuccess: () => {
      const rodados = Number(km) - uso.kmSaida;
      toast.success(`Chegada registrada — ${rodados} km rodados`);
      qc.invalidateQueries({ queryKey: ["financeiro-carros"] });
      qc.invalidateQueries({ queryKey: ["financeiro-carro-usos"] });
      setOpen(false); setKm(""); setObs("");
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Erro ao registrar chegada"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full"><LogIn className="w-3.5 h-3.5 mr-1.5" /> Registrar chegada</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Chegada — {carro.numero} · {carro.modelo}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">
            Saiu com <strong>{uso.motorista.nome}</strong> às {formatDateTime(uso.saidaEm)}, km {uso.kmSaida}.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Quilometragem de chegada *</Label>
            <Input inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} placeholder={`Mín. ${uso.kmSaida} km`} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Opcional" />
          </div>
          <Button className="w-full" disabled={!km || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Registrando..." : "Confirmar chegada"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Registrar/editar o valor de gasolina de um uso já criado ──────────────
function GasolinaDialog({
  usoId, carroLabel, motoristaNome, valorAtual, trigger, onSaved,
}: {
  usoId: string; carroLabel: string; motoristaNome: string; valorAtual: string | null;
  trigger: React.ReactNode; onSaved: () => void;
}) {
  const { data: contas } = useContasFinanceiro();
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState(valorAtual ? String(Number(valorAtual)) : "");
  const [contaId, setContaId] = useState("");

  useEffect(() => {
    if (open && !contaId && contas?.length) {
      setContaId(contas.find((c) => c.tipo === "CAIXA")?.id ?? contas[0].id);
    }
  }, [open, contaId, contas]);

  const mutation = useMutation({
    mutationFn: () => axios.patch(`/api/financeiro/carros/usos/${usoId}/combustivel`, { valorCombustivel: Number(valor), contaCombustivelId: contaId }),
    onSuccess: () => {
      toast.success("Gasolina registrada");
      onSaved();
      setOpen(false);
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Erro ao registrar gasolina"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Gasolina — {carroLabel}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">Motorista: <strong>{motoristaNome}</strong></p>
          <div className="space-y-1.5">
            <Label className="text-xs">Valor entregue *</Label>
            <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex: 50,00" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sai de qual conta *</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>
                {(contas ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Gera automaticamente uma saída no Caixa, categoria &quot;Combustível&quot;.</p>
          </div>
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            disabled={!valor || Number(valor) <= 0 || !contaId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Corrigir um registro do histórico de uso ──────────────────────────────
function EditarUsoDialog({
  uso, carros, motoristas, onSaved,
}: {
  uso: Uso; carros: Carro[]; motoristas: Motorista[]; onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [carroId, setCarroId] = useState(uso.carro.id);
  const [motoristaId, setMotoristaId] = useState(uso.motorista.id);
  const [saidaEmInput, setSaidaEmInput] = useState(() => toDatetimeLocalValue(new Date(uso.saidaEm)));
  const [kmSaida, setKmSaida] = useState(String(uso.kmSaida));
  const [chegadaEmInput, setChegadaEmInput] = useState(() => (uso.chegadaEm ? toDatetimeLocalValue(new Date(uso.chegadaEm)) : ""));
  const [kmChegada, setKmChegada] = useState(uso.kmChegada != null ? String(uso.kmChegada) : "");
  const [obs, setObs] = useState(uso.observacoes ?? "");

  // Reabre sempre com os valores atuais do registro, não os da última vez que foi aberto.
  useEffect(() => {
    if (!open) return;
    setCarroId(uso.carro.id);
    setMotoristaId(uso.motorista.id);
    setSaidaEmInput(toDatetimeLocalValue(new Date(uso.saidaEm)));
    setKmSaida(String(uso.kmSaida));
    setChegadaEmInput(uso.chegadaEm ? toDatetimeLocalValue(new Date(uso.chegadaEm)) : "");
    setKmChegada(uso.kmChegada != null ? String(uso.kmChegada) : "");
    setObs(uso.observacoes ?? "");
  }, [open, uso]);

  const mutation = useMutation({
    mutationFn: () => axios.patch(`/api/financeiro/carros/usos/${uso.id}`, {
      carroId,
      motoristaId,
      saidaEm: new Date(saidaEmInput).toISOString(),
      kmSaida: Number(kmSaida),
      ...(uso.chegadaEm
        ? { chegadaEm: chegadaEmInput ? new Date(chegadaEmInput).toISOString() : null, kmChegada: kmChegada ? Number(kmChegada) : null }
        : {}),
      observacoes: obs || null,
    }),
    onSuccess: () => {
      toast.success("Registro atualizado");
      onSaved();
      setOpen(false);
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Erro ao atualizar registro"),
  });

  const invalido = !carroId || !motoristaId || !saidaEmInput || !kmSaida || mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar registro">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Editar registro de uso</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Carro *</Label>
            <Select value={carroId} onValueChange={setCarroId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {carros.map((c) => <SelectItem key={c.id} value={c.id}>{c.numero} · {c.modelo}{!c.ativo ? " (arquivado)" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Motorista *</Label>
            <Select value={motoristaId} onValueChange={setMotoristaId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {motoristas.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}{!m.ativo ? " (arquivado)" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Horário de saída *</Label>
              <Input type="datetime-local" value={saidaEmInput} onChange={(e) => setSaidaEmInput(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Km de saída *</Label>
              <Input inputMode="numeric" value={kmSaida} onChange={(e) => setKmSaida(e.target.value)} />
            </div>
          </div>
          {uso.chegadaEm ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Horário de chegada</Label>
                <Input type="datetime-local" value={chegadaEmInput} onChange={(e) => setChegadaEmInput(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Km de chegada</Label>
                <Input inputMode="numeric" value={kmChegada} onChange={(e) => setKmChegada(e.target.value)} />
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">Viagem ainda em andamento — a chegada é registrada pelo botão &quot;Registrar chegada&quot; do carro.</p>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Opcional" />
          </div>
          <Button className="w-full" disabled={invalido} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CarroCard({ carro }: { carro: Carro }) {
  const qc = useQueryClient();
  const emUso = !!carro.usoAtual;
  const onUsoAlterado = () => {
    qc.invalidateQueries({ queryKey: ["financeiro-carros"] });
    qc.invalidateQueries({ queryKey: ["financeiro-carro-usos"] });
    qc.invalidateQueries({ queryKey: ["financeiro-contas"] });
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-full shrink-0 border" style={{ background: carro.cor || "#10b981" }} />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{carro.numero} · {carro.modelo}</p>
            <p className="text-xs text-muted-foreground">{carro.placa} · {carro.ano}</p>
          </div>
        </div>
        <Badge variant={emUso ? "warning" : "success"} className="shrink-0 text-xs">{emUso ? "Em uso" : "Disponível"}</Badge>
      </div>

      {emUso ? (
        <div className="mt-3 text-xs text-muted-foreground space-y-1 bg-amber-500/5 rounded-lg p-2.5">
          <p className="flex items-center gap-1.5 text-foreground font-medium"><Users className="w-3 h-3" /> {carro.usoAtual!.motorista.nome}</p>
          <p className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> Saiu às {formatDateTime(carro.usoAtual!.saidaEm)}</p>
          <p className="flex items-center gap-1.5"><Gauge className="w-3 h-3" /> {carro.usoAtual!.kmSaida} km na saída</p>
          {carro.usoAtual!.valorCombustivel != null && (
            <p className="flex items-center gap-1.5"><Fuel className="w-3 h-3" /> {formatCurrency(Number(carro.usoAtual!.valorCombustivel))} pra gasolina</p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{carro.kmAtual != null ? `${carro.kmAtual} km na última chegada` : "Sem histórico de uso ainda"}</p>
      )}

      <div className="mt-3 space-y-1.5">
        {emUso ? <ChegadaDialog carro={carro} /> : <SaidaDialog carro={carro} />}
        {emUso && (
          <GasolinaDialog
            usoId={carro.usoAtual!.id}
            carroLabel={`${carro.numero} · ${carro.modelo}`}
            motoristaNome={carro.usoAtual!.motorista.nome}
            valorAtual={carro.usoAtual!.valorCombustivel}
            onSaved={onUsoAlterado}
            trigger={
              <Button size="sm" variant="outline" className="w-full">
                <Fuel className="w-3.5 h-3.5 mr-1.5" /> {carro.usoAtual!.valorCombustivel != null ? "Editar gasolina" : "Registrar gasolina"}
              </Button>
            }
          />
        )}
      </div>
    </Card>
  );
}

const emptyFiltros = { carroId: "", motoristaId: "", de: "", ate: "" };
const HISTORICO_LIMIT = 15;

export default function CarrosPage() {
  const qc = useQueryClient();
  const { data: carros, isLoading } = useCarros();
  const { data: carrosTodos } = useCarrosTodos();
  const { data: motoristasTodos } = useMotoristasTodos();
  const [filtros, setFiltros] = useState(emptyFiltros);
  const [page, setPage] = useState(1);
  const onUsoAlterado = () => {
    qc.invalidateQueries({ queryKey: ["financeiro-carros"] });
    qc.invalidateQueries({ queryKey: ["financeiro-carro-usos"] });
    qc.invalidateQueries({ queryKey: ["financeiro-contas"] });
  };

  function atualizarFiltro(patch: Partial<typeof emptyFiltros>) {
    setFiltros((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  const { data: historicoResp } = useQuery({
    queryKey: ["financeiro-carro-usos", filtros, page],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(HISTORICO_LIMIT), page: String(page) });
      if (filtros.carroId) params.set("carroId", filtros.carroId);
      if (filtros.motoristaId) params.set("motoristaId", filtros.motoristaId);
      if (filtros.de) params.set("de", filtros.de);
      if (filtros.ate) params.set("ate", filtros.ate);
      return (await axios.get(`/api/financeiro/carros/usos?${params}`)).data as { data: Uso[]; total: number };
    },
  });
  const historico = historicoResp?.data ?? [];
  const totalHistorico = historicoResp?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalHistorico / HISTORICO_LIMIT));
  const filtrosAtivos = !!(filtros.carroId || filtros.motoristaId || filtros.de || filtros.ate);

  const ativos = (carros ?? []).filter((c) => c.ativo);
  const emUsoCount = ativos.filter((c) => c.usoAtual).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Car className="w-6 h-6" />
            Carros
          </h2>
          <p className="text-muted-foreground">
            {ativos.length} carro{ativos.length !== 1 ? "s" : ""} · {emUsoCount} em uso agora
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GerenciarMotoristasDialog />
          <GerenciarCarrosDialog />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : ativos.length === 0 ? (
        <Card className="p-12 text-center">
          <Car className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Nenhum carro cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">Use o ícone <Settings className="w-3.5 h-3.5 inline" /> no canto acima pra cadastrar o primeiro.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ativos.map((c) => <CarroCard key={c.id} carro={c} />)}
        </div>
      )}

      <Card className="p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5">
            <Label className="text-xs">Carro</Label>
            <Select value={filtros.carroId || "todos"} onValueChange={(v) => atualizarFiltro({ carroId: v === "todos" ? "" : v })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(carrosTodos ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.numero} · {c.modelo}{!c.ativo ? " (arquivado)" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Motorista</Label>
            <Select value={filtros.motoristaId || "todos"} onValueChange={(v) => atualizarFiltro({ motoristaId: v === "todos" ? "" : v })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(motoristasTodos ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome}{!m.ativo ? " (arquivado)" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <Input type="date" className="w-36" value={filtros.de} onChange={(e) => atualizarFiltro({ de: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <Input type="date" className="w-36" value={filtros.ate} onChange={(e) => atualizarFiltro({ ate: e.target.value })} />
          </div>
          {filtrosAtivos && (
            <Button variant="ghost" size="sm" onClick={() => { setFiltros(emptyFiltros); setPage(1); }}>Limpar filtros</Button>
          )}
        </div>
      </Card>

      <Card>
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Histórico de uso</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Carro</th>
                <th className="text-left p-3 font-medium">Motorista</th>
                <th className="text-left p-3 font-medium">Saída</th>
                <th className="text-left p-3 font-medium">Chegada</th>
                <th className="text-right p-3 font-medium">Km rodados</th>
                <th className="text-right p-3 font-medium">Gasolina</th>
                <th className="w-10 p-3"></th>
              </tr>
            </thead>
            <tbody>
              {historico.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{filtrosAtivos ? "Nenhum registro para esses filtros" : "Nenhum registro ainda"}</td></tr>
              ) : (
                historico.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">{u.carro.numero} · {u.carro.modelo}</td>
                    <td className="p-3">{u.motorista.nome}</td>
                    <td className="p-3 whitespace-nowrap">{formatDateTime(u.saidaEm)} <span className="text-muted-foreground">· {u.kmSaida} km</span></td>
                    <td className="p-3 whitespace-nowrap">
                      {u.chegadaEm ? <>{formatDateTime(u.chegadaEm)} <span className="text-muted-foreground">· {u.kmChegada} km</span></> : <Badge variant="warning" className="text-xs">Em andamento</Badge>}
                    </td>
                    <td className="p-3 text-right font-semibold tabular-nums">
                      {u.kmChegada != null ? `${u.kmChegada - u.kmSaida} km` : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <GasolinaDialog
                        usoId={u.id}
                        carroLabel={`${u.carro.numero} · ${u.carro.modelo}`}
                        motoristaNome={u.motorista.nome}
                        valorAtual={u.valorCombustivel}
                        onSaved={onUsoAlterado}
                        trigger={
                          u.valorCombustivel != null ? (
                            <button className="tabular-nums text-muted-foreground hover:text-foreground hover:underline">
                              {formatCurrency(Number(u.valorCombustivel))}
                            </button>
                          ) : (
                            <button className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1">
                              <Fuel className="w-3 h-3" /> Adicionar
                            </button>
                          )
                        }
                      />
                    </td>
                    <td className="p-3">
                      <EditarUsoDialog uso={u} carros={carrosTodos ?? []} motoristas={motoristasTodos ?? []} onSaved={onUsoAlterado} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t">
            <p className="text-xs text-muted-foreground">{totalHistorico} registro{totalHistorico !== 1 ? "s" : ""}</p>
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
    </div>
  );
}
