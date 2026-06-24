"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Filter,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ORIGEM_LABELS, PORTE_LABELS } from "@/lib/utils/formatters";
import type { Cliente } from "@/types";

export default function ClientesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["clientes", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (search) params.set("search", search);
      const { data } = await axios.get(`/api/clientes?${params}`);
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/clientes/${id}`),
    onSuccess: () => {
      toast.success("Cliente removido com sucesso");
      qc.invalidateQueries({ queryKey: ["clientes"] });
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
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" className="shrink-0">
          <Filter className="w-4 h-4" />
        </Button>
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
                <th className="text-left p-4 font-medium text-muted-foreground">Empresa</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Origem</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Responsável</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Porte</th>
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
                      {c.email && <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="w-3 h-3" /><span className="text-xs">{c.email}</span></div>}
                      {c.telefone && <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="w-3 h-3" /><span className="text-xs">{c.telefone}</span></div>}
                    </div>
                  </td>
                  <td className="p-4">
                    {c.empresa ? <span className="text-sm">{c.empresa.nomeFantasia || c.empresa.razaoSocial}</span> : <span className="text-muted-foreground text-sm">—</span>}
                  </td>
                  <td className="p-4">
                    <Badge variant="secondary" className="text-xs">{ORIGEM_LABELS[c.origem] || c.origem}</Badge>
                  </td>
                  <td className="p-4">
                    {c.responsavel ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-xs bg-violet-100 text-violet-600">
                            {c.responsavel.nome.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{c.responsavel.nome}</span>
                      </div>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </td>
                  <td className="p-4">
                    {c.porte ? <Badge variant="outline" className="text-xs">{PORTE_LABELS[c.porte]}</Badge> : <span className="text-muted-foreground text-sm">—</span>}
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
