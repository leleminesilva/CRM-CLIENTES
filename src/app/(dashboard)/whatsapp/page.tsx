"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  useDroppable, type DragEndEvent,
} from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageCircle, Plus, Trash2, Phone, Send,
  Loader2, Settings, ChevronLeft, Check, CheckCheck,
  Search, Smartphone, RefreshCw, PowerOff, ChevronDown, ChevronUp, History,
  Paperclip, FileText, X as XIcon, Download, UserRound, ExternalLink, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { WHATSAPP_STANDBY } from "@/lib/rbac";

// ── Types ──────────────────────────────────────────────────────────────────

interface Sessao {
  id: string;
  nome: string;
  numero?: string | null;
  status: "ONLINE" | "OFFLINE" | "RECONNECTING" | "WAITING_QR" | "ERROR" | "UNKNOWN";
  healthStatus: "HEALTHY" | "STALE" | "UNKNOWN";
  ativo: boolean;
  atendenteId: string | null;
  atendente: { id: string; nome: string } | null;
}

interface Mensagem {
  id: string;
  direcao: "entrada" | "saida";
  tipo: string;
  conteudo: string;
  mediaUrl?: string | null;
  status: string;
  enviadaEm: string;
}

interface ClienteVinculado {
  id: string;
  nome: string;
  cidade?: string | null;
  estado?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
}

type ConversaStatus = "ABERTA" | "PENDENTE" | "RESOLVIDA";
type FiltroFila = "todas" | "minhas" | "nao_atribuidas" | "pendentes" | "resolvidas";

interface Conversa {
  id: string;
  sessaoId: string;
  contatoPhone: string;
  contatoNome?: string;
  naoLidas: number;
  ultimaMsgEm?: string;
  mensagens?: Mensagem[];
  agentEstado?: { estado: string } | null;
  cliente?: ClienteVinculado | null;
  status?: ConversaStatus;
  etapa?: EtapaQuadro;
  responsavelId?: string | null;
  responsavel?: { id: string; nome: string } | null;
}

const STATUS_LABEL: Record<ConversaStatus, string> = {
  ABERTA: "Aberta",
  PENDENTE: "Pendente",
  RESOLVIDA: "Resolvida",
};
const STATUS_COR: Record<ConversaStatus, string> = {
  ABERTA: "text-blue-500",
  PENDENTE: "text-amber-500",
  RESOLVIDA: "text-green-500",
};
const FILTROS_FILA: { id: FiltroFila; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "minhas", label: "Minhas" },
  { id: "nao_atribuidas", label: "Não atribuídas" },
  { id: "pendentes", label: "Pendentes" },
  { id: "resolvidas", label: "Resolvidas" },
];

type EtapaQuadro =
  | "NOVA" | "EM_ATENDIMENTO" | "AGUARDANDO_CLIENTE"
  | "ORCAMENTO_ENVIADO" | "FECHADO" | "SEM_RETORNO";

function formatDuracao(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

const RESPOSTAS_RAPIDAS = [
  "Bom dia! Como posso ajudar?",
  "Pode me passar as medidas (largura × altura)?",
  "Qual o tipo de vidro? (temperado, comum, laminado…)",
  "Você é de qual cidade?",
  "Vou confirmar o valor com a equipe e já te retorno 👍",
  "Consegue me mandar uma foto do local?",
];

const ETAPAS_QUADRO: { id: EtapaQuadro; label: string; cor: string }[] = [
  { id: "NOVA",               label: "Novas",              cor: "bg-slate-400" },
  { id: "EM_ATENDIMENTO",     label: "Em atendimento",     cor: "bg-blue-500" },
  { id: "AGUARDANDO_CLIENTE", label: "Aguardando cliente", cor: "bg-amber-500" },
  { id: "ORCAMENTO_ENVIADO",  label: "Orçamento enviado",  cor: "bg-green-500" },
  { id: "FECHADO",            label: "Fechado",            cor: "bg-emerald-600" },
  { id: "SEM_RETORNO",        label: "Sem retorno",        cor: "bg-rose-500" },
];

const BOT_ATIVO_ESTADOS = ["TRIAGEM", "COLETANDO", "AGUARDANDO_CONFIRMACAO"];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return phone;
}

function formatTime(date: string) {
  const d = new Date(date);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM/yy", { locale: ptBR });
}

function formatMsgTime(date: string) {
  return format(new Date(date), "HH:mm");
}

function getInitials(name?: string, phone?: string) {
  if (name) return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (phone ?? "?").slice(-2);
}

function StatusIcon({ status }: { status: string }) {
  if (status === "lida") return <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />;
  if (status === "entregue") return <CheckCheck className="w-3.5 h-3.5 text-black/45 dark:text-white/60" />;
  return <Check className="w-3.5 h-3.5 text-black/45 dark:text-white/60" />;
}

// ── Modal de nova sessão ───────────────────────────────────────────────────
// QR Code chega ao vivo via Supabase Realtime (broadcast efêmero, nunca
// persistido) — sem polling. GET /qrcode é só o fallback caso o broadcast
// tenha passado antes da tela abrir. Ver docs/architecture/whatsapp.md.

