"use client";

import { useRef, useState } from "react";
import { AvatarCropDialog } from "@/components/ui/avatar-crop-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import {
  Plus, Shield, Pencil, Trash2, MoreVertical,
  Users, UserCheck, UserX, Search, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ROLE_LABELS } from "@/lib/utils/formatters";
import type { User } from "@/types";

type UserWithCount = User & {
  _count?: { clientes: number; leads: number; oportunidades: number };
};

const ROLE_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"> = {
  ADMINISTRADOR: "destructive",
  GESTOR: "warning",
  COMERCIAL: "info",
  OPERACIONAL: "secondary",
};

const ROLE_BG: Record<string, string> = {
  ADMINISTRADOR: "from-red-500/10 to-red-500/5",
  GESTOR:        "from-amber-500/10 to-amber-500/5",
  COMERCIAL:     "from-blue-500/10 to-blue-500/5",
  OPERACIONAL:   "from-slate-500/10 to-slate-500/5",
};

const PERMISSIONS_TABLE = [
  { modulo: "Dashboard Geral",   admin: true,  gestor: true,  comercial: "Próprio", operacional: true },
  { modulo: "Clientes — CRUD",   admin: true,  gestor: true,  comercial: "Próprio", operacional: false },
  { modulo: "Leads — CRUD",      admin: true,  gestor: true,  comercial: "Próprio", operacional: "Ver" },
  { modulo: "Oportunidades",     admin: true,  gestor: true,  comercial: "Próprio", operacional: "Ver" },
  { modulo: "Relatórios",        admin: true,  gestor: true,  comercial: false,     operacional: false },
  { modulo: "Usuários — CRUD",   admin: true,  gestor: false, comercial: false,     operacional: false },
  { modulo: "Auditoria",         admin: true,  gestor: false, comercial: false,     operacional: false },
];

const emptyForm = { nome: "", email: "", senha: "", role: "COMERCIAL" };

