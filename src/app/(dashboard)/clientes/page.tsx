"use client";

import { useState } from "react";
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
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORIGEM_LABELS } from "@/lib/utils/formatters";
import type { Cliente } from "@/types";

const TEMP_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  QUENTE: { label: "Quente", color: "text-red-400",    icon: "🔥" },
  MORNO:  { label: "Morno",  color: "text-amber-400",  icon: "🌡️" },
  FRIO:   { label: "Frio",   color: "text-blue-400",   icon: "❄️" },
};

const SERVICOS = [
  "Box de banheiro", "Espelho", "Janela de vidro", "Porta de vidro",
  "Fachada", "Guarda-corpo", "Pergolado de vidro", "Vitrine", "Divisória", "Outros",
];

const ETAPA_CONFIG: Record<string, { label: string; color: string }> = {
  NOVO_LEAD:        { label: "Entrar em Contato",  color: "bg-red-500/15 text-red-400 border-red-500/30" },
  CONTATO_INICIAL:     { label: "Contato Feito",       color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  PRIMEIRO_ORCAMENTO: { label: "Primeiro Orçamento",  color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" },
  QUALIFICACAO:        { label: "Visita / Medição",   color: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  PROPOSTA_ENVIADA: { label: "Orçamento Enviado",  color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  NEGOCIACAO:       { label: "Em Negociação",      color: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  FECHADO_GANHO:    { label: "Confirmado",         color: "bg-green-500/15 text-green-400 border-green-500/30" },
  FECHADO_PERDIDO:  { label: "Cancelado",          color: "bg-red-500/15 text-red-400 border-red-500/30" },
};

export default function ClientesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [responsavelId, setResponsavelId] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [servico, setServico] = useState("");
  const [estagio, setEstagio] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMINISTRADOR";

  const hasActiveFilters = !!(responsavelId || temperatura || servico || estagio || dataInicio || dataFim);

  function clearFilters() {
    setResponsavelId("");
    setTemperatura("");
    setServico("");
    setEstagio("");
    setDataInicio("");
    setDataFim("");
    setPage(1);
  }

  const { data: vendedoresData } = useQuery({
    queryKey: ["usuarios-ativos"],
    queryFn: async () => {
      const { data } = await axios.get("/api/usuarios/ativos");
      return data.data as Array<{ id: string; nome: string }>;
    },
    enabled: isAdmin,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["clientes", page, search, responsavelId, temperatura, servico, estagio, dataInicio, dataFim],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (search) params.set("search", search);
      if (responsavelId) params.set("responsavelId", responsavelId);
      if (temperatura) params.set("temperatura", temperatura);
      if (servico) params.set("servico", servico);
      if (estagio) params.set("estagio", estagio);
      if (dataInicio) params.set("dataInicio", dataInicio);
      if (dataFim) params.set("dataFim", dataFim);
      const { data } = await axios.get(`/api/clientes?${params}`);
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/clientes/${id}`),
    onSuccess: () => {
      toast.success("Cliente removido com sucesso");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao remover cliente"),
  });

  const clientes: Cliente[] = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

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
          <p className="text-sm text-muted-foreground">{total} clientes cadastrados</p>
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Temperatura */}
          <Select value={temperatura || "all"} onValueChange={(v) => { setTemperatura(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[140px] shrink-0">
              <SelectValue placeholder="Temperatura" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Temperatura</SelectItem>
              <SelectItem value="QUENTE">🔥 Quente</SelectItem>
              <SelectItem value="MORNO">🌡️ Morno</SelectItem>
              <SelectItem value="FRIO">❄️ Frio</SelectItem>
            </SelectContent>
          </Select>

          {/* Tipo de serviço */}
          <Select value={servico || "all"} onValueChange={(v) => { setServico(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[170px] shrink-0">
              <SelectValue placeholder="Tipo de serviço" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tipo de serviço</SelectItem>
              {SERVICOS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Funcionário — apenas admin */}
          {isAdmin && (
            <Select value={responsavelId || "all"} onValueChange={(v) => { setResponsavelId(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[160px] shrink-0">
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

          {/* Etapa */}
          <Select value={estagio || "all"} onValueChange={(v) => { setEstagio(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[180px] shrink-0">
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Etapa</SelectItem>
              {Object.entries(ETAPA_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Data de cadastro */}
          <div className="flex items-center gap-1.5 shrink-0">
            <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => { setDataInicio(e.target.value); setPage(1); }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-[135px]"
              title="Data de início"
            />
            <span className="text-muted-foreground text-sm">até</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => { setDataFim(e.target.value); setPage(1); }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-[135px]"
              title="Data de fim"
            />
          </div>

          {/* Limpar filtros */}
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
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{c.nome}</p>
                  {c.empresa && <p className="text-xs text-muted-foreground truncate">{c.empresa.nomeFantasia || c.empresa.razaoSocial}</p>}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {c.telefone && <span className="text-xs text-muted-foreground">{c.telefone}</span>}
                    <Badge variant="secondary" className="text-xs">{ORIGEM_LABELS[c.origem] || c.origem}</Badge>
                    {(() => {
                      const cfg = c.temperatura ? TEMP_CONFIG[c.temperatura] : null;
                      return cfg ? <span className={`text-xs font-medium ${cfg.color}`}>{cfg.icon} {cfg.label}</span> : null;
                    })()}
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
                <th className="text-left p-4 font-medium text-muted-foreground">Temperatura</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Etapa</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Responsável</th>
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
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">
                    <Building2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
                    <p>Nenhum cliente encontrado</p>
                    <Link href="/clientes/novo">
                      <Button variant="outline" size="sm" className="mt-3">
                        <Plus className="w-4 h-4 mr-2" />Cadastrar primeiro cliente
                      </Button>
                    </Link>
                  </td>
                </tr>
              ) : clientes.map((c) => (
                <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
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
                  <td className="p-4"><ActionMenu c={c} /></td>
                </tr>
              ))}
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
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este cliente? Esta ação não poderá ser desfeita.
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
