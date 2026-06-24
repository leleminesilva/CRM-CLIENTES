"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft, Edit, Trash2, User, Phone, Mail, MapPin,
  Clock, MessageSquare, TrendingUp, CheckSquare, ExternalLink,
  ClipboardList, FileText, Flame, Minus, Snowflake,
  PhoneCall, MessageCircle, FileCheck, Handshake, ThumbsUp, ThumbsDown, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatCurrency, formatCPFCNPJ, formatPhone, ORIGEM_LABELS, PORTE_LABELS, formatDateTime } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";
import type { Cliente } from "@/types";

type EstagioLead = "NOVO_LEAD" | "CONTATO_INICIAL" | "QUALIFICACAO" | "PROPOSTA_ENVIADA" | "NEGOCIACAO" | "FECHADO_GANHO" | "FECHADO_PERDIDO";

const ETAPAS: { estagio: EstagioLead; label: string; icon: React.ElementType }[] = [
  { estagio: "NOVO_LEAD",        label: "Entrar em Contato",  icon: PhoneCall },
  { estagio: "CONTATO_INICIAL",  label: "Contato Feito",      icon: MessageCircle },
  { estagio: "QUALIFICACAO",     label: "Visita / Medição",   icon: ClipboardList },
  { estagio: "PROPOSTA_ENVIADA", label: "Orçamento Enviado",  icon: FileCheck },
  { estagio: "NEGOCIACAO",       label: "Em Negociação",      icon: Handshake },
];

function PipelineTracker({
  leadId, clienteId, clienteNome, estagio, onUpdate,
}: {
  leadId: string | null;
  clienteId: string;
  clienteNome: string;
  estagio: EstagioLead;
  onUpdate: () => void;
}) {
  const mutation = useMutation({
    mutationFn: async (novoEstagio: EstagioLead) => {
      if (leadId) {
        return axios.patch(`/api/leads/${leadId}/mover`, { estagio: novoEstagio });
      }
      // Cria o lead vinculado ao cliente se ainda não existir
      return axios.post("/api/leads", {
        titulo: clienteNome,
        estagio: novoEstagio,
        origem: "OUTROS",
        clienteId,
      });
    },
    onSuccess: () => { toast.success("Etapa atualizada!"); onUpdate(); },
    onError: () => toast.error("Erro ao atualizar etapa"),
  });

  const isFechado = estagio === "FECHADO_GANHO" || estagio === "FECHADO_PERDIDO";
  const currentIdx = ETAPAS.findIndex(e => e.estagio === estagio);

  return (
    <div className="bg-card border rounded-xl p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Processo de Venda</p>
      <div className="flex items-center gap-1 flex-wrap">
        {ETAPAS.map((etapa, idx) => {
          const Icon = etapa.icon;
          const isPast   = !isFechado && idx < currentIdx;
          const isActive = !isFechado && idx === currentIdx;

          return (
            <div key={etapa.estagio} className="flex items-center gap-1">
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(etapa.estagio)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                  isActive && "bg-indigo-600 text-white border-indigo-600 shadow-sm",
                  isPast   && "bg-indigo-600/20 text-indigo-400 border-indigo-600/30 hover:bg-indigo-600/30",
                  !isActive && !isPast && "bg-muted text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="w-3 h-3" />
                {etapa.label}
              </button>
              {idx < ETAPAS.length - 1 && (
                <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
              )}
            </div>
          );
        })}

        <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />

        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("FECHADO_GANHO")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
            estagio === "FECHADO_GANHO"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
              : "bg-emerald-600/10 text-emerald-500 border-emerald-600/30 hover:bg-emerald-600/20",
          )}
        >
          <ThumbsUp className="w-3 h-3" /> Confirmado
        </button>

        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("FECHADO_PERDIDO")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
            estagio === "FECHADO_PERDIDO"
              ? "bg-red-600 text-white border-red-600 shadow-sm"
              : "bg-red-600/10 text-red-500 border-red-600/30 hover:bg-red-600/20",
          )}
        >
          <ThumbsDown className="w-3 h-3" /> Cancelado
        </button>
      </div>
    </div>
  );
}

