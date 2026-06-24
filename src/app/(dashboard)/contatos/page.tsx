"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Contact2, Search, Mail, Phone, Building2, Star, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Contato } from "@/types";

function NovoContatoDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "", cargo: "", email: "", telefone: "", whatsapp: "", principal: false, empresaId: "",
  });

  const mutation = useMutation({
    mutationFn: () => axios.post("/api/contatos", form),
    onSuccess: () => { toast.success("Contato criado!"); setOpen(false); onSuccess(); },
    onError: () => toast.error("Erro ao criar contato"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Contato
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Contato</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Input value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Ex: Diretor" />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(11) 3456-7890" />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="(11) 98765-4321" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.principal}
              onCheckedChange={v => setForm(f => ({ ...f, principal: v }))}
            />
            <Label>Contato principal da empresa</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => mutation.mutate()}
              disabled={!form.nome || mutation.isPending}
            >
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ContatosPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["contatos", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "18" });
      if (search) params.set("search", search);
      const { data } = await axios.get(`/api/contatos?${params}`);
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/contatos/${id}`),
    onSuccess: () => {
      toast.success("Contato removido");
      qc.invalidateQueries({ queryKey: ["contatos"] });
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const contatos: Contato[] = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Contatos</h2>
          <p className="text-muted-foreground">{total} contatos</p>
        </div>
        <NovoContatoDialog onSuccess={() => qc.invalidateQueries({ queryKey: ["contatos"] })} />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar contato..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : contatos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Contact2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum contato encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contatos.map(c => (
            <Card key={c.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarFallback className="bg-violet-100 dark:bg-violet-900 text-violet-600">
                    {c.nome.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-sm truncate">{c.nome}</p>
                    {c.principal && (
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                    )}
                  </div>
                  {c.cargo && <p className="text-xs text-muted-foreground">{c.cargo}</p>}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteId(c.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-3 space-y-1.5">
                {c.email && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="w-3 h-3 shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
                {(c.telefone || c.whatsapp) && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3 shrink-0" />
                    <span>{c.telefone || c.whatsapp}</span>
                  </div>
                )}
                {c.empresa && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Building2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">{c.empresa.nomeFantasia || c.empresa.razaoSocial}</span>
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
            <AlertDialogTitle>Remover contato</AlertDialogTitle>
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
