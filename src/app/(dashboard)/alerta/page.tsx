"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { toast } from "sonner";
import { Bell, Trash2, Megaphone, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserOption {
  id: string;
  nome: string;
  email: string;
  role: string;
}

interface AlertaItem {
  id: string;
  titulo: string;
  mensagem: string;
  criadoEm: string;
  destinoUserId?: string | null;
  destinoUser?: { id: string; nome: string } | null;
  criador: { id: string; nome: string };
  _count?: {
    leituras: number;
  };
}

export default function AlertaPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [form, setForm] = useState({
    titulo: "",
    mensagem: "",
    destinoUserId: "todos", // "todos" indica alerta coletivo (destinoUserId = null)
  });

  // Buscar usuários ativos para preencher o select
  const { data: usersData } = useQuery<{ data: UserOption[] }>({
    queryKey: ["usuarios-ativos"],
    queryFn: async () => {
      const { data } = await axios.get("/api/usuarios/ativos");
      return data;
    },
  });

  // Buscar histórico de alertas criados (para gerenciamento)
  const { data: alertasData, isLoading: loadingAlertas } = useQuery<{ data: AlertaItem[] }>({
    queryKey: ["alertas-gerenciamento"],
    queryFn: async () => {
      const { data } = await axios.get("/api/alertas?gerenciamento=true");
      return data;
    },
    enabled: user?.role === "ADMINISTRADOR" || user?.role === "DESENVOLVEDOR",
  });

  // Mutação para criar alerta
  const createMutation = useMutation({
    mutationFn: (payload: { titulo: string; mensagem: string; destinoUserId: string | null }) => {
      return axios.post("/api/alertas", payload);
    },
    onSuccess: () => {
      toast.success("Alerta criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["alertas-gerenciamento"] });
      setForm({ titulo: "", mensagem: "", destinoUserId: "todos" });
    },
    onError: (err: AxiosError<{ error?: string }>) => {
      toast.error(err.response?.data?.error || "Erro ao criar alerta");
    },
  });

  // Mutação para excluir alerta
  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      return axios.delete(`/api/alertas/${id}`);
    },
    onSuccess: () => {
      toast.success("Alerta excluído!");
      queryClient.invalidateQueries({ queryKey: ["alertas-gerenciamento"] });
    },
    onError: () => {
      toast.error("Erro ao excluir alerta");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.mensagem.trim()) {
      return toast.error("Preencha todos os campos obrigatórios");
    }

    createMutation.mutate({
      titulo: form.titulo,
      mensagem: form.mensagem,
      destinoUserId: form.destinoUserId === "todos" ? null : form.destinoUserId,
    });
  }

  if (user?.role !== "ADMINISTRADOR" && user?.role !== "DESENVOLVEDOR") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <p className="text-lg font-medium text-red-500">Acesso negado</p>
        <p className="text-muted-foreground text-sm">Apenas administradores podem gerenciar alertas.</p>
      </div>
    );
  }

  const users = usersData?.data ?? [];
  const alertas = alertasData?.data ?? [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">Gerenciador de Alertas</h2>
        <p className="text-muted-foreground">Envie recados e alertas importantes no meio da tela dos funcionários</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário de Criação */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-indigo-500" />
              Novo Alerta
            </CardTitle>
            <CardDescription>
              Crie avisos que aparecerão como popups para os destinatários.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="destino">Destinatário</Label>
                <Select
                  value={form.destinoUserId}
                  onValueChange={(val) => setForm(f => ({ ...f, destinoUserId: val }))}
                >
                  <SelectTrigger id="destino">
                    <SelectValue placeholder="Selecione o destinatário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">📣 Todos (Coletivo)</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        👤 {u.nome} ({u.role.toLowerCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="titulo">Título do Alerta *</Label>
                <Input
                  id="titulo"
                  placeholder="Ex: Atualização do sistema"
                  value={form.titulo}
                  onChange={(e) => setForm(f => ({ ...f, titulo: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mensagem">Mensagem do Alerta *</Label>
                <Textarea
                  id="mensagem"
                  placeholder="Escreva a instrução ou recado aqui..."
                  rows={4}
                  value={form.mensagem}
                  onChange={(e) => setForm(f => ({ ...f, mensagem: e.target.value }))}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Disparando..." : "Disparar Alerta"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Histórico e Gerenciamento */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-500" />
              Histórico de Alertas Enviados
            </CardTitle>
            <CardDescription>
              Visualize os alertas ativos e acompanhe as visualizações.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAlertas ? (
              <p className="text-sm text-muted-foreground text-center py-8">Carregando histórico...</p>
            ) : alertas.length === 0 ? (
              <div className="text-center py-12 border rounded-lg border-dashed text-muted-foreground">
                <Megaphone className="w-8 h-8 mx-auto opacity-35 mb-2" />
                <p className="text-sm">Nenhum alerta enviado recentemente.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {alertas.map((alerta) => (
                  <div
                    key={alerta.id}
                    className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border rounded-xl bg-card hover:bg-accent/10 transition-colors gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          alerta.destinoUserId ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" : "bg-purple-500/10 text-purple-500 border border-purple-500/20"
                        }`}>
                          {alerta.destinoUserId ? `Individual: ${alerta.destinoUser?.nome}` : "Coletivo (Todos)"}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(alerta.criadoEm), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <h4 className="font-bold text-foreground leading-snug">{alerta.titulo}</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{alerta.mensagem}</p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0">
                      <div className="flex flex-col md:items-end text-xs">
                        <span className="text-muted-foreground">Status</span>
                        <span className="font-semibold text-emerald-500 flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {alerta._count?.leituras ?? 0} leituras
                        </span>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8"
                        onClick={() => {
                          if (confirm("Tem certeza que deseja excluir e retirar esse alerta da tela dos usuários?")) {
                            deleteMutation.mutate(alerta.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