export default function ClienteDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente", id],
    queryFn: async () => {
      const { data } = await axios.get(`/api/clientes/${id}`);
      return data.data as Cliente & {
        atividades: Array<{ id: string; descricao: string; createdAt: string; user: { nome: string } }>;
        comentarios: Array<{ id: string; texto: string; createdAt: string; user: { nome: string } }>;
        leads: Array<{ id: string; titulo: string; estagio: string; valorEstimado: number }>;
        oportunidades: Array<{ id: string; titulo: string; valor: number; status: string }>;
        tarefas: Array<{ id: string; titulo: string; status: string; dataVencimento: string }>;
      };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => axios.delete(`/api/clientes/${id}`),
    onSuccess: () => { toast.success("Cliente removido"); router.push("/clientes"); },
    onError: () => toast.error("Erro ao remover"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-48 bg-muted rounded-xl" />
      </div>
    );
  }

  if (!cliente) return <div className="text-muted-foreground">Cliente não encontrado</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold">{cliente.nome}</h2>
            {cliente.porte && <Badge variant="secondary">{PORTE_LABELS[cliente.porte]}</Badge>}
            <Badge variant="info">{ORIGEM_LABELS[cliente.origem]}</Badge>
          </div>
          {cliente.nomeFantasia && <p className="text-muted-foreground">{cliente.nomeFantasia}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={`/clientes/${id}/editar`}>
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Remover
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={() => deleteMutation.mutate()}
                >
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Pipeline — sempre visível */}
      <PipelineTracker
        leadId={cliente.leads?.[0]?.id ?? null}
        clienteId={id}
        clienteNome={cliente.nome}
        estagio={(cliente.leads?.[0]?.estagio as EstagioLead) ?? "NOVO_LEAD"}
        onUpdate={() => qc.invalidateQueries({ queryKey: ["cliente", id] })}
      />

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Contato</p>
          <div className="space-y-1.5">
            {cliente.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <a href={`mailto:${cliente.email}`} className="hover:underline">{cliente.email}</a>
              </div>
            )}
            {(cliente.telefone || cliente.whatsapp) && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{formatPhone(cliente.telefone || cliente.whatsapp || "")}</span>
              </div>
            )}
            {cliente.cpfCnpj && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{formatCPFCNPJ(cliente.cpfCnpj)}</span>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Endereço</p>
          {(cliente.logradouro || cliente.bairro || cliente.cidade || cliente.cep) ? (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                {cliente.tipoResidencia && (
                  <p className="font-medium text-xs text-muted-foreground">
                    {cliente.tipoResidencia === "CASA" ? "Casa" :
                     cliente.tipoResidencia === "APARTAMENTO" ? "Apartamento" :
                     cliente.tipoResidencia === "COMERCIAL" ? "Comercial" : "Outros"}
                  </p>
                )}
                {(cliente.logradouro || cliente.numero || cliente.complemento) && (
                  <p>
                    {[cliente.logradouro, cliente.numero, cliente.complemento].filter(Boolean).join(", ")}
                  </p>
                )}
                {(cliente.bairro || cliente.cidade || cliente.estado) && (
                  <p className="text-muted-foreground">
                    {[cliente.bairro, cliente.cidade && cliente.estado ? `${cliente.cidade}/${cliente.estado}` : (cliente.cidade || cliente.estado)].filter(Boolean).join(" — ")}
                  </p>
                )}
                {cliente.cep && (
                  <p className="text-muted-foreground">CEP: {cliente.cep}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem endereço cadastrado</p>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Vendedor</p>
          {cliente.responsavel ? (
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs bg-indigo-100 text-indigo-600">
                  {cliente.responsavel.nome.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{cliente.responsavel.nome}</p>
                <p className="text-xs text-muted-foreground">{cliente.responsavel.email}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem vendedor atribuído</p>
          )}
        </Card>
      </div>

      {/* Ficha de Atendimento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" /> Atendimento
          </p>
          <div className="space-y-2 text-sm">
            {cliente.dataInscricao && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data de inscrição</span>
                <span className="font-medium">{new Date(cliente.dataInscricao).toLocaleDateString("pt-BR")}</span>
              </div>
            )}
            {cliente.servicoBuscado && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Serviço buscado</span>
                <span className="font-medium">{cliente.servicoBuscado}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Temperatura</span>
              <span className="flex items-center gap-1 font-medium">
                {cliente.temperatura === "QUENTE" && <><Flame className="w-3.5 h-3.5 text-red-500" /> Quente</>}
                {cliente.temperatura === "MORNO"  && <><Minus className="w-3.5 h-3.5 text-amber-500" /> Morno</>}
                {cliente.temperatura === "FRIO"   && <><Snowflake className="w-3.5 h-3.5 text-blue-500" /> Frio</>}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Orçamento
          </p>
          <div className="space-y-2 text-sm">
            {cliente.numeroOrcamento && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Número</span>
                <span className="font-medium font-mono">{cliente.numeroOrcamento}</span>
              </div>
            )}
            {cliente.valorOrcamento && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor</span>
                <span className="font-semibold text-emerald-600">{formatCurrency(Number(cliente.valorOrcamento))}</span>
              </div>
            )}
            {cliente.prazoOrcamento && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prazo</span>
                <span className="font-medium">{new Date(cliente.prazoOrcamento).toLocaleDateString("pt-BR")}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={
                cliente.statusOrcamento === "APROVADO" ? "success" :
                cliente.statusOrcamento === "NAO_APROVADO" ? "destructive" : "secondary"
              }>
                {cliente.statusOrcamento === "APROVADO" ? "✅ Aprovado" :
                 cliente.statusOrcamento === "NAO_APROVADO" ? "❌ Não Aprovado" : "⏳ Pendente"}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {cliente.observacoes && (
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Observações</p>
          <p className="text-sm whitespace-pre-wrap">{cliente.observacoes}</p>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="historico">
        <TabsList>
          <TabsTrigger value="historico">
            <Clock className="w-4 h-4 mr-2" />
            Histórico ({(cliente.atividades || []).length})
          </TabsTrigger>
          <TabsTrigger value="leads">
            <TrendingUp className="w-4 h-4 mr-2" />
            Leads ({(cliente.leads || []).length})
          </TabsTrigger>
          <TabsTrigger value="tarefas">
            <CheckSquare className="w-4 h-4 mr-2" />
            Tarefas ({(cliente.tarefas || []).length})
          </TabsTrigger>
          <TabsTrigger value="comentarios">
            <MessageSquare className="w-4 h-4 mr-2" />
            Comentários ({(cliente.comentarios || []).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="historico" className="mt-4">
          <div className="space-y-3">
            {(cliente.atividades || []).length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma atividade registrada</p>
            ) : (
              cliente.atividades.map(a => (
                <div key={a.id} className="flex gap-3 items-start">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm">{a.descricao}</p>
                    <p className="text-xs text-muted-foreground">{a.user.nome} · {formatDateTime(a.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <div className="space-y-2">
            {(cliente.leads || []).length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum lead vinculado</p>
            ) : (
              cliente.leads.map(l => (
                <Card key={l.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{l.titulo}</p>
                    <Badge variant="outline" className="text-xs mt-1">{l.estagio.replace("_", " ")}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.valorEstimado && <p className="text-sm font-semibold">{formatCurrency(l.valorEstimado)}</p>}
                    <Link href={`/leads`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="tarefas" className="mt-4">
          <div className="space-y-2">
            {(cliente.tarefas || []).length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma tarefa vinculada</p>
            ) : (
              cliente.tarefas.map(t => (
                <Card key={t.id} className="p-3 flex items-center justify-between">
                  <p className="font-medium text-sm">{t.titulo}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={t.status === "CONCLUIDA" ? "success" : t.status === "ATRASADA" ? "destructive" : "secondary"}>
                      {t.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground">{formatDateTime(t.dataVencimento)}</p>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="comentarios" className="mt-4">
          <div className="space-y-3">
            {(cliente.comentarios || []).length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum comentário</p>
            ) : (
              cliente.comentarios.map(c => (
                <Card key={c.id} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-600">
                        {c.user.nome.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-medium">{c.user.nome}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.texto}</p>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
