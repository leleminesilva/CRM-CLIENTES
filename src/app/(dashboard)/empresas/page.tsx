"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Building2, Search, Users2, MoreHorizontal, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { PORTE_LABELS } from "@/lib/utils/formatters";
import type { Empresa } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function NovaEmpresaDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    razaoSocial: "", nomeFantasia: "", cnpj: "", segmento: "", porte: "PEQUENO",
    telefone: "", email: "", cidade: "", estado: "", observacoes: "",
  });

  const mutation = useMutation({
    mutationFn: () => axios.post("/api/empresas", form),
    onSuccess: () => { toast.success("Empresa criada!"); setOpen(false); onSuccess(); },
    onError: () => toast.error("Erro ao criar empresa"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />
          Nova Empresa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Empresa</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="col-span-2 space-y-1.5">
            <Label>Razão Social *</Label>
            <Input value={form.razaoSocial} onChange={e => setForm(f => ({ ...f, razaoSocial: e.target.value }))} placeholder="Razão Social" />
          </div>
          <div className="space-y-1.5">
            <Label>Nome Fantasia</Label>
            <Input value={form.nomeFantasia} onChange={e => setForm(f => ({ ...f, nomeFantasia: e.target.value }))} placeholder="Nome Fantasia" />
          </div>
          <div className="space-y-1.5">
            <Label>CNPJ</Label>
            <Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" />
          </div>
          <div className="space-y-1.5">
            <Label>Segmento</Label>
            <Input value={form.segmento} onChange={e => setForm(f => ({ ...f, segmento: e.target.value }))} placeholder="Ex: Construção Civil" />
          </div>
          <div className="space-y-1.5">
            <Label>Porte</Label>
            <Select value={form.porte} onValueChange={v => setForm(f => ({ ...f, porte: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["MICRO","PEQUENO","MEDIO","GRANDE","ENTERPRISE"].map(p => (
                  <SelectItem key={p} value={p}>{PORTE_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(11) 3456-7890" />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@empresa.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Input value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} placeholder="São Paulo" />
          </div>
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Input value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} placeholder="SP" maxLength={2} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => mutation.mutate()}
              disabled={!form.razaoSocial || mutation.isPending}
            >
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function EmpresasPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["empresas", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (search) params.set("search", search);
      const { data } = await axios.get(`/api/empresas?${params}`);
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/empresas/${id}`),
    onSuccess: () => {
      toast.success("Empresa removida");
      qc.invalidateQueries({ queryKey: ["empresas"] });
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const empresas: (Empresa & { _count?: { contatos: number; clientes: number } })[] = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Empresas</h2>
          <p className="text-muted-foreground">{total} empresas cadastradas</p>
        </div>
        <NovaEmpresaDialog onSuccess={() => qc.invalidateQueries({ queryKey: ["empresas"] })} />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar empresa..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {/* Grid de cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : empresas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Nenhuma empresa encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {empresas.map((e) => (
            <Card key={e.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-xl flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{e.nomeFantasia || e.razaoSocial}</p>
                    {e.nomeFantasia && (
                      <p className="text-xs text-muted-foreground">{e.razaoSocial}</p>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/empresas/${e.id}`}>
                        <Eye className="w-4 h-4 mr-2" />
                        Ver detalhes
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteId(e.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                {e.segmento && <p>{e.segmento}</p>}
                {e.cidade && <p>{e.cidade}{e.estado ? `, ${e.estado}` : ""}</p>}
                {e.telefone && <p>{e.telefone}</p>}
              </div>

              <div className="flex items-center gap-3 mt-4">
                {e.porte && (
                  <Badge variant="outline" className="text-xs">
                    {PORTE_LABELS[e.porte]}
                  </Badge>
                )}
                {e._count && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users2 className="w-3 h-3" />
                    <span>{e._count.contatos} contatos</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover empresa</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
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