function UserFormDialog({
  trigger,
  title,
  defaultValues,
  onSubmit,
  isPending,
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

  const valid = form.nome.trim().length >= 2 && form.email.includes("@") &&
    (defaultValues?.email ? true : form.senha.length >= 6);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nome completo *</Label>
            <Input
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: João Silva"
            />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail *</Label>
            <Input
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              type="email"
              placeholder="joao@empresa.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{defaultValues?.email ? "Nova senha (deixe em branco para manter)" : "Senha *"}</Label>
            <Input
              value={form.senha}
              onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
              type="password"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Perfil de acesso</Label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {form.role === "ADMINISTRADOR" && "Acesso total ao sistema"}
              {form.role === "GESTOR" && "Visualiza tudo, gerencia equipe"}
              {form.role === "COMERCIAL" && "Gerencia seus próprios clientes e leads"}
              {form.role === "OPERACIONAL" && "Executa tarefas, visão limitada"}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => { onSubmit(form); setOpen(false); }}
              disabled={!valid || isPending}
            >
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function UsuariosPage() {
  const qc = useQueryClient();
  const { user: me, refreshUser } = useAuth();
  const isAdmin = me?.role === "ADMINISTRADOR";
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UserWithCount | null>(null);
  const [uploadingUserId, setUploadingUserId] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarTargetRef = useRef<string | null>(null);

  function handleAvatarClick(userId: string) {
    avatarTargetRef.current = userId;
    avatarInputRef.current?.click();
  }

  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropSrc(URL.createObjectURL(file));
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  }

  async function handleCropConfirm(blob: Blob) {
    const userId = avatarTargetRef.current;
    if (!userId) return;
    setUploadingUserId(userId);
    try {
      const fd = new FormData();
      fd.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      fd.append("userId", userId);
      await axios.post("/api/usuarios/avatar", fd);
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      if (userId === me?.id) await refreshUser();
      toast.success("Foto atualizada!");
      setCropSrc(null);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error ?? "Erro ao enviar foto" : "Erro ao enviar foto";
      toast.error(msg);
    } finally {
      setUploadingUserId(null);
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const { data } = await axios.get("/api/usuarios");
      return data.data as UserWithCount[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof emptyForm) => axios.post("/api/usuarios", body),
    onSuccess: () => {
      toast.success("Funcionário adicionado com sucesso!");
      qc.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || "Erro ao criar usuário");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<typeof emptyForm & { ativo: boolean }>) =>
      axios.put(`/api/usuarios/${id}`, body),
    onSuccess: () => {
      toast.success("Usuário atualizado");
      qc.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: () => toast.error("Erro ao atualizar usuário"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/usuarios/${id}`),
    onSuccess: () => {
      toast.success("Funcionário removido");
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      setDeleteTarget(null);
    },
    onError: () => toast.error("Erro ao remover usuário"),
  });

  const usuarios = (data || []).filter(u =>
    !search || u.nome.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const ativos   = usuarios.filter(u => u.ativo).length;
  const inativos = usuarios.filter(u => !u.ativo).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Funcionários</h2>
          <p className="text-muted-foreground">Gerencie os usuários do sistema</p>
        </div>
        <UserFormDialog
          title="Adicionar Funcionário"
          trigger={
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Novo Funcionário
            </Button>
          }
          onSubmit={values => createMutation.mutate(values)}
          isPending={createMutation.isPending}
        />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: usuarios.length, icon: Users,     color: "text-indigo-600" },
          { label: "Ativos",  value: ativos,         icon: UserCheck, color: "text-emerald-600" },
          { label: "Inativos",value: inativos,       icon: UserX,     color: "text-red-500" },
        ].map(s => (
          <Card key={s.label} className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar funcionário..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : usuarios.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">
            {search ? "Nenhum funcionário encontrado" : "Nenhum funcionário cadastrado"}
          </p>
          {!search && (
            <p className="text-sm text-muted-foreground mt-1">
              Clique em &quot;Novo Funcionário&quot; para começar
            </p>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {usuarios.map(u => (
            <Card
              key={u.id}
              className={`p-5 bg-gradient-to-br ${ROLE_BG[u.role]} border ${!u.ativo ? "opacity-60" : ""}`}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`relative shrink-0 ${isAdmin ? "cursor-pointer group" : ""}`}
                    onClick={() => isAdmin && handleAvatarClick(u.id)}
                    title={isAdmin ? "Clique para alterar foto" : undefined}
                  >
                    <Avatar className="w-11 h-11">
                      {u.avatar && <AvatarImage src={u.avatar} alt={u.nome} />}
                      <AvatarFallback className="bg-indigo-100 dark:bg-indigo-900 text-indigo-700 font-bold text-sm">
                        {u.nome.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {isAdmin && (
                      <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {uploadingUserId === u.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Camera className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{u.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <UserFormDialog
                      title="Editar Funcionário"
                      trigger={
                        <DropdownMenuItem onSelect={e => e.preventDefault()} className="cursor-pointer">
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                      }
                      defaultValues={{ nome: u.nome, email: u.email, senha: "", role: u.role }}
                      onSubmit={values => {
                        const payload: Record<string, unknown> = { nome: values.nome, email: values.email, role: values.role };
                        if (values.senha) payload.senha = values.senha;
                        updateMutation.mutate({ id: u.id, ...payload });
                      }}
                      isPending={updateMutation.isPending}
                    />
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 cursor-pointer"
                      onSelect={() => setDeleteTarget(u)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Badge + toggle */}
              <div className="mt-4 flex items-center justify-between">
                <Badge variant={ROLE_COLORS[u.role]} className="text-xs">
                  <Shield className="w-3 h-3 mr-1" />
                  {ROLE_LABELS[u.role]}
                </Badge>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{u.ativo ? "Ativo" : "Inativo"}</span>
                  <Switch
                    checked={u.ativo}
                    onCheckedChange={v => updateMutation.mutate({ id: u.id, ativo: v })}
                  />
                </div>
              </div>

              {/* Stats */}
              {u._count && (
                <div className="mt-3 pt-3 border-t border-border/50 flex gap-4 text-xs text-muted-foreground">
                  <span>{u._count.clientes} clientes</span>
                  <span>{u._count.leads} leads</span>
                  <span>{u._count.oportunidades} oportunidades</span>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Hidden file input for avatar upload */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarSelect}
      />

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover funcionário?</AlertDialogTitle>
            <AlertDialogDescription>
              O acesso de <strong>{deleteTarget?.nome}</strong> será desativado. Esta ação pode ser revertida reativando o usuário.
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

      {cropSrc && (
        <AvatarCropDialog
          open={!!cropSrc}
          imageSrc={cropSrc}
          onClose={() => setCropSrc(null)}
          onConfirm={handleCropConfirm}
          loading={!!uploadingUserId}
        />
      )}

      {/* Permissions Table */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Matriz de Permissões por Perfil
        </h3>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Módulo</th>
                  <th className="text-center p-3 font-medium">Administrador</th>
                  <th className="text-center p-3 font-medium">Gestor</th>
                  <th className="text-center p-3 font-medium">Comercial</th>
                  <th className="text-center p-3 font-medium">Operacional</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS_TABLE.map(row => (
                  <tr key={row.modulo} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">{row.modulo}</td>
                    {[row.admin, row.gestor, row.comercial, row.operacional].map((v, i) => (
                      <td key={i} className="p-3 text-center">
                        {v === true ? (
                          <span className="text-emerald-500 font-bold">✓</span>
                        ) : v === false ? (
                          <span className="text-muted-foreground/30">—</span>
                        ) : (
                          <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                            {v}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