function useQrCodeAoVivo(sessaoId: string | null) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<Sessao["status"]>("UNKNOWN");

  useEffect(() => {
    if (!sessaoId) return;
    setQrCode(null);
    setStatus("UNKNOWN");

    // Fallback: busca o que já existir antes de assinar o canal.
    axios.get(`/api/whatsapp/sessoes/${sessaoId}/qrcode`).then(({ data }) => {
      setQrCode(data.qrCode ?? null);
      setStatus(data.status);
    }).catch(() => {});

    const channel = supabase.channel(`whatsapp-sessao-${sessaoId}`);
    channel.on("broadcast", { event: "sessao_atualizada" }, ({ payload }) => {
      if (payload.qrCode !== undefined) setQrCode(payload.qrCode);
      if (payload.status) setStatus(payload.status);
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessaoId]);

  return { qrCode, status };
}

function ModalNovaSessao({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessaoCriadaId, setSessaoCriadaId] = useState<string | null>(null);
  const { qrCode, status } = useQrCodeAoVivo(sessaoCriadaId);

  async function handleSave() {
    if (!nome) {
      toast.error("Preencha o nome da sessão");
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post("/api/whatsapp/sessoes", { nome });
      setSessaoCriadaId(data.id);
      onSaved();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Erro ao criar sessão");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setNome("");
    setSessaoCriadaId(null);
    onClose();
  }

  useEffect(() => {
    if (status === "ONLINE" && sessaoCriadaId) {
      toast.success("WhatsApp conectado!");
      handleClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-green-500" />
            {sessaoCriadaId ? "Escaneie o QR Code" : "Nova sessão WhatsApp"}
          </DialogTitle>
        </DialogHeader>

        {!sessaoCriadaId ? (
          <>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                A conexão é feita escaneando um QR Code pelo WhatsApp do celular — nenhuma credencial
                é digitada aqui.
              </p>
              <div className="space-y-2">
                <Label>Nome da sessão <span className="text-red-500">*</span></Label>
                <Input placeholder="Ex: Comercial, Suporte..." value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleSave} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar sessão
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 py-4">
            {qrCode ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrCode} alt="QR Code do WhatsApp" className="w-56 h-56 rounded-lg border border-border" />
            ) : (
              <div className="w-56 h-56 rounded-lg border border-border flex items-center justify-center bg-muted">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">
              WhatsApp → Aparelhos conectados → Conectar um aparelho
            </p>
            <Badge variant="secondary">{status}</Badge>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Painel de sessões ──────────────────────────────────────────────────────

const STATUS_DOT: Record<Sessao["status"], string> = {
  ONLINE: "bg-green-500",
  WAITING_QR: "bg-amber-500",
  RECONNECTING: "bg-amber-500",
  OFFLINE: "bg-muted-foreground",
  ERROR: "bg-red-500",
  UNKNOWN: "bg-muted-foreground",
};

function PainelSessoes({
  sessoes,
  selected,
  onSelect,
  onAdd,
  podeAdicionar,
}: {
  sessoes: Sessao[];
  selected: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  podeAdicionar: boolean;
}) {
  return (
    <div className="w-16 md:w-20 flex flex-col bg-sidebar border-r border-border shrink-0">
      <div className="h-14 flex items-center justify-center border-b border-border">
        <MessageCircle className="w-6 h-6 text-green-500" />
      </div>
      <ScrollArea className="flex-1">
        <div className="py-2 flex flex-col items-center gap-2 px-2">
          {sessoes.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              title={`${s.nome} — ${s.status}`}
              className={cn(
                "relative w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all",
                selected === s.id
                  ? "bg-green-600 text-white shadow-lg scale-105"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              {getInitials(s.nome)}
              <span className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background", STATUS_DOT[s.status])} />
            </button>
          ))}
        </div>
      </ScrollArea>
      {podeAdicionar && (
        <div className="p-2 border-t border-border flex flex-col items-center gap-1">
          <Button size="icon" variant="ghost" className="w-10 h-10 rounded-xl" onClick={onAdd} title="Nova sessão">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Lista de conversas ─────────────────────────────────────────────────────

function ListaConversas({
  conversas,
  sessao,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  filtro,
  onFiltroChange,
}: {
  conversas: Conversa[];
  sessao: Sessao | undefined;
  selectedId: string | null;
  onSelect: (c: Conversa) => void;
  search: string;
  onSearchChange: (v: string) => void;
  filtro: FiltroFila;
  onFiltroChange: (f: FiltroFila) => void;
}) {
  const filtered = conversas.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.contatoNome?.toLowerCase().includes(q) ||
      c.contatoPhone.includes(q)
    );
  });

  return (
    <div className="w-full md:w-80 flex flex-col border-r border-border shrink-0">
      <div className="h-14 flex items-center px-4 border-b border-border gap-2 bg-[#f0f2f5] dark:bg-[#202c33]">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{sessao?.nome ?? "Selecione uma sessão"}</p>
          {sessao?.numero && (
            <p className="text-xs text-muted-foreground">{formatPhone(sessao.numero)}</p>
          )}
        </div>
      </div>

      <div className="p-2 border-b border-border bg-[#f0f2f5] dark:bg-[#202c33] space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-sm rounded-full bg-white dark:bg-[#2a3942] border-none"
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
          {FILTROS_FILA.map((f) => (
            <button
              key={f.id}
              onClick={() => onFiltroChange(f.id)}
              className={cn(
                "shrink-0 text-xs font-medium px-2.5 py-1 rounded-full transition-colors",
                filtro === f.id
                  ? "bg-green-600 text-white"
                  : "bg-white/70 dark:bg-white/5 text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <MessageCircle className="w-8 h-8 opacity-30" />
            <p className="text-sm">Nenhuma conversa</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((c) => {
              const lastMsg = c.mensagens?.[0];
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left",
                    selectedId === c.id && "bg-accent"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center text-sm font-bold shrink-0">
                    {getInitials(c.contatoNome, c.contatoPhone)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={cn("text-sm truncate flex items-center gap-1", c.naoLidas > 0 && "font-semibold")}>
                        {c.contatoNome ?? formatPhone(c.contatoPhone)}
                        {c.agentEstado && BOT_ATIVO_ESTADOS.includes(c.agentEstado.estado) && (
                          <span title="Agente de IA está atendendo" className="shrink-0">🤖</span>
                        )}
                      </span>
                      {c.ultimaMsgEm && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatTime(c.ultimaMsgEm)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <span className="text-xs text-muted-foreground truncate">
                        {lastMsg
                          ? lastMsg.direcao === "saida"
                            ? `Você: ${lastMsg.conteudo}`
                            : lastMsg.conteudo
                          : formatPhone(c.contatoPhone)}
                      </span>
                      {c.naoLidas > 0 && (
                        <Badge className="bg-green-600 text-white h-5 min-w-[20px] shrink-0 text-xs px-1.5">
                          {c.naoLidas}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ── Área do chat ───────────────────────────────────────────────────────────

function BolhaMedia({ msg }: { msg: Mensagem }) {
  if (!msg.mediaUrl) return null;
  if (msg.tipo === "imagem") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={msg.mediaUrl} alt={msg.conteudo || "Imagem"} className="rounded-lg max-w-full max-h-64 mb-1.5" />;
  }
  if (msg.tipo === "video") {
    return <video src={msg.mediaUrl} controls className="rounded-lg max-w-full max-h-64 mb-1.5" />;
  }
  if (msg.tipo === "audio") {
    return <audio src={msg.mediaUrl} controls className="mb-1.5 max-w-full" />;
  }
  return (
    <a
      href={msg.mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 bg-black/5 dark:bg-white/5 rounded-lg px-3 py-2 mb-1.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
    >
      <FileText className="w-5 h-5 shrink-0" />
      <span className="text-sm truncate">{msg.conteudo || "Documento"}</span>
      <Download className="w-4 h-4 shrink-0 ml-auto opacity-60" />
    </a>
  );
}

function AreaChat({
  conversa,
  onBack,
}: {
  conversa: Conversa | null;
  onBack: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["wa-mensagens", conversa?.id],
    queryFn: async () => {
      const { data } = await axios.get(`/api/whatsapp/conversas/${conversa!.id}`);
      return data as { mensagens: Mensagem[] };
    },
    enabled: !!conversa?.id,
  });

  // Sem polling — o webhook emite ConversationUpdated, que publica nesse
  // canal (ver src/lib/whatsapp/handlers.ts e realtime.ts). A conversa em
  // aberto invalida a query e busca o que mudou.
  useEffect(() => {
    if (!conversa?.id) return;
    const channel = supabase.channel(`whatsapp-conversa-${conversa.id}`);
    channel.on("broadcast", { event: "conversa_atualizada" }, () => {
      queryClient.invalidateQueries({ queryKey: ["wa-mensagens", conversa.id] });
      queryClient.invalidateQueries({ queryKey: ["wa-conversas"] });
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversa?.id, queryClient]);

  const enviar = useMutation({
    mutationFn: async ({ mensagem, file }: { mensagem?: string; file?: File | null }) => {
      const formData = new FormData();
      formData.append("conversaId", conversa!.id);
      if (mensagem) formData.append("mensagem", mensagem);
      if (file) formData.append("file", file);
      const { data } = await axios.post("/api/whatsapp/enviar", formData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-mensagens", conversa?.id] });
      queryClient.invalidateQueries({ queryKey: ["wa-conversas"] });
      setTexto("");
      setArquivo(null);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Erro ao enviar mensagem");
    },
  });

  const sugerir = useMutation({
    mutationFn: async () => {
      const { data } = await axios.post(`/api/whatsapp/conversas/${conversa!.id}/sugerir`);
      return data as { sugestao: string };
    },
    onSuccess: (d) => setTexto(d.sugestao),
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Não foi possível gerar a sugestão");
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.mensagens]);

  function handleEnviar() {
    if (!texto.trim() && !arquivo) return;
    enviar.mutate({ mensagem: texto.trim() || undefined, file: arquivo });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  }

  if (!conversa) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
        <MessageCircle className="w-16 h-16 opacity-20" />
        <div className="text-center">
          <p className="font-medium">Selecione uma conversa</p>
          <p className="text-sm mt-1">Escolha um contato para ver as mensagens</p>
        </div>
      </div>
    );
  }

  const mensagens = data?.mensagens ?? [];

  // Agrupa mensagens por data
  const groups: { date: string; msgs: Mensagem[] }[] = [];
  for (const msg of mensagens) {
    const d = format(new Date(msg.enviadaEm), "yyyy-MM-dd");
    const last = groups[groups.length - 1];
    if (last?.date === d) {
      last.msgs.push(msg);
    } else {
      groups.push({ date: d, msgs: [msg] });
    }
  }

  function labelDate(d: string) {
    const date = new Date(d);
    if (isToday(date)) return "Hoje";
    if (isYesterday(date)) return "Ontem";
    return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  }

  return (
    <div className="flex-1 flex min-w-0">
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-border bg-[#f0f2f5] dark:bg-[#202c33] shrink-0">
        <button onClick={onBack} className="md:hidden p-1 -ml-1 rounded hover:bg-accent">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center text-sm font-bold shrink-0">
          {getInitials(conversa.contatoNome, conversa.contatoPhone)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            {conversa.contatoNome ?? formatPhone(conversa.contatoPhone)}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {formatPhone(conversa.contatoPhone)}
          </p>
        </div>
      </div>

      {/* Mensagens */}
      <ScrollArea
        className="flex-1 px-4 py-4 bg-[#efeae2] dark:bg-[#0b141a] [--wa-dot:rgba(0,0,0,0.06)] dark:[--wa-dot:rgba(255,255,255,0.04)]"
        style={{ backgroundImage: "radial-gradient(circle, var(--wa-dot) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      >
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex justify-center py-8 text-muted-foreground text-sm">
            Nenhuma mensagem ainda
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.date}>
                <div className="flex justify-center mb-3">
                  <span className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">
                    {labelDate(g.date)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {g.msgs.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex",
                        msg.direcao === "saida" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                          msg.direcao === "saida"
                            ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-white rounded-tr-sm"
                            : "bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] rounded-tl-sm border border-black/5 dark:border-white/5"
                        )}
                      >
                        <BolhaMedia msg={msg} />
                        {(msg.tipo === "texto" || msg.conteudo) && msg.tipo !== "documento" && (
                          <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
                        )}
                        <div className={cn(
                          "flex items-center gap-1 mt-1",
                          msg.direcao === "saida" ? "justify-end" : "justify-start"
                        )}>
                          <span className={cn(
                            "text-[10px]",
                            msg.direcao === "saida" ? "text-black/45 dark:text-white/60" : "text-muted-foreground"
                          )}>
                            {formatMsgTime(msg.enviadaEm)}
                          </span>
                          {msg.direcao === "saida" && <StatusIcon status={msg.status} />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border bg-[#f0f2f5] dark:bg-[#202c33] shrink-0">
        {arquivo && (
          <div className="flex items-center gap-2 bg-white dark:bg-[#2a3942] rounded-lg px-3 py-2 mb-2 text-sm">
            <Paperclip className="w-4 h-4 shrink-0 text-muted-foreground" />
            <span className="truncate flex-1">{arquivo.name}</span>
            <button onClick={() => setArquivo(null)} className="text-muted-foreground hover:text-foreground">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-1.5 mb-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => sugerir.mutate()}
            disabled={sugerir.isPending || mensagens.length === 0}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold rounded-full border border-blue-500/40 text-blue-600 dark:text-blue-400 px-2.5 py-1 hover:bg-blue-500/10 disabled:opacity-50"
          >
            {sugerir.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Sugerir resposta
          </button>
          {RESPOSTAS_RAPIDAS.map((r) => (
            <button
              key={r}
              onClick={() => setTexto((t) => (t.trim() ? `${t} ${r}` : r))}
              className="shrink-0 text-xs font-medium rounded-full bg-white/70 dark:bg-white/5 text-muted-foreground hover:text-foreground px-2.5 py-1"
            >
              {r.length > 32 ? r.slice(0, 30) + "…" : r}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
          <Button
            size="icon"
            variant="ghost"
            className="w-10 h-10 rounded-xl shrink-0"
            onClick={() => fileInputRef.current?.click()}
            title="Anexar arquivo"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem... (Enter para enviar)"
            rows={1}
            className="flex-1 resize-none rounded-xl border-none bg-white dark:bg-[#2a3942] px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500/30 transition-all min-h-[42px] max-h-32"
            style={{ scrollbarWidth: "none" }}
          />
          <Button
            size="icon"
            disabled={(!texto.trim() && !arquivo) || enviar.isPending}
            onClick={handleEnviar}
            className="w-10 h-10 rounded-xl bg-green-600 hover:bg-green-700 text-white shrink-0"
          >
            {enviar.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
    <PainelContexto conversa={conversa} />
    </div>
  );
}

// ── Painel de contexto (ficha do cliente na conversa) ─────────────────────

function PainelContexto({ conversa }: { conversa: Conversa }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [busca, setBusca] = useState("");
  const [vinculando, setVinculando] = useState(false);
  const [atribuindo, setAtribuindo] = useState(false);
  const cliente = conversa.cliente ?? null;
  const status: ConversaStatus = conversa.status ?? "ABERTA";

  const { data: resultados = [] } = useQuery({
    queryKey: ["clientes-busca-wa", busca],
    queryFn: async () => {
      const { data } = await axios.get(`/api/clientes?search=${encodeURIComponent(busca)}&limit=6`);
      return (data.clientes ?? data ?? []) as ClienteVinculado[];
    },
    enabled: vinculando && busca.trim().length >= 2,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios-ativos-wa"],
    queryFn: async () => {
      const { data } = await axios.get("/api/usuarios/ativos");
      return (data.data ?? []) as { id: string; nome: string }[];
    },
    enabled: atribuindo,
  });

  const vincular = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      axios.post(`/api/whatsapp/conversas/${conversa.id}/vincular`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-conversas"] });
      setVinculando(false);
      setBusca("");
      toast.success("Conversa vinculada");
    },
    onError: () => toast.error("Erro ao vincular"),
  });

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      axios.patch(`/api/whatsapp/conversas/${conversa.id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-conversas"] });
      setAtribuindo(false);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Erro ao atualizar conversa");
    },
  });

  return (
    <aside className="hidden xl:flex flex-col w-72 border-l border-border bg-background shrink-0 overflow-y-auto">
      <div className="p-4 text-center border-b border-border">
        <div className="w-14 h-14 rounded-full mx-auto mb-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center text-lg font-bold">
          {getInitials(conversa.contatoNome, conversa.contatoPhone)}
        </div>
        <p className="font-semibold text-sm">{conversa.contatoNome ?? formatPhone(conversa.contatoPhone)}</p>
        <p className="text-xs text-muted-foreground">{formatPhone(conversa.contatoPhone)}</p>
      </div>

      <div className="p-4 space-y-3 border-b border-border">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Conversa</p>

        <div className="flex rounded-lg border border-border p-0.5">
          {(["ABERTA", "PENDENTE", "RESOLVIDA"] as ConversaStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => status !== s && patch.mutate({ status: s })}
              disabled={patch.isPending}
              className={cn(
                "flex-1 text-[11px] font-semibold py-1 rounded-md transition-colors flex items-center justify-center gap-1",
                status === s ? cn("bg-muted", STATUS_COR[s]) : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <div className="text-xs">
          <span className="text-muted-foreground">Responsável: </span>
          <span className="font-medium">{conversa.responsavel?.nome ?? "ninguém"}</span>
        </div>
        {!atribuindo ? (
          <div className="flex gap-2">
            {conversa.responsavelId !== user?.id && (
              <Button size="sm" className="h-7 text-xs flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => patch.mutate({ responsavelId: user?.id })} disabled={patch.isPending}>
                Assumir
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => setAtribuindo(true)}>
              Atribuir a…
            </Button>
            {conversa.responsavelId && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => patch.mutate({ responsavelId: null })} disabled={patch.isPending}>
                Tirar
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-border p-2 space-y-1 max-h-48 overflow-y-auto">
            {usuarios.map((u) => (
              <button
                key={u.id}
                onClick={() => patch.mutate({ responsavelId: u.id })}
                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-xs"
              >
                {u.nome}
              </button>
            ))}
            <Button size="sm" variant="ghost" className="h-6 text-xs w-full text-muted-foreground" onClick={() => setAtribuindo(false)}>
              Cancelar
            </Button>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Registro no CRM</p>

        {cliente ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <UserRound className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{cliente.nome}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Cliente{cliente.cidade ? ` · ${cliente.cidade}${cliente.estado ? `/${cliente.estado}` : ""}` : ""}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => router.push(`/clientes/${cliente.id}`)}>
                <ExternalLink className="w-3 h-3 mr-1" /> Abrir ficha
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => vincular.mutate({ acao: "desvincular" })}
                disabled={vincular.isPending}
              >
                Desvincular
              </Button>
            </div>
          </div>
        ) : !vinculando ? (
          <div className="rounded-lg border border-dashed border-border p-3 text-center">
            <p className="text-xs text-muted-foreground mb-3">Este contato ainda não está no CRM.</p>
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                onClick={() => vincular.mutate({ acao: "criar" })}
                disabled={vincular.isPending}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Criar cliente
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setVinculando(true)}>
                Vincular a um existente
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border p-3 space-y-2">
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou telefone"
              className="w-full text-xs rounded-md border border-border bg-background px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-green-500/30"
            />
            <div className="max-h-52 overflow-y-auto -mx-1">
              {resultados.map((c) => (
                <button
                  key={c.id}
                  onClick={() => vincular.mutate({ clienteId: c.id })}
                  className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-xs"
                >
                  <span className="font-medium">{c.nome}</span>
                  {c.whatsapp && <span className="text-muted-foreground"> · {c.whatsapp}</span>}
                </button>
              ))}
              {busca.trim().length >= 2 && resultados.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum cliente encontrado</p>
              )}
            </div>
            <Button size="sm" variant="ghost" className="h-6 text-xs w-full text-muted-foreground" onClick={() => { setVinculando(false); setBusca(""); }}>
              Cancelar
            </Button>
          </div>
        )}
      </div>

      {conversa.agentEstado && BOT_ATIVO_ESTADOS.includes(conversa.agentEstado.estado) && (
        <div className="px-4 pb-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            🤖 O agente de IA está conduzindo a triagem desta conversa.
          </div>
        </div>
      )}
    </aside>
  );
}

// ── Painel de configurações ────────────────────────────────────────────────

const HEALTH_BADGE: Record<Sessao["healthStatus"], string> = {
  HEALTHY: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  STALE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  UNKNOWN: "",
};

interface LogSessao {
  id: string;
  evento: string;
  detalhe: string | null;
  createdAt: string;
}

function LinhaSessao({
  sessao,
  podeGerenciar,
  onDelete,
}: {
  sessao: Sessao;
  podeGerenciar: boolean;
  onDelete: (id: string) => void;
}) {
  const [logsAbertos, setLogsAbertos] = useState(false);
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["wa-logs", sessao.id],
    queryFn: async () => {
      const { data } = await axios.get(`/api/whatsapp/sessoes/${sessao.id}/logs`);
      return data as LogSessao[];
    },
    enabled: logsAbertos,
  });

  const desconectar = useMutation({
    mutationFn: () => axios.post(`/api/whatsapp/sessoes/${sessao.id}/desconectar`),
    onSuccess: () => {
      toast.success("Sessão desconectada");
      queryClient.invalidateQueries({ queryKey: ["wa-sessoes"] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Erro ao desconectar");
    },
  });

  const reiniciar = useMutation({
    mutationFn: () => axios.post(`/api/whatsapp/sessoes/${sessao.id}/reiniciar`),
    onSuccess: () => {
      toast.success("Reconexão iniciada");
      queryClient.invalidateQueries({ queryKey: ["wa-sessoes"] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Erro ao reiniciar");
    },
  });

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center text-sm font-bold shrink-0">
          {getInitials(sessao.nome)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{sessao.nome}</p>
          <p className="text-xs text-muted-foreground truncate">
            {sessao.numero ? formatPhone(sessao.numero) : "Aguardando conexão via QR Code"}
          </p>
          <p className="text-xs text-muted-foreground">
            {sessao.atendente ? `Atendente: ${sessao.atendente.nome}` : "Não atribuído"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge variant={sessao.status === "ONLINE" ? "default" : "secondary"} className={sessao.status === "ONLINE" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : ""}>
            {sessao.status}
          </Badge>
          {sessao.healthStatus !== "UNKNOWN" && (
            <Badge variant="secondary" className={cn("text-[10px]", HEALTH_BADGE[sessao.healthStatus])}>
              {sessao.healthStatus === "STALE" ? "sem sinal há tempo" : "saudável"}
            </Badge>
          )}
        </div>
        {podeGerenciar && (
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="w-8 h-8" title="Reiniciar" onClick={() => reiniciar.mutate()} disabled={reiniciar.isPending}>
              <RefreshCw className={cn("w-4 h-4", reiniciar.isPending && "animate-spin")} />
            </Button>
            <Button size="icon" variant="ghost" className="w-8 h-8" title="Desconectar" onClick={() => desconectar.mutate()} disabled={desconectar.isPending}>
              <PowerOff className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="w-8 h-8" title="Histórico" onClick={() => setLogsAbertos((v) => !v)}>
              <History className="w-4 h-4" />
              {logsAbertos ? <ChevronUp className="w-3 h-3 -ml-1" /> : <ChevronDown className="w-3 h-3 -ml-1" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 w-8 h-8"
              title="Remover sessão"
              onClick={() => onDelete(sessao.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {logsAbertos && (
        <div className="border-t border-border bg-muted/30 px-4 py-3 text-xs space-y-1.5 max-h-48 overflow-auto">
          {loadingLogs ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground">Nenhum evento registrado ainda.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-2 text-muted-foreground">
                <span className="font-medium text-foreground">{log.evento}</span>
                <span>{format(new Date(log.createdAt), "dd/MM HH:mm")}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function PainelConfig({
  sessoes,
  onDelete,
  onAdd,
  podeAdicionar,
  podeVerTodas,
  meuUserId,
  escopo,
  onEscopoChange,
}: {
  sessoes: Sessao[];
  onDelete: (id: string) => void;
  onAdd: () => void;
  podeAdicionar: boolean;
  podeVerTodas: boolean;
  meuUserId: string | undefined;
  escopo: "todas" | "minhas";
  onEscopoChange: (v: "todas" | "minhas") => void;
}) {
  return (
    <div className="flex-1 flex flex-col p-6 gap-6 overflow-auto">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Sessões WhatsApp
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie as sessões WhatsApp conectadas ao CRM via gateway próprio (sem migrar número pra Meta).
        </p>
      </div>

      {podeVerTodas && (
        <div className="inline-flex rounded-lg border border-border p-0.5 text-sm w-fit">
          {(["todas", "minhas"] as const).map((op) => (
            <button
              key={op}
              onClick={() => onEscopoChange(op)}
              className={cn(
                "px-3 py-1 rounded-md transition-colors capitalize",
                escopo === op ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {op === "todas" ? "Todas" : "Minhas"}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3 max-w-xl">
        {sessoes.map((s) => (
          <LinhaSessao
            key={s.id}
            sessao={s}
            podeGerenciar={podeVerTodas || s.atendenteId === meuUserId}
            onDelete={onDelete}
          />
        ))}

        {podeAdicionar && (
          <Button variant="outline" className="w-full" onClick={onAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Nova sessão
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Quadro (kanban de atendimento) ───────────────────────────────────────

function KanbanCard({ c, onAbrir }: { c: Conversa; onAbrir: (c: Conversa) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: c.id,
    data: { etapa: (c.etapa ?? "NOVA") as EtapaQuadro },
  });
  const lastMsg = c.mensagens?.[0];
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "rounded-lg border border-border bg-card p-2.5 text-left cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onAbrir(c)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold leading-tight line-clamp-2">
          {c.cliente?.nome ?? c.contatoNome ?? formatPhone(c.contatoPhone)}
        </p>
        {c.naoLidas > 0 && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0 mt-1" />}
      </div>
      {lastMsg?.conteudo && (
        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{lastMsg.conteudo}</p>
      )}
      <div className="flex items-center gap-2 mt-2">
        {c.responsavel ? (
          <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[8px] font-bold flex items-center justify-center">
            {getInitials(c.responsavel.nome)}
          </span>
        ) : (
          <span className="w-4 h-4 rounded-full border border-dashed border-muted-foreground/50" />
        )}
        {c.status && c.status !== "ABERTA" && (
          <span className={cn("text-[9px] font-semibold", STATUS_COR[c.status])}>{STATUS_LABEL[c.status]}</span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">{c.ultimaMsgEm ? formatTime(c.ultimaMsgEm) : ""}</span>
      </div>
    </div>
  );
}

function KanbanColuna({
  etapa, label, cor, conversas, onAbrir,
}: {
  etapa: EtapaQuadro; label: string; cor: string; conversas: Conversa[]; onAbrir: (c: Conversa) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa, data: { etapa } });
  return (
    <div className="w-64 shrink-0 flex flex-col rounded-xl border border-border bg-muted/30 max-h-full">
      <div className="px-3 py-2.5 border-b border-border/60 flex items-center gap-2">
        <span className={cn("w-2 h-2 rounded-full", cor)} />
        <span className="text-xs font-bold">{label}</span>
        <span className="ml-auto text-[11px] font-semibold text-muted-foreground bg-background rounded-full px-1.5">
          {conversas.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn("flex-1 overflow-y-auto p-2 flex flex-col gap-2 min-h-[60px]", isOver && "bg-green-500/5")}
      >
        <SortableContext items={conversas.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {conversas.map((c) => (
            <KanbanCard key={c.id} c={c} onAbrir={onAbrir} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function QuadroKanban({
  sessaoId, onAbrir,
}: {
  sessaoId: string | null; onAbrir: (c: Conversa) => void;
}) {
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: conversas = [] } = useQuery({
    queryKey: ["wa-quadro", sessaoId],
    queryFn: async () => {
      const qs = sessaoId ? `?sessaoId=${sessaoId}` : "";
      const { data } = await axios.get(`/api/whatsapp/conversas${qs}`);
      return data as Conversa[];
    },
    enabled: !!sessaoId,
    refetchInterval: 8000,
  });

  const { data: metricas } = useQuery({
    queryKey: ["wa-metricas"],
    queryFn: async () => {
      const { data } = await axios.get("/api/whatsapp/metricas");
      return data as {
        emAberto: number; naoAtribuidas: number; resolvidasHoje: number;
        primeiraRespostaMs: number | null; conversao7d: number | null;
      };
    },
    refetchInterval: 30000,
  });

  const mover = useMutation({
    mutationFn: ({ id, etapa }: { id: string; etapa: EtapaQuadro }) =>
      axios.patch(`/api/whatsapp/conversas/${id}`, { etapa }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-quadro"] });
      queryClient.invalidateQueries({ queryKey: ["wa-conversas"] });
    },
    onError: () => toast.error("Erro ao mover a conversa"),
  });

  const porEtapa = (e: EtapaQuadro) => conversas.filter((c) => (c.etapa ?? "NOVA") === e);
  const naoAtribuidas = conversas.filter((c) => !c.responsavelId).length;

  function onDragEnd(evt: DragEndEvent) {
    const { active, over } = evt;
    if (!over) return;
    const de = (active.data.current as { etapa?: EtapaQuadro })?.etapa;
    const para = ((over.data.current as { etapa?: EtapaQuadro })?.etapa ?? over.id) as EtapaQuadro;
    if (de !== para && ETAPAS_QUADRO.some((x) => x.id === para)) {
      mover.mutate({ id: active.id as string, etapa: para });
    }
  }

  const kpis: { lbl: string; v: string }[] = metricas
    ? [
        { lbl: "Em aberto", v: String(metricas.emAberto) },
        { lbl: "Sem responsável", v: String(metricas.naoAtribuidas) },
        { lbl: "Resolvidas hoje", v: String(metricas.resolvidasHoje) },
        { lbl: "1ª resposta (méd)", v: metricas.primeiraRespostaMs != null ? formatDuracao(metricas.primeiraRespostaMs) : "—" },
        { lbl: "Conversão 7d", v: metricas.conversao7d != null ? `${metricas.conversao7d}%` : "—" },
      ]
    : [];

  return (
    <div className="flex-1 flex flex-col min-w-0 p-4 gap-3 overflow-hidden">
      <div className="flex items-baseline gap-3">
        <h2 className="text-base font-bold">Quadro de atendimento</h2>
        <span className="text-xs text-muted-foreground">
          {conversas.length} conversas · {naoAtribuidas} sem responsável
        </span>
      </div>
      {kpis.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {kpis.map((k) => (
            <div key={k.lbl} className="rounded-lg border border-border bg-card px-3 py-1.5 min-w-[104px]">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.lbl}</div>
              <div className="text-base font-bold tabular-nums">{k.v}</div>
            </div>
          ))}
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="flex-1 flex gap-3 overflow-x-auto pb-2">
          {ETAPAS_QUADRO.map((col) => (
            <KanbanColuna
              key={col.id}
              etapa={col.id}
              label={col.label}
              cor={col.cor}
              conversas={porEtapa(col.id)}
              onAbrir={onAbrir}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

function WhatsAppContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const phoneParam = useMemo(() => searchParams.get("phone"), [searchParams]);
  // Admin e Dev gerenciam qualquer sessão e têm o toggle "Minhas / Todas".
  // Os demais cargos (Gestor, Comercial, Operacional) só veem/gerenciam a
  // própria — 1 por pessoa. Ver src/lib/rbac.ts e docs/architecture/whatsapp.md.
  const podeVerTodas = user?.role === "DESENVOLVEDOR" || user?.role === "ADMINISTRADOR";

  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [conversa, setConversa] = useState<Conversa | null>(null);
  const [searchConversa, setSearchConversa] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [aba, setAba] = useState<"conversas" | "quadro" | "canais">("conversas");
  const [escopo, setEscopo] = useState<"todas" | "minhas">("todas");
  const [filtro, setFiltro] = useState<FiltroFila>("todas");
  const queryClient = useQueryClient();

  const { data: sessoes = [] } = useQuery({
    queryKey: ["wa-sessoes", escopo],
    queryFn: async () => {
      const { data } = await axios.get(`/api/whatsapp/sessoes?escopo=${escopo}`);
      return data as Sessao[];
    },
    enabled: !!user,
  });

  const podeAdicionar = podeVerTodas || sessoes.length === 0;

  const { data: conversas = [] } = useQuery({
    queryKey: ["wa-conversas", sessaoId, filtro],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (sessaoId) qs.set("sessaoId", sessaoId);
      if (filtro !== "todas") qs.set("filtro", filtro);
      const { data } = await axios.get(`/api/whatsapp/conversas?${qs.toString()}`);
      return data as Conversa[];
    },
    enabled: !!sessaoId,
    refetchInterval: 5000,
  });

  // Busca todas conversas quando vem via ?phone= para encontrar em qualquer sessão
  const { data: todasConversas = [] } = useQuery({
    queryKey: ["wa-conversas-todas"],
    queryFn: async () => {
      const { data } = await axios.get("/api/whatsapp/conversas");
      return data as Conversa[];
    },
    enabled: !!phoneParam,
  });

  useEffect(() => {
    if (sessoes.length > 0 && !sessaoId) {
      setSessaoId(sessoes[0].id);
    }
  }, [sessoes, sessaoId]);

  // Auto-abre conversa quando vem de /clientes via ?phone=
  useEffect(() => {
    if (!phoneParam || todasConversas.length === 0) return;
    const tail = phoneParam.slice(-9);
    const match = todasConversas.find((c) =>
      c.contatoPhone.replace(/\D/g, "").endsWith(tail)
    );
    if (match) {
      setSessaoId(match.sessaoId);
      setConversa(match);
      setAba("conversas");
    }
  }, [phoneParam, todasConversas]);

  const deletarSessao = useCallback(async (id: string) => {
    if (!confirm("Deseja remover esta sessão? O histórico de conversas é mantido.")) return;
    try {
      await axios.delete(`/api/whatsapp/sessoes/${id}`);
      queryClient.invalidateQueries({ queryKey: ["wa-sessoes"] });
      if (sessaoId === id) setSessaoId(null);
      toast.success("Sessão removida");
    } catch {
      toast.error("Erro ao remover sessão");
    }
  }, [sessaoId, queryClient]);

  const sessaoAtual = sessoes.find((s) => s.id === sessaoId);
  const painelChat = conversa !== null;

  if (WHATSAPP_STANDBY) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <MessageCircle className="w-16 h-16 text-muted-foreground opacity-30" />
        <div>
          <h2 className="text-xl font-semibold">Sistema em standby</h2>
          <p className="text-muted-foreground mt-1 text-sm max-w-sm">
            O módulo WhatsApp está temporariamente pausado para todos os cargos, inclusive Desenvolvedor.
          </p>
        </div>
      </div>
    );
  }

  const abaBtn = (id: "conversas" | "quadro" | "canais", label: string, extra?: React.ReactNode) => (
    <button
      onClick={() => { setAba(id); if (id !== "conversas") setConversa(null); }}
      className={cn(
        "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
        aba === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      {extra}
    </button>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm -m-4 md:-m-6">
      {/* Navegação do módulo — Conversas | Canais (gestão de números) */}
      <div className="flex items-center gap-1 px-2.5 h-11 border-b border-border bg-muted/40 shrink-0">
        {abaBtn("conversas", "Conversas")}
        {sessoes.length > 0 && abaBtn("quadro", "Quadro")}
        {abaBtn(
          "canais",
          "Canais",
          sessoes.length > 0 ? (
            <span className="text-[11px] font-semibold rounded-full bg-muted px-1.5 leading-tight">{sessoes.length}</span>
          ) : undefined
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Rail de sessões */}
        <PainelSessoes
          sessoes={sessoes}
          selected={sessaoId}
          onSelect={(id) => { setSessaoId(id); setConversa(null); setAba("conversas"); }}
          onAdd={() => setModalAberto(true)}
          podeAdicionar={podeAdicionar}
        />

        {aba === "canais" ? (
          <PainelConfig
            sessoes={sessoes}
            onDelete={deletarSessao}
            onAdd={() => setModalAberto(true)}
            podeAdicionar={podeAdicionar}
            podeVerTodas={podeVerTodas}
            meuUserId={user?.id}
            escopo={escopo}
            onEscopoChange={setEscopo}
          />
        ) : aba === "quadro" && sessoes.length > 0 ? (
          <QuadroKanban
            sessaoId={sessaoId}
            onAbrir={(c) => { setSessaoId(c.sessaoId); setConversa(c); setAba("conversas"); }}
          />
        ) : sessoes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="w-20 h-20 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <MessageCircle className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Conecte um WhatsApp</h2>
              <p className="text-muted-foreground mt-2 max-w-sm">
                Crie uma sessão pra conectar um WhatsApp ao CRM via QR Code — sem migrar o número pra Meta.
              </p>
            </div>
            {podeAdicionar && (
              <Button onClick={() => setModalAberto(true)} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                <Plus className="w-4 h-4" />
                Criar primeira sessão
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Lista de conversas — esconde no mobile quando chat está aberto */}
            <div className={cn("flex flex-col border-r border-border", painelChat ? "hidden md:flex md:w-80" : "flex flex-1 md:flex-none md:w-80")}>
              <ListaConversas
                conversas={conversas}
                sessao={sessaoAtual}
                selectedId={conversa?.id ?? null}
                onSelect={(c) => setConversa(c)}
                search={searchConversa}
                onSearchChange={setSearchConversa}
                filtro={filtro}
                onFiltroChange={setFiltro}
              />
            </div>

            {/* Área do chat — esconde no mobile quando não há conversa */}
            <div className={cn("flex-1 flex flex-col min-w-0", !painelChat && "hidden md:flex")}>
              <AreaChat
                conversa={conversa}
                onBack={() => setConversa(null)}
              />
            </div>
          </>
        )}
      </div>

      <ModalNovaSessao
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["wa-sessoes"] })}
      />
    </div>
  );
}

export default function WhatsAppPage() {
  return (
    <Suspense fallback={null}>
      <WhatsAppContent />
    </Suspense>
  );
}
