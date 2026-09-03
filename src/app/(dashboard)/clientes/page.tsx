"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus,
  Search,
  Building2,
  Phone,
  CalendarDays,
  Mail,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  MessageCircle,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORIGEM_LABELS } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";
import { SERVICOS } from "@/lib/constants";
import type { Cliente } from "@/types";

const TEMP_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  QUENTE: { label: "Quente", color: "text-red-400",    icon: "🔥" },
  MORNO:  { label: "Morno",  color: "text-amber-400",  icon: "🌡️" },
  FRIO:   { label: "Frio",   color: "text-blue-400",   icon: "❄️" },
};

const ETAPA_CONFIG: Record<string, { label: string; color: string }> = {
  REENGAJAR:        { label: "Entrar em Contato Novamente", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  NOVO_LEAD:        { label: "Entrar em Contato",  color: "bg-red-500/15 text-red-400 border-red-500/30" },
  CONTATO_INICIAL:     { label: "Contato Feito",       color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  PRIMEIRO_ORCAMENTO: { label: "Primeiro Orçamento",  color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" },
  QUALIFICACAO:        { label: "Visita / Medição",   color: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  PROPOSTA_ENVIADA: { label: "Orçamento Final",    color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  NEGOCIACAO:       { label: "Em Negociação",      color: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  FECHADO_GANHO:    { label: "Confirmado",         color: "bg-green-500/15 text-green-400 border-green-500/30" },
  FECHADO_PERDIDO:  { label: "Cancelado",          color: "bg-red-500/15 text-red-400 border-red-500/30" },
};

export default function ClientesPage() {
  const ss = typeof window !== "undefined" ? sessionStorage : null;
  const [search, setSearch] = useState(() => ss?.getItem("cf_search") ?? "");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [motivoExclusao, setMotivoExclusao] = useState("");
  const [responsavelId, setResponsavelId] = useState(() => ss?.getItem("cf_responsavelId") ?? "");
  const [temperatura, setTemperatura] = useState(() => ss?.getItem("cf_temperatura") ?? "");
  const [servico, setServico] = useState(() => ss?.getItem("cf_servico") ?? "");
  const [estagio, setEstagio] = useState(() => ss?.getItem("cf_estagio") ?? "");
  const [dataInicio, setDataInicio] = useState(() => ss?.getItem("cf_dataInicio") ?? "");
  const [dataFim, setDataFim] = useState(() => ss?.getItem("cf_dataFim") ?? "");
  const [soParados, setSoParados] = useState(() => ss?.getItem("cf_soParados") === "1");
  const [filtersOpen, setFiltersOpen] = useState(false);
  // 0 = padrão (updatedAt desc), 1 = inclusão asc, 2 = inclusão desc
  const [sortMode, setSortMode] = useState(0);
  // 0 = desativado, 1 = etapa asc (pipeline), 2 = etapa desc
  const [etapaSort, setEtapaSort] = useState(0);
  // 0 = desativado, 1 = QUENTE→FRIO, 2 = FRIO→QUENTE
  const [tempSort, setTempSort] = useState(0);
  // 0 = desativado, 1 = A→Z, 2 = Z→A
  const [respSort, setRespSort] = useState(0);

  function cycleSortMode() {
    setEtapaSort(0); setTempSort(0); setRespSort(0);
    setSortMode((prev) => (prev + 1) % 3);
    setPage(1);
  }

  function cycleSortEtapa() {
    setSortMode(0); setTempSort(0); setRespSort(0);
    setEtapaSort((prev) => (prev + 1) % 3);
    setPage(1);
  }

  function cycleSortTemp() {
    setSortMode(0); setEtapaSort(0); setRespSort(0);
    setTempSort((prev) => (prev + 1) % 3);
    setPage(1);
  }

  function cycleSortResp() {
    setSortMode(0); setEtapaSort(0); setTempSort(0);
    setRespSort((prev) => (prev + 1) % 3);
    setPage(1);
  }

  // Persiste filtros no sessionStorage sempre que mudam
  useEffect(() => { sessionStorage.setItem("cf_search", search); }, [search]);
  useEffect(() => { sessionStorage.setItem("cf_responsavelId", responsavelId); }, [responsavelId]);
  useEffect(() => { sessionStorage.setItem("cf_temperatura", temperatura); }, [temperatura]);
  useEffect(() => { sessionStorage.setItem("cf_servico", servico); }, [servico]);
  useEffect(() => { sessionStorage.setItem("cf_estagio", estagio); }, [estagio]);
  useEffect(() => { sessionStorage.setItem("cf_dataInicio", dataInicio); }, [dataInicio]);
  useEffect(() => { sessionStorage.setItem("cf_dataFim", dataFim); }, [dataFim]);
  useEffect(() => { sessionStorage.setItem("cf_soParados", soParados ? "1" : ""); }, [soParados]);
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMINISTRADOR" || user?.role === "DESENVOLVEDOR";

  const hasActiveFilters = !!(responsavelId || temperatura || servico || estagio || dataInicio || dataFim || soParados);
  const activeFilterCount = [responsavelId, temperatura, servico, estagio, dataInicio || dataFim, soParados].filter(Boolean).length;

  function clearFilters() {
    setSearch("");
    setResponsavelId("");
    setTemperatura("");
    setServico("");
    setEstagio("");
    setDataInicio("");
    setDataFim("");
    setSoParados(false);
    setPage(1);
    ["cf_search","cf_responsavelId","cf_temperatura","cf_servico","cf_estagio","cf_dataInicio","cf_dataFim","cf_soParados"]
      .forEach((k) => sessionStorage.removeItem(k));
  }

  const { data: vendedoresData } = useQuery({
    queryKey: ["usuarios-ativos"],
    queryFn: async () => {
      const { data } = await axios.get("/api/usuarios/ativos");
      return data.data as Array<{ id: string; nome: string }>;
    },
    enabled: isAdmin,
  });

  const PAGE_SIZE = 100;
  // Etapa/Temperatura/Responsável são ordenados no client, então quando ativos
  // precisamos do conjunto filtrado inteiro (não só a página atual) — senão cada
  // página é ordenada isoladamente e a sequência "recomeça" a cada 100 itens.
  const clientSortActive = etapaSort > 0 || tempSort > 0 || respSort > 0;
  // "Sem movimentação +2d" é calculado no client (updatedAt/revisadoEm), então
  // quando o filtro está ligado precisamos do conjunto inteiro — filtrar só a
  // página atual furaria a paginação e a contagem.
  const fullFetch = clientSortActive || soParados;

  const { data, isLoading } = useQuery({
    queryKey: ["clientes", page, search, responsavelId, temperatura, servico, estagio, dataInicio, dataFim, sortMode, fullFetch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: fullFetch ? "1" : String(page),
        limit: fullFetch ? "5000" : String(PAGE_SIZE),
      });
      if (search) params.set("search", search);
      if (responsavelId) params.set("responsavelId", responsavelId);
      if (temperatura) params.set("temperatura", temperatura);
      if (servico) params.set("servico", servico);
      if (estagio) params.set("estagio", estagio);
      if (dataInicio) params.set("dataInicio", dataInicio);
      if (dataFim) params.set("dataFim", dataFim);
      if (sortMode === 1) params.set("sort", "createdAt_asc");
      if (sortMode === 2) params.set("sort", "createdAt_desc");
      const { data } = await axios.get(`/api/clientes?${params}`);
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      axios.delete(`/api/clientes/${id}`, { data: { motivo } }),
    onSuccess: () => {
      toast.success("Cliente removido com sucesso");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setDeleteId(null);
      setMotivoExclusao("");
    },
    onError: () => toast.error("Erro ao remover cliente"),
  });

  const ESTAGIO_ORDER: Record<string, number> = {
    REENGAJAR: -1,
    NOVO_LEAD: 0, CONTATO_INICIAL: 1, PRIMEIRO_ORCAMENTO: 2, QUALIFICACAO: 3,
    PROPOSTA_ENVIADA: 4, NEGOCIACAO: 5, FECHADO_GANHO: 6, FECHADO_PERDIDO: 7,
  };

  const TEMP_ORDER: Record<string, number> = { QUENTE: 0, MORNO: 1, FRIO: 2 };

  // ⚠ "Sem movimentação há mais de 2 dias" — mesma regra da linha da tabela.
  const LIMITE_2D_MS = 2 * 24 * 60 * 60 * 1000;
  function semMovimentacao2d(c: Cliente): boolean {
    const est = (c as unknown as { leads?: { estagio: string }[] }).leads?.[0]?.estagio;
    const fechado = est === "FECHADO_GANHO" || est === "FECHADO_PERDIDO"
      || c.statusOrcamento === "APROVADO" || c.statusOrcamento === "NAO_APROVADO";
    if (fechado) return false;
    const limite = Date.now() - LIMITE_2D_MS;
    return new Date(c.updatedAt).getTime() < limite
      && (!c.revisadoEm || new Date(c.revisadoEm).getTime() < limite);
  }

  const clientesRaw: Cliente[] = data?.data || [];
  const clientesBase = soParados ? clientesRaw.filter(semMovimentacao2d) : clientesRaw;
  const clientesOrdenados = (() => {
    if (etapaSort > 0) {
      return [...clientesBase].sort((a, b) => {
        const ea = (a as unknown as { leads?: { estagio: string }[] }).leads?.[0]?.estagio ?? "";
        const eb = (b as unknown as { leads?: { estagio: string }[] }).leads?.[0]?.estagio ?? "";
        const d = (ESTAGIO_ORDER[ea] ?? 99) - (ESTAGIO_ORDER[eb] ?? 99);
        return etapaSort === 1 ? d : -d;
      });
    }
    if (tempSort > 0) {
      return [...clientesBase].sort((a, b) => {
        const d = (TEMP_ORDER[a.temperatura] ?? 99) - (TEMP_ORDER[b.temperatura] ?? 99);
        return tempSort === 1 ? d : -d;
      });
    }
    if (respSort > 0) {
      return [...clientesBase].sort((a, b) => {
        const na = a.responsavel?.nome ?? "";
        const nb = b.responsavel?.nome ?? "";
        return respSort === 1 ? na.localeCompare(nb, "pt") : nb.localeCompare(na, "pt");
      });
    }
    return clientesBase;
  })();
  // Com filtro "parados" o total real é o do conjunto filtrado no client.
  const total = soParados ? clientesBase.length : (data?.total || 0);
  // Com fetch do conjunto inteiro (sort client-side ou filtro "parados"), a
  // paginação exibida também precisa ser fatiada no client.
  const clientes = fullFetch
    ? clientesOrdenados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : clientesOrdenados;
  const totalPages = fullFetch ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : (data?.totalPages || 1);

  function renderFilterFields(layout: "inline" | "stacked") {
    const stacked = layout === "stacked";
    return (
      <>
        <Select value={temperatura || "all"} onValueChange={(v) => { setTemperatura(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className={stacked ? "w-full" : "w-[140px] shrink-0"}>
            <SelectValue placeholder="Temperatura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Temperatura</SelectItem>
            <SelectItem value="QUENTE">🔥 Quente</SelectItem>
            <SelectItem value="MORNO">🌡️ Morno</SelectItem>
            <SelectItem value="FRIO">❄️ Frio</SelectItem>
          </SelectContent>
        </Select>

        <Select value={servico || "all"} onValueChange={(v) => { setServico(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className={stacked ? "w-full" : "w-[170px] shrink-0"}>
            <SelectValue placeholder="Tipo de serviço" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tipo de serviço</SelectItem>
            {SERVICOS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isAdmin && (
          <Select value={responsavelId || "all"} onValueChange={(v) => { setResponsavelId(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className={stacked ? "w-full" : "w-[160px] shrink-0"}>
              <SelectValue placeholder="Funcionário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Funcionário</SelectItem>
              {(vendedoresData ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={estagio || "all"} onValueChange={(v) => { setEstagio(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className={stacked ? "w-full" : "w-[180px] shrink-0"}>
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Etapa</SelectItem>
            {Object.entries(ETAPA_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className={stacked ? "space-y-1.5" : "flex items-center gap-1.5 shrink-0"}>
          <Label className={stacked ? "text-xs text-muted-foreground" : "sr-only"}>
            Data de cadastro
          </Label>
          <div className={cn("flex items-center gap-1.5", stacked && "w-full")}>
            <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => { setDataInicio(e.target.value); setPage(1); }}
              className={cn(
                "h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                stacked ? "flex-1 min-w-0" : "w-[135px]"
              )}
              title="Data de início"
            />
            <span className="text-muted-foreground text-sm shrink-0">até</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => { setDataFim(e.target.value); setPage(1); }}
              className={cn(
                "h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                stacked ? "flex-1 min-w-0" : "w-[135px]"
              )}
              title="Data de fim"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => { setSoParados((v) => !v); setPage(1); }}
          aria-pressed={soParados}
          title="Mostrar apenas clientes sem movimentação há mais de 2 dias"
          className={cn(
            "h-9 rounded-md border px-3 text-sm font-medium transition-colors inline-flex items-center justify-center gap-1.5",
            stacked ? "w-full" : "shrink-0",
            soParados
              ? "border-red-500/40 bg-red-500/10 text-red-500"
              : "border-input bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          <span aria-hidden>⚠</span>
          Sem movimentação +2d
        </button>
      </>
    );
  }

  const ActionMenu = ({ c }: { c: Cliente }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/clientes/${c.id}`}><Eye className="w-4 h-4 mr-2" />Visualizar</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/clientes/${c.id}/editar`}><Edit className="w-4 h-4 mr-2" />Editar</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteId(c.id)}>
          <Trash2 className="w-4 h-4 mr-2" />Remover
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">Clientes</h2>
          <p className="text-sm text-muted-foreground">
            {soParados ? `${total} sem movimentação há +2 dias` : `${total} clientes cadastrados`}
          </p>
        </div>
        <Link href="/clientes/novo">
          <Button className="bg-indigo-600 hover:bg-indigo-700" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
        </Link>
      </div>

      {/* Filtros */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>

          {/* Botão Filtrar — só mobile, filtros vão num modal empilhado */}
          <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="relative shrink-0 md:hidden">
                <SlidersHorizontal className="w-4 h-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
                <span className="sr-only">Filtrar</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Filtros</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                {renderFilterFields("stacked")}
              </div>
              <DialogFooter className="flex-row gap-2">
                {hasActiveFilters && (
                  <Button variant="outline" onClick={() => { clearFilters(); setFiltersOpen(false); }} className="flex-1">
                    Limpar
                  </Button>
                )}
                <Button onClick={() => setFiltersOpen(false)} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                  Aplicar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filtros inline — só desktop */}
        <div className="hidden md:flex items-center gap-2 flex-wrap">
          {renderFilterFields("inline")}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-3.5 h-3.5 mr-1" />Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          [...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)
        ) : clientes.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <Building2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum cliente encontrado</p>
          </Card>
        ) : clientes.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/clientes/${c.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xs font-bold">
                    {c.nome.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{c.nome}</p>
                  {c.empresa && <p className="text-xs text-muted-foreground truncate">{c.empresa.nomeFantasia || c.empresa.razaoSocial}</p>}
                  {c.telefone && <p className="text-xs text-muted-foreground mt-0.5">{c.telefone}</p>}

                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">{ORIGEM_LABELS[c.origem] || c.origem}</Badge>
                    {(() => {
                      const cfg = c.temperatura ? TEMP_CONFIG[c.temperatura] : null;
                      return cfg ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
                          <span>{cfg.icon}</span>{cfg.label}
                        </span>
                      ) : null;
                    })()}
                    {(() => {
                      const estagio = (c as unknown as { leads?: { estagio: string }[] }).leads?.[0]?.estagio;
                      const cfg = estagio ? ETAPA_CONFIG[estagio] : null;
                      return cfg ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      ) : null;
                    })()}
                  </div>

                  {c.responsavel && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Avatar className="w-4 h-4">
                        {c.responsavel.avatar && <AvatarImage src={c.responsavel.avatar} alt={c.responsavel.nome} />}
                        <AvatarFallback className="text-[9px] bg-violet-100 text-violet-600">
                          {c.responsavel.nome.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">{c.responsavel.nome}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                    <CalendarDays className="w-3 h-3 shrink-0" />
                    <span>Cadastrado em {new Date(c.createdAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              </Link>
              <ActionMenu c={c} />
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop: Table */}
      <Card className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Contato</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Serviço Buscado</th>
                <th className="p-4">
                  <button
                    type="button"
                    onClick={cycleSortTemp}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium transition-colors group"
                  >
                    Temperatura
                    {tempSort === 0 && <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-70" />}
                    {tempSort === 1 && <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />}
                    {tempSort === 2 && <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />}
                  </button>
                </th>
                <th className="p-4">
                  <button
                    type="button"
                    onClick={cycleSortEtapa}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium transition-colors group"
                  >
                    Etapa
                    {etapaSort === 0 && <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-70" />}
                    {etapaSort === 1 && <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />}
                    {etapaSort === 2 && <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />}
                  </button>
                </th>
                <th className="p-4">
                  <button
                    type="button"
                    onClick={cycleSortMode}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium transition-colors group"
                  >
                    Inclusão
                    {sortMode === 0 && <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-70" />}
                    {sortMode === 1 && <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />}
                    {sortMode === 2 && <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />}
                  </button>
                </th>
                <th className="p-4">
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={cycleSortResp}
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium transition-colors group"
                    >
                      Responsável
                      {respSort === 0 && <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-70" />}
                      {respSort === 1 && <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />}
                      {respSort === 2 && <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />}
                    </button>
                  ) : (
                    <span className="text-left font-medium text-muted-foreground">Responsável</span>
                  )}
                </th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="p-4"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : clientes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground">
                    <Building2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
                    <p>Nenhum cliente encontrado</p>
                    <Link href="/clientes/novo">
                      <Button variant="outline" size="sm" className="mt-3">
                        <Plus className="w-4 h-4 mr-2" />Cadastrar primeiro cliente
                      </Button>
                    </Link>
                  </td>
                </tr>
              ) : clientes.map((c) => {
                const parado = semMovimentacao2d(c);
                const notificado = !c.notificacaoLida && !!c.notificacaoMensagem;
                return (
                <tr key={c.id} className={cn(
                  "border-b transition-colors",
                  notificado ? "bg-amber-500/10 hover:bg-amber-500/15" :
                  parado     ? "bg-red-500/10 hover:bg-red-500/15" :
                               "hover:bg-muted/30"
                )}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xs">
                          {c.nome.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{c.nome}</p>
                        {c.cpfCnpj && <p className="text-xs text-muted-foreground">{c.cpfCnpj}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="space-y-0.5">
                      {c.whatsapp && <div className="flex items-center gap-1.5"><a href={`https://wa.me/55${c.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" title="Abrir no WhatsApp"><MessageCircle className="w-3.5 h-3.5 text-green-500 hover:text-green-400 transition-colors cursor-pointer" /></a><span className="text-xs">{c.whatsapp}</span></div>}
                      {!c.whatsapp && c.telefone && <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="w-3 h-3" /><span className="text-xs">{c.telefone}</span></div>}
                      {c.email && <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="w-3 h-3" /><span className="text-xs">{c.email}</span></div>}
                    </div>
                  </td>
                  <td className="p-4 max-w-[180px]">
                    {c.servicoBuscado
                      ? <div className="flex flex-wrap gap-1">
                          {c.servicoBuscado.split(",").map(s => s.trim()).filter(Boolean).map(s => (
                            <span key={s} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{s}</span>
                          ))}
                        </div>
                      : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="p-4">
                    {(() => {
                      const cfg = c.temperatura ? TEMP_CONFIG[c.temperatura] : null;
                      return cfg
                        ? <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}><span>{cfg.icon}</span>{cfg.label}</span>
                        : <span className="text-muted-foreground text-xs">—</span>;
                    })()}
                  </td>
                  <td className="p-4">
                    {(() => {
                      const estagio = (c as unknown as { leads?: { estagio: string }[] }).leads?.[0]?.estagio;
                      const cfg = estagio ? ETAPA_CONFIG[estagio] : null;
                      return cfg
                        ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>{cfg.label}</span>
                        : <span className="text-muted-foreground text-xs">—</span>;
                    })()}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </td>
                  <td className="p-4">
                    {c.responsavel ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          {c.responsavel.avatar && <AvatarImage src={c.responsavel.avatar} alt={c.responsavel.nome} />}
                          <AvatarFallback className="text-xs bg-violet-100 text-violet-600">
                            {c.responsavel.nome.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{c.responsavel.nome}</span>
                      </div>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {notificado && (
                        <span title="Notificação não lida" className="text-amber-500 text-xs font-semibold">🔔</span>
                      )}
                      {parado && !notificado && (
                        <span title="Sem movimentação há mais de 2 dias" className="text-red-500 text-xs font-semibold">⚠</span>
                      )}
                      <ActionMenu c={c} />
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Mobile pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between md:hidden">
          <p className="text-sm text-muted-foreground">Pág. {page}/{totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Ant.</Button>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Próx.</Button>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) { setDeleteId(null); setMotivoExclusao(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este cliente? Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-exclusao-cliente">Motivo da exclusão *</Label>
            <Textarea
              id="motivo-exclusao-cliente"
              placeholder="Explique por que este cliente está sendo removido..."
              value={motivoExclusao}
              onChange={(e) => setMotivoExclusao(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={!motivoExclusao.trim() || deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteId && motivoExclusao.trim()) deleteMutation.mutate({ id: deleteId, motivo: motivoExclusao.trim() });
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
