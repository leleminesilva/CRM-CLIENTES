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
  Loader2, ChevronLeft, Check, CheckCheck,
  Search, Smartphone, RefreshCw, PowerOff, History,
  Paperclip, FileText, X as XIcon, Download, UserRound, ExternalLink, Sparkles,
  Zap, Clock, ArrowRight, Activity, Inbox, CreditCard, StickyNote,
  Users, PanelRightClose, PanelRight, Pencil, Settings, ChevronUp, ChevronDown,
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
  remetenteNome?: string | null;
  remetentePhone?: string | null;
}

interface ClienteVinculado {
  id: string;
  nome: string;
  cidade?: string | null;
  estado?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  createdAt?: string | null;
  servicoBuscado?: string | null;
  numeroOrcamento?: string | null;
  valorOrcamento?: string | number | null;
  prazoOrcamento?: string | null;
  statusOrcamento?: "PENDENTE" | "APROVADO" | "NAO_APROVADO" | null;
  orcamentoEnviadoEm?: string | null;
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
  createdAt?: string;
  mensagens?: Mensagem[];
  agentEstado?: { estado: string } | null;
  cliente?: ClienteVinculado | null;
  status?: ConversaStatus;
  etapa?: EtapaQuadro;
  isGrupo?: boolean;
  fotoUrl?: string | null;
  responsavelId?: string | null;
  responsavel?: { id: string; nome: string } | null;
  notaInterna?: string | null;
  tags?: string[];
}

const CORES_ETIQUETA = [
  "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "bg-green-500/15 text-green-600 dark:text-green-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
];
function corEtiqueta(nome: string) {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) | 0;
  return CORES_ETIQUETA[Math.abs(h) % CORES_ETIQUETA.length];
}
const ETIQUETAS_SUGERIDAS = ["Orçamento", "Box", "Espelho", "Porta", "Obra", "Instalação", "Retorno", "Urgente"];

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

// Etapa = id de uma coluna configurável do quadro (WhatsAppEtapa).
type EtapaQuadro = string;

interface EtapaCol {
  id: string;
  nome: string;
  cor: string; // hex
  ordem: number;
  sistema: boolean;
}

function formatDuracao(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

function formatBRL(v: string | number | null | undefined): string | null {
  if (v == null || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!isFinite(n)) return null;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const ORC_STATUS: Record<string, { label: string; cor: string }> = {
  PENDENTE: { label: "Aguardando decisão", cor: "text-amber-600 dark:text-amber-400" },
  APROVADO: { label: "Aprovado", cor: "text-green-600 dark:text-green-400" },
  NAO_APROVADO: { label: "Não aprovado", cor: "text-rose-600 dark:text-rose-400" },
};

const RESPOSTAS_RAPIDAS = [
  "Bom dia! Como posso ajudar?",
  "Pode me passar as medidas (largura × altura)?",
  "Qual o tipo de vidro? (temperado, comum, laminado…)",
  "Você é de qual cidade?",
  "Vou confirmar o valor com a equipe e já te retorno 👍",
  "Consegue me mandar uma foto do local?",
];

// Fallback enquanto /api/whatsapp/etapas não carregou (mesmos ids semeados na migration).
const ETAPAS_FALLBACK: EtapaCol[] = [
  { id: "NOVA",               nome: "Novas",              cor: "#94a3b8", ordem: 0, sistema: true },
  { id: "EM_ATENDIMENTO",     nome: "Em atendimento",     cor: "#3b82f6", ordem: 1, sistema: true },
  { id: "AGUARDANDO_CLIENTE", nome: "Aguardando cliente", cor: "#f59e0b", ordem: 2, sistema: true },
  { id: "ORCAMENTO_ENVIADO",  nome: "Orçamento enviado",  cor: "#22c55e", ordem: 3, sistema: true },
  { id: "FECHADO",            nome: "Fechado",            cor: "#059669", ordem: 4, sistema: true },
  { id: "SEM_RETORNO",        nome: "Sem retorno",        cor: "#ef4444", ordem: 5, sistema: true },
];

function useEtapas() {
  return useQuery({
    queryKey: ["wa-etapas"],
    queryFn: async () => {
      const { data } = await axios.get("/api/whatsapp/etapas");
      return data as { etapas: EtapaCol[]; podeEditar: boolean };
    },
    staleTime: 60000,
  });
}

type AgrupamentoQuadro = "etapa" | "responsavel" | "canal" | "etiqueta";
const AGRUPAMENTOS: { id: AgrupamentoQuadro; label: string }[] = [
  { id: "etapa",       label: "Etapa do atendimento" },
  { id: "responsavel", label: "Responsável" },
  { id: "canal",       label: "Canal" },
  { id: "etiqueta",    label: "Etiqueta" },
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

// Avatar do contato: foto de perfil do WhatsApp quando existe, senão iniciais
// (ou ícone de grupo). Cai pras iniciais se a URL da foto falhar/expirar.
function AvatarWA({
  fotoUrl, nome, phone, grupo, className, iconClass,
}: {
  fotoUrl?: string | null;
  nome?: string;
  phone?: string;
  grupo?: boolean;
  className: string;
  iconClass?: string;
}) {
  const [erro, setErro] = useState(false);
  const base = cn(
    "rounded-full shrink-0 flex items-center justify-center font-bold overflow-hidden bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    className,
  );
  if (fotoUrl && !erro) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={fotoUrl} alt={nome ?? "Contato"} onError={() => setErro(true)} className={cn(base, "object-cover")} />;
  }
  return (
    <div className={base}>
      {grupo ? <Users className={iconClass ?? "w-4 h-4"} /> : getInitials(nome, phone)}
    </div>
  );
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
    <div className="w-full md:w-80 flex flex-col border-r border-border shrink-0 h-full min-h-0 overflow-hidden">
      <div className="h-14 shrink-0 flex items-center px-4 border-b border-border gap-2 bg-[#f0f2f5] dark:bg-[#202c33]">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{sessao?.nome ?? "Selecione uma sessão"}</p>
          {sessao?.numero && (
            <p className="text-xs text-muted-foreground">{formatPhone(sessao.numero)}</p>
          )}
        </div>
      </div>

      <div className="p-2 shrink-0 border-b border-border bg-[#f0f2f5] dark:bg-[#202c33] space-y-2">
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

      <ScrollArea className="flex-1 min-h-0">
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
                  <AvatarWA
                    fotoUrl={c.fotoUrl}
                    nome={c.contatoNome}
                    phone={c.contatoPhone}
                    grupo={c.isGrupo}
                    className="w-10 h-10 text-sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={cn("text-sm truncate flex items-center gap-1", c.naoLidas > 0 && "font-semibold")}>
                        {c.isGrupo && <Users className="w-3 h-3 shrink-0 text-muted-foreground" />}
                        {c.contatoNome ?? (c.isGrupo ? "Grupo do WhatsApp" : formatPhone(c.contatoPhone))}
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
                            : c.isGrupo && lastMsg.remetenteNome
                              ? `${lastMsg.remetenteNome.split(" ")[0]}: ${lastMsg.conteudo}`
                              : lastMsg.conteudo
                          : c.isGrupo ? "Grupo" : formatPhone(c.contatoPhone)}
                      </span>
                      {c.naoLidas > 0 && (
                        <Badge className="bg-green-600 text-white h-5 min-w-[20px] shrink-0 text-xs px-1.5">
                          {c.naoLidas}
                        </Badge>
                      )}
                    </div>
                    {c.tags && c.tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {c.tags.slice(0, 3).map((t) => (
                          <span key={t} className={cn("text-[10px] font-medium rounded px-1.5 py-0.5", corEtiqueta(t))}>{t}</span>
                        ))}
                      </div>
                    )}
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

const LABEL_MIDIA: Record<string, string> = {
  imagem: "Foto",
  video: "Vídeo",
  audio: "Áudio",
  documento: "Documento",
};

function BolhaMedia({ msg }: { msg: Mensagem }) {
  if (!msg.mediaUrl) {
    if (LABEL_MIDIA[msg.tipo]) {
      return (
        <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 rounded-lg px-3 py-2 mb-1.5 text-sm text-muted-foreground">
          <Paperclip className="w-4 h-4 shrink-0" />
          <span>{LABEL_MIDIA[msg.tipo]} (não recuperado)</span>
        </div>
      );
    }
    return null;
  }
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
  sessaoNome,
}: {
  conversa: Conversa | null;
  onBack: () => void;
  sessaoNome?: string;
}) {
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [ctxAberto, setCtxAberto] = useState(true);
  const [leiturasFoto, setLeiturasFoto] = useState<Record<string, { loading?: boolean; texto?: string; erro?: boolean }>>({});
  const [transcricoes, setTranscricoes] = useState<Record<string, { loading?: boolean; texto?: string; erro?: boolean }>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  async function lerFoto(msgId: string) {
    setLeiturasFoto((s) => ({ ...s, [msgId]: { loading: true } }));
    try {
      const { data } = await axios.post(`/api/whatsapp/conversas/${conversa!.id}/mensagens/${msgId}/ler-foto`);
      setLeiturasFoto((s) => ({ ...s, [msgId]: { texto: (data as { leitura: string }).leitura } }));
    } catch {
      setLeiturasFoto((s) => ({ ...s, [msgId]: { erro: true } }));
      toast.error("Não foi possível ler a imagem");
    }
  }

  async function transcrever(msgId: string) {
    setTranscricoes((s) => ({ ...s, [msgId]: { loading: true } }));
    try {
      const { data } = await axios.post(`/api/whatsapp/conversas/${conversa!.id}/mensagens/${msgId}/transcrever`);
      setTranscricoes((s) => ({ ...s, [msgId]: { texto: (data as { transcricao: string }).transcricao } }));
    } catch (e: unknown) {
      setTranscricoes((s) => ({ ...s, [msgId]: { erro: true } }));
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Não foi possível transcrever o áudio");
    }
  }

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
  const grupo = !!conversa.isGrupo;
  const tituloContato = conversa.contatoNome ?? (grupo ? "Grupo do WhatsApp" : formatPhone(conversa.contatoPhone));

  // Última mensagem recebida — só pra situar o atendente. (A "janela de 24 h"
  // da API oficial da Meta não se aplica aqui: o gateway é WhatsApp Web.)
  const ultimaEntrada = [...mensagens].reverse().find((m) => m.direcao === "entrada");

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
    <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden">
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center gap-2 px-4 border-b border-border bg-[#f0f2f5] dark:bg-[#202c33] shrink-0">
        <button onClick={onBack} className="md:hidden p-1 -ml-1 rounded hover:bg-accent">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => setCtxAberto((v) => !v)}
          title={ctxAberto ? "Ocultar detalhes" : "Mostrar detalhes"}
          className="flex-1 min-w-0 flex items-center gap-3 -mx-1 px-1 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-left"
        >
          <AvatarWA
            fotoUrl={conversa.fotoUrl}
            nome={conversa.contatoNome}
            phone={conversa.contatoPhone}
            grupo={grupo}
            className="w-9 h-9 text-sm"
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{tituloContato}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {grupo ? <Users className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
              {grupo ? "Grupo do WhatsApp" : formatPhone(conversa.contatoPhone)}
            </p>
          </div>
        </button>
        <button
          onClick={() => setCtxAberto((v) => !v)}
          title={ctxAberto ? "Ocultar detalhes" : "Mostrar detalhes"}
          className="hidden xl:flex shrink-0 w-8 h-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
        >
          {ctxAberto ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Mensagens */}
      <ScrollArea
        className="flex-1 min-h-0 px-4 py-4 bg-[#efeae2] dark:bg-[#0b141a] [--wa-dot:rgba(0,0,0,0.06)] dark:[--wa-dot:rgba(255,255,255,0.04)]"
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
                        {grupo && msg.direcao === "entrada" && (msg.remetenteNome || msg.remetentePhone) && (
                          <p className={cn("text-[11px] font-bold mb-0.5", corEtiqueta(msg.remetenteNome || msg.remetentePhone || "").split(" ").find((c) => c.startsWith("text-")))}>
                            {msg.remetenteNome || formatPhone(msg.remetentePhone || "")}
                          </p>
                        )}
                        <BolhaMedia msg={msg} />
                        {(msg.tipo === "texto" || msg.conteudo) && msg.tipo !== "documento" && (
                          <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
                        )}
                        {msg.direcao === "entrada" && msg.tipo === "audio" && msg.mediaUrl && (
                          <div className="mt-1.5">
                            {transcricoes[msg.id]?.texto ? (
                              <div className="border-l-2 border-blue-500/50 pl-2 text-[11px] text-muted-foreground">
                                {transcricoes[msg.id]!.texto}
                                <span className="block text-[10px] opacity-70 mt-0.5">Transcrito pela IA · pt-BR</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => transcrever(msg.id)}
                                disabled={transcricoes[msg.id]?.loading}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                              >
                                {transcricoes[msg.id]?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                {transcricoes[msg.id]?.erro ? "Tentar de novo" : "Transcrever"}
                              </button>
                            )}
                          </div>
                        )}
                        {msg.direcao === "entrada" && msg.tipo === "imagem" && msg.mediaUrl && (
                          <div className="mt-1.5">
                            {leiturasFoto[msg.id]?.texto ? (
                              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-2 text-[11px] text-blue-900 dark:text-blue-200 flex gap-1.5">
                                <Sparkles className="w-3 h-3 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                                <span>A IA leu a foto: {leiturasFoto[msg.id]!.texto}</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => lerFoto(msg.id)}
                                disabled={leiturasFoto[msg.id]?.loading}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                              >
                                {leiturasFoto[msg.id]?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                {leiturasFoto[msg.id]?.erro ? "Tentar de novo" : "Ler pela IA"}
                              </button>
                            )}
                          </div>
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
        {sessaoNome && (
          <p className="flex items-center gap-1.5 mt-2 px-0.5 text-[11px] text-muted-foreground">
            <Clock className="w-3 h-3 shrink-0" />
            Respondendo pelo canal <b className="text-foreground font-semibold">{sessaoNome}</b>
            {ultimaEntrada && (
              <span>· cliente escreveu por último {formatTime(ultimaEntrada.enviadaEm)}</span>
            )}
          </p>
        )}
      </div>
    </div>
    {ctxAberto && (
      <PainelContexto conversa={conversa} sessaoNome={sessaoNome} onClose={() => setCtxAberto(false)} />
    )}
    </div>
  );
}

// ── Painel de contexto (ficha do cliente na conversa) ─────────────────────

function PainelContexto({ conversa, sessaoNome, onClose }: { conversa: Conversa; sessaoNome?: string; onClose?: () => void }) {
  const grupo = !!conversa.isGrupo;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [busca, setBusca] = useState("");
  const [vinculando, setVinculando] = useState(false);
  const [atribuindo, setAtribuindo] = useState(false);
  const [novaTag, setNovaTag] = useState("");
  const cliente = conversa.cliente ?? null;
  const status: ConversaStatus = conversa.status ?? "ABERTA";
  const tags = conversa.tags ?? [];
  const addTag = (t: string) => {
    const v = t.trim();
    if (v && !tags.includes(v)) patch.mutate({ tags: [...tags, v] });
    setNovaTag("");
  };
  const removeTag = (t: string) => patch.mutate({ tags: tags.filter((x) => x !== t) });

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

  const [resumo, setResumo] = useState<{ itens: { rotulo: string; texto: string }[]; baseadoEm: string } | null>(null);
  useEffect(() => setResumo(null), [conversa.id]);

  const [nota, setNota] = useState(conversa.notaInterna ?? "");
  useEffect(() => setNota(conversa.notaInterna ?? ""), [conversa.id, conversa.notaInterna]);

  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeEdit, setNomeEdit] = useState(conversa.contatoNome ?? "");
  const [nomeSalvo, setNomeSalvo] = useState<string | null>(null);
  useEffect(() => { setEditandoNome(false); setNomeEdit(conversa.contatoNome ?? ""); setNomeSalvo(null); }, [conversa.id, conversa.contatoNome]);
  const nomeAtual = nomeSalvo ?? conversa.contatoNome ?? null;
  const salvarNome = () => {
    setEditandoNome(false);
    const v = nomeEdit.trim();
    if (v === (nomeAtual ?? "")) return;
    setNomeSalvo(v || "");
    patch.mutate({ contatoNome: v || null });
  };
  const salvarNota = () => {
    const v = nota.trim();
    if (v === (conversa.notaInterna ?? "").trim()) return;
    patch.mutate({ notaInterna: v });
  };
  const gerarResumo = useMutation({
    mutationFn: async () => {
      const { data } = await axios.post(`/api/whatsapp/conversas/${conversa.id}/resumo`);
      return data as { itens: { rotulo: string; texto: string }[]; baseadoEm: string };
    },
    onSuccess: (d) => setResumo(d),
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Não foi possível gerar o resumo");
    },
  });

  return (
    <aside className="hidden xl:flex flex-col w-72 border-l border-border bg-background shrink-0 min-h-0 overflow-y-auto relative">
      {onClose && (
        <button
          onClick={onClose}
          title="Ocultar detalhes"
          className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <PanelRightClose className="w-4 h-4" />
        </button>
      )}
      <div className="p-4 text-center border-b border-border">
        <AvatarWA
          fotoUrl={conversa.fotoUrl}
          nome={conversa.contatoNome}
          phone={conversa.contatoPhone}
          grupo={grupo}
          className="w-14 h-14 text-lg mx-auto mb-2"
          iconClass="w-6 h-6"
        />
        {editandoNome ? (
          <input
            autoFocus
            value={nomeEdit}
            onChange={(e) => setNomeEdit(e.target.value)}
            onBlur={salvarNome}
            onKeyDown={(e) => { if (e.key === "Enter") salvarNome(); if (e.key === "Escape") setEditandoNome(false); }}
            placeholder={grupo ? "Nome do grupo" : "Nome do contato"}
            className="w-full text-center text-sm font-semibold rounded-md border border-border bg-background px-2 py-1 outline-none focus:ring-2 focus:ring-green-500/30"
          />
        ) : (
          <button
            onClick={() => { setNomeEdit(nomeAtual ?? ""); setEditandoNome(true); }}
            title="Renomear"
            className="group inline-flex items-center gap-1 font-semibold text-sm hover:text-green-600"
          >
            {nomeAtual ?? (grupo ? "Grupo do WhatsApp" : formatPhone(conversa.contatoPhone))}
            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60" />
          </button>
        )}
        <p className="text-xs text-muted-foreground">{grupo ? "Grupo" : formatPhone(conversa.contatoPhone)}</p>
        <div className="flex gap-2 justify-center mt-3">
          {cliente && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => router.push(`/clientes/${cliente.id}`)}>
              <ExternalLink className="w-3 h-3 mr-1" /> Abrir ficha
            </Button>
          )}
          {!grupo && (
            <a
              href={`https://wa.me/${conversa.contatoPhone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-7 px-2.5 inline-flex items-center gap-1 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground"
            >
              <Phone className="w-3 h-3" /> WhatsApp
            </a>
          )}
        </div>
      </div>

      {/* Resumo da IA — gerado sob demanda, não persiste */}
      <div className="p-4 border-b border-border bg-blue-500/[0.04]">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex-1">
            Resumo da IA
          </p>
          {resumo && (
            <button
              onClick={() => gerarResumo.mutate()}
              disabled={gerarResumo.isPending}
              className="text-[10px] font-semibold text-muted-foreground hover:text-blue-600 flex items-center gap-1 disabled:opacity-50"
            >
              {gerarResumo.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Atualizar
            </button>
          )}
        </div>

        {!resumo && !gerarResumo.isPending && (
          <button
            onClick={() => gerarResumo.mutate()}
            className="w-full text-xs font-semibold rounded-md border border-blue-500/40 text-blue-600 dark:text-blue-400 py-1.5 hover:bg-blue-500/10"
          >
            Gerar resumo
          </button>
        )}
        {gerarResumo.isPending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Lendo a conversa…
          </div>
        )}
        {resumo && (
          <>
            <ul className="space-y-1.5">
              {resumo.itens.map((it, i) => (
                <li key={i} className="grid grid-cols-[64px_1fr] gap-2 text-xs">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground pt-0.5">{it.rotulo}</span>
                  <span className="text-foreground">{it.texto}</span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-muted-foreground mt-2">Gerado a partir de {resumo.baseadoEm}</p>
          </>
        )}
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

        <dl className="grid grid-cols-[70px_1fr] gap-y-1.5 gap-x-2 text-[11px] pt-1">
          {sessaoNome && (
            <>
              <dt className="text-muted-foreground">Canal</dt>
              <dd className="font-medium">{sessaoNome}</dd>
            </>
          )}
          <dt className="text-muted-foreground">1º contato</dt>
          <dd className="font-medium tabular-nums">
            {conversa.createdAt ? format(new Date(conversa.createdAt), "dd/MM/yy HH:mm") : "—"}
          </dd>
        </dl>
      </div>

      <div className="p-4 space-y-2 border-b border-border">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Etiquetas</p>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className={cn("text-[11px] font-medium rounded px-1.5 py-0.5 flex items-center gap-1", corEtiqueta(t))}>
              {t}
              <button onClick={() => removeTag(t)} className="opacity-60 hover:opacity-100">
                <XIcon className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          {tags.length === 0 && <span className="text-[11px] text-muted-foreground">nenhuma</span>}
        </div>
        <div className="flex flex-wrap gap-1">
          {ETIQUETAS_SUGERIDAS.filter((s) => !tags.includes(s)).slice(0, 6).map((s) => (
            <button
              key={s}
              onClick={() => addTag(s)}
              className="text-[11px] text-muted-foreground border border-dashed border-border rounded px-1.5 py-0.5 hover:text-foreground hover:border-foreground/40"
            >
              + {s}
            </button>
          ))}
        </div>
        <input
          value={novaTag}
          onChange={(e) => setNovaTag(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addTag(novaTag); }}
          placeholder="Nova etiqueta + Enter"
          className="w-full text-xs rounded-md border border-border bg-background px-2 py-1 outline-none focus:ring-2 focus:ring-green-500/30"
        />
      </div>

      {!grupo && (
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
      )}

      {/* Negócio vinculado — vem do orçamento do cliente no CRM */}
      {cliente && (cliente.servicoBuscado || formatBRL(cliente.valorOrcamento)) && (
        <div className="p-4 space-y-2 border-b border-border">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Negócio vinculado</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="p-3 bg-muted/40">
              <p className="text-xs font-medium">{cliente.servicoBuscado ?? "Orçamento em andamento"}</p>
              {formatBRL(cliente.valorOrcamento) && (
                <p className="text-sm font-bold mt-0.5 tabular-nums">{formatBRL(cliente.valorOrcamento)}</p>
              )}
            </div>
            {cliente.statusOrcamento && (
              <div className="px-3 py-2 text-[11px] flex items-center gap-1.5">
                <span className="text-muted-foreground">Situação:</span>
                <span className={cn("font-semibold", ORC_STATUS[cliente.statusOrcamento]?.cor)}>
                  {ORC_STATUS[cliente.statusOrcamento]?.label ?? cliente.statusOrcamento}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Orçamento — resumo do que está no CRM + ações */}
      {cliente && formatBRL(cliente.valorOrcamento) && (
        <div className="p-4 space-y-2 border-b border-border">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Orçamento</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="p-3 space-y-1">
              {cliente.numeroOrcamento && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Nº</span>
                  <span className="font-medium">{cliente.numeroOrcamento}</span>
                </div>
              )}
              {cliente.prazoOrcamento && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Prazo</span>
                  <span className="font-medium">{format(new Date(cliente.prazoOrcamento), "dd/MM/yy")}</span>
                </div>
              )}
              <div className="flex justify-between text-xs border-t border-dashed border-border pt-1.5 mt-1">
                <span className="font-medium">Total</span>
                <span className="font-bold tabular-nums">{formatBRL(cliente.valorOrcamento)}</span>
              </div>
            </div>
            <div className="flex gap-2 p-2 border-t border-border bg-muted/40">
              <Button size="sm" variant="outline" className="h-7 text-[11px] flex-1" onClick={() => router.push(`/clientes/${cliente.id}`)}>
                <ExternalLink className="w-3 h-3 mr-1" /> Abrir no CRM
              </Button>
              <Button
                size="sm"
                className="h-7 text-[11px] flex-1 bg-green-600 hover:bg-green-700 text-white opacity-60"
                disabled
                title="Integração de pagamento entra na próxima fase"
              >
                <CreditCard className="w-3 h-3 mr-1" /> Link de pagamento
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Notas da equipe */}
      <div className="p-4 space-y-2 border-b border-border">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <StickyNote className="w-3 h-3" /> Notas da equipe
        </p>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          onBlur={salvarNota}
          rows={2}
          placeholder="Anotação visível só pra equipe…"
          className="w-full text-xs rounded-md border border-dashed border-border bg-muted/40 px-2.5 py-2 outline-none focus:ring-2 focus:ring-green-500/30 resize-none"
        />
        {patch.isPending && <p className="text-[10px] text-muted-foreground">salvando…</p>}
      </div>

      {/* Atividade */}
      <div className="p-4 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Activity className="w-3 h-3" /> Atividade
        </p>
        <div className="relative pl-4 space-y-2.5 before:absolute before:left-[3px] before:top-1 before:bottom-1 before:w-px before:bg-border">
          {[
            cliente?.orcamentoEnviadoEm && { t: "Orçamento enviado", d: cliente.orcamentoEnviadoEm, g: true },
            conversa.responsavel && { t: `Responsável: ${conversa.responsavel.nome}`, d: null, g: false },
            cliente?.createdAt && { t: "Cliente registrado no CRM", d: cliente.createdAt, g: true },
            conversa.createdAt && { t: "Conversa iniciada no WhatsApp", d: conversa.createdAt, g: false },
          ]
            .filter((x): x is { t: string; d: string | null; g: boolean } => Boolean(x))
            .map((ev, i) => (
              <div key={i} className="relative text-[11px] text-muted-foreground">
                <span className={cn("absolute -left-4 top-1 w-1.5 h-1.5 rounded-full ring-2 ring-background", ev.g ? "bg-green-500" : "bg-muted-foreground/50")} />
                <span className="text-foreground">{ev.t}</span>
                {ev.d && <span className="block text-[10px]">{format(new Date(ev.d), "dd/MM/yy HH:mm")}</span>}
              </div>
            ))}
        </div>
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

  const importar = useMutation({
    mutationFn: async () => {
      let offset = 0;
      let total = 0;
      for (let i = 0; i < 15; i++) {
        const { data } = await axios.post(
          `/api/whatsapp/sessoes/${sessao.id}/importar-historico?dias=30&offset=${offset}`,
        );
        total += (data as { importadas: number }).importadas;
        if ((data as { completo: boolean }).completo) break;
        offset = (data as { proximoOffset: number }).proximoOffset;
      }
      return total;
    },
    onSuccess: (total) => {
      toast.success(`Histórico importado — ${total} mensagem${total === 1 ? "" : "s"}`);
      queryClient.invalidateQueries({ queryKey: ["wa-conversas"] });
      queryClient.invalidateQueries({ queryKey: ["wa-quadro"] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Erro ao importar histórico");
    },
  });

  const online = sessao.status === "ONLINE";
  const aguardandoQr = sessao.status === "WAITING_QR";
  const stale = sessao.healthStatus === "STALE";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="flex items-center gap-3.5 p-4">
        <div
          className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0",
            stale
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : online
                ? "bg-green-600 text-white"
                : "bg-muted text-muted-foreground border border-border"
          )}
        >
          {getInitials(sessao.nome)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{sessao.nome}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px]">
            <span className="text-muted-foreground">
              {sessao.numero ? formatPhone(sessao.numero) : "Aguardando conexão via QR Code"}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-1.5 py-px font-semibold",
                online
                  ? "border-green-500/40 text-green-600 dark:text-green-400"
                  : aguardandoQr
                    ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                    : "border-border text-muted-foreground"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", online ? "bg-green-500" : aguardandoQr ? "bg-amber-500" : "bg-muted-foreground")} />
              {online ? "Conectado" : aguardandoQr ? "Aguardando leitura" : "Desconectado"}
            </span>
            {sessao.healthStatus !== "UNKNOWN" && (
              <span className={cn("inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-px font-semibold", stale ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                <span className={cn("w-1.5 h-1.5 rounded-full", stale ? "bg-amber-500" : "bg-green-500")} />
                {stale ? "Sem sinal há tempo" : "Saudável"}
              </span>
            )}
          </div>
        </div>
        {podeGerenciar && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => reiniciar.mutate()} disabled={reiniciar.isPending}>
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1", reiniciar.isPending && "animate-spin")} />
              Reconectar
            </Button>
            <Button size="icon" variant="ghost" className="w-7 h-7" title="Desconectar" onClick={() => desconectar.mutate()} disabled={desconectar.isPending}>
              <PowerOff className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              title="Importar as conversas do último mês do WhatsApp"
              onClick={() => importar.mutate()}
              disabled={importar.isPending}
            >
              {importar.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
              Importar histórico
            </Button>
            <Button size="icon" variant="ghost" className="w-7 h-7" title="Eventos da sessão" onClick={() => setLogsAbertos((v) => !v)}>
              <History className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Remover canal"
              onClick={() => onDelete(sessao.id)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Remover
            </Button>
          </div>
        )}
      </div>

      <div className={cn("px-4 py-2 border-t border-border text-[11px] flex items-center gap-1.5", stale ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
        <Clock className="w-3 h-3 shrink-0" />
        {stale
          ? "Não recebe mensagens há um tempo. Verifique se o celular está online, ou reconecte."
          : `Dono: ${sessao.atendente?.nome ?? "não atribuído"}`}
      </div>

      {aguardandoQr && (
        <div className="border-t border-border bg-muted/30 px-4 py-3 text-[11px] text-muted-foreground">
          <p className="font-semibold text-foreground mb-1">Para conectar este número:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>No celular: WhatsApp → <b>Aparelhos conectados</b></li>
            <li>Toque em <b>Conectar um aparelho</b></li>
            <li>Use <b>Reconectar</b> acima para gerar o QR Code</li>
          </ol>
        </div>
      )}

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
    <div className="flex-1 min-w-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-7 pb-16">
        <h2 className="text-xl font-bold tracking-tight">Canais conectados</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-[60ch]">
          Cada número de WhatsApp é um canal ligado ao CRM por QR Code — sem migrar pra Meta. Você
          conecta, reconecta ou remove um número quando quiser (número errado, troca de aparelho,
          sair e entrar de novo).
        </p>

        <div className="flex items-center gap-3 mt-5 mb-4">
          {podeVerTodas && (
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs w-fit">
              {(["todas", "minhas"] as const).map((op) => (
                <button
                  key={op}
                  onClick={() => onEscopoChange(op)}
                  className={cn(
                    "px-3 py-1 rounded-md font-semibold transition-colors",
                    escopo === op ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {op === "todas" ? "Todos os canais" : "Só os meus"}
                </button>
              ))}
            </div>
          )}
          <span className="flex-1" />
          {podeAdicionar && (
            <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={onAdd}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Adicionar número
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {sessoes.map((s) => (
            <LinhaSessao
              key={s.id}
              sessao={s}
              podeGerenciar={podeVerTodas || s.atendenteId === meuUserId}
              onDelete={onDelete}
            />
          ))}

          {sessoes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum canal conectado ainda.</p>
          )}

          {podeAdicionar && (
            <div className="rounded-xl border border-dashed border-border p-5 text-center">
              <p className="text-sm font-semibold">Adicionar mais um número</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Conecte quantos números precisar. Cada atendente enxerga só o seu; Admin e Dev veem todos.
              </p>
              <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={onAdd}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Conectar número
              </Button>
            </div>
          )}
        </div>
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
      <div className="flex items-start gap-2">
        <AvatarWA fotoUrl={c.fotoUrl} nome={c.contatoNome} phone={c.contatoPhone} grupo={c.isGrupo} className="w-5 h-5 text-[8px]" iconClass="w-3 h-3" />
        <p className="flex-1 min-w-0 text-xs font-semibold leading-tight line-clamp-2">
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
      <div className="px-3 py-2.5 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cor }} />
          <span className="text-xs font-bold truncate">{label}</span>
          <span className="ml-auto shrink-0 text-[11px] font-semibold text-muted-foreground bg-background rounded-full px-1.5">
            {conversas.length}
          </span>
        </div>
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

// Coluna estática (agrupamentos que não são "etapa" — sem arrastar)
function ColunaSimples({
  label, cor, conversas, onAbrir,
}: {
  label: string; cor: string; conversas: Conversa[]; onAbrir: (c: Conversa) => void;
}) {
  return (
    <div className="w-64 shrink-0 flex flex-col rounded-xl border border-border bg-muted/30 max-h-full">
      <div className="px-3 py-2.5 border-b border-border/60 flex items-center gap-2">
        <span className={cn("w-2 h-2 rounded-full", cor)} />
        <span className="text-xs font-bold truncate">{label}</span>
        <span className="ml-auto text-[11px] font-semibold text-muted-foreground bg-background rounded-full px-1.5">
          {conversas.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 min-h-[60px]">
        {conversas.map((c) => (
          <button
            key={c.id}
            onClick={() => onAbrir(c)}
            className="rounded-lg border border-border bg-card p-2.5 text-left"
          >
            <div className="flex items-start gap-2">
              <AvatarWA fotoUrl={c.fotoUrl} nome={c.contatoNome} phone={c.contatoPhone} grupo={c.isGrupo} className="w-5 h-5 text-[8px]" iconClass="w-3 h-3" />
              <p className="flex-1 min-w-0 text-xs font-semibold leading-tight line-clamp-2">
                {c.cliente?.nome ?? c.contatoNome ?? formatPhone(c.contatoPhone)}
              </p>
              {c.naoLidas > 0 && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0 mt-1" />}
            </div>
            {c.mensagens?.[0]?.conteudo && (
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{c.mensagens[0].conteudo}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {c.responsavel ? (
                <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[8px] font-bold flex items-center justify-center">
                  {getInitials(c.responsavel.nome)}
                </span>
              ) : (
                <span className="w-4 h-4 rounded-full border border-dashed border-muted-foreground/50" />
              )}
              <span className="ml-auto text-[10px] text-muted-foreground">{c.ultimaMsgEm ? formatTime(c.ultimaMsgEm) : ""}</span>
            </div>
          </button>
        ))}
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
  const [agrupar, setAgrupar] = useState<AgrupamentoQuadro>("etapa");
  const [modalEtapas, setModalEtapas] = useState(false);

  const etapasQuery = useEtapas();
  const etapas = etapasQuery.data?.etapas ?? ETAPAS_FALLBACK;
  const podeEditarEtapas = etapasQuery.data?.podeEditar ?? false;

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

  const { data: sessoesQuadro = [] } = useQuery({
    queryKey: ["wa-sessoes-quadro"],
    queryFn: async () => {
      const { data } = await axios.get("/api/whatsapp/sessoes?escopo=todas");
      return data as Sessao[];
    },
    enabled: agrupar === "canal",
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

  const idsEtapas = new Set(etapas.map((e) => e.id));
  const etapaDe = (c: Conversa) => (c.etapa && idsEtapas.has(c.etapa) ? c.etapa : etapas[0]?.id ?? "NOVA");
  const porEtapa = (e: EtapaQuadro) => conversas.filter((c) => etapaDe(c) === e);
  const naoAtribuidas = conversas.filter((c) => !c.responsavelId).length;

  // Colunas dinâmicas para agrupamentos que não são "etapa"
  const CORES_COL = ["bg-blue-500", "bg-green-500", "bg-amber-500", "bg-purple-500", "bg-rose-500", "bg-cyan-500", "bg-slate-400"];
  const VAZIO = ["Sem responsável", "Sem etiqueta", "Outro canal"];
  const colunasDinamicas: { label: string; cor: string; conversas: Conversa[] }[] = (() => {
    if (agrupar === "etapa") return [];
    const nomeSessao = new Map(sessoesQuadro.map((s) => [s.id, s.nome]));
    const grupos = new Map<string, Conversa[]>();
    const add = (k: string, c: Conversa) => {
      const arr = grupos.get(k);
      if (arr) arr.push(c);
      else grupos.set(k, [c]);
    };
    for (const c of conversas) {
      if (agrupar === "responsavel") add(c.responsavel?.nome ?? "Sem responsável", c);
      else if (agrupar === "canal") add(nomeSessao.get(c.sessaoId) ?? "Outro canal", c);
      else {
        const ts = c.tags && c.tags.length ? c.tags : ["Sem etiqueta"];
        for (const t of ts) add(t, c);
      }
    }
    return Array.from(grupos.entries())
      .sort((a, b) => {
        const av = VAZIO.includes(a[0]) ? 1 : 0;
        const bv = VAZIO.includes(b[0]) ? 1 : 0;
        return av - bv || b[1].length - a[1].length || a[0].localeCompare(b[0]);
      })
      .map(([label, cs], i) => ({
        label,
        cor: VAZIO.includes(label) ? "bg-slate-400" : CORES_COL[i % CORES_COL.length],
        conversas: cs,
      }));
  })();

  function onDragEnd(evt: DragEndEvent) {
    const { active, over } = evt;
    if (!over) return;
    const de = (active.data.current as { etapa?: EtapaQuadro })?.etapa;
    const para = ((over.data.current as { etapa?: EtapaQuadro })?.etapa ?? over.id) as EtapaQuadro;
    if (de !== para && idsEtapas.has(para)) {
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
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="text-base font-bold">Quadro de atendimento</h2>
        <span className="text-xs text-muted-foreground">
          {conversas.length} conversas · {naoAtribuidas} sem responsável
        </span>
        <div className="ml-auto flex items-center gap-3">
          {agrupar === "etapa" && podeEditarEtapas && (
            <button
              onClick={() => setModalEtapas(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-md border border-border bg-muted/40 px-2 py-1"
            >
              <Settings className="w-3.5 h-3.5" /> Editar colunas
            </button>
          )}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Agrupar por
            <select
              value={agrupar}
              onChange={(e) => setAgrupar(e.target.value as AgrupamentoQuadro)}
              className="text-xs font-semibold text-foreground bg-muted/40 border border-border rounded-md px-2 py-1 outline-none"
            >
              {AGRUPAMENTOS.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </label>
        </div>
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
      {agrupar === "etapa" ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="flex-1 flex gap-3 overflow-x-auto pb-2">
            {etapas.map((col) => (
              <KanbanColuna
                key={col.id}
                etapa={col.id}
                label={col.nome}
                cor={col.cor}
                conversas={porEtapa(col.id)}
                onAbrir={onAbrir}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <div className="flex-1 flex gap-3 overflow-x-auto pb-2">
          {colunasDinamicas.map((col) => (
            <ColunaSimples key={col.label} label={col.label} cor={col.cor} conversas={col.conversas} onAbrir={onAbrir} />
          ))}
          {colunasDinamicas.length === 0 && (
            <p className="text-sm text-muted-foreground p-4">Nenhuma conversa pra agrupar.</p>
          )}
        </div>
      )}

      {modalEtapas && (
        <ModalEtapas
          etapas={etapas}
          onClose={() => setModalEtapas(false)}
          onChange={() => {
            queryClient.invalidateQueries({ queryKey: ["wa-etapas"] });
            queryClient.invalidateQueries({ queryKey: ["wa-quadro"] });
          }}
        />
      )}
    </div>
  );
}

// ── Editar colunas do quadro ──────────────────────────────────────────────

function ModalEtapas({
  etapas, onClose, onChange,
}: {
  etapas: EtapaCol[];
  onClose: () => void;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const call = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onChange();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  };

  const renomear = (id: string, nome: string) => call(() => axios.patch(`/api/whatsapp/etapas/${id}`, { nome }));
  const recolorir = (id: string, cor: string) => call(() => axios.patch(`/api/whatsapp/etapas/${id}`, { cor }));
  const excluir = (e: EtapaCol) => {
    if (!confirm(`Excluir a coluna "${e.nome}"? As conversas nela vão pra primeira coluna.`)) return;
    call(() => axios.delete(`/api/whatsapp/etapas/${e.id}`));
  };
  const nova = () => call(() => axios.post("/api/whatsapp/etapas", { nome: "Nova coluna", cor: "#6366f1" }));
  const mover = (idx: number, dir: -1 | 1) => {
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= etapas.length) return;
    const ids = etapas.map((e) => e.id);
    [ids[idx], ids[alvo]] = [ids[alvo], ids[idx]];
    call(() => axios.put("/api/whatsapp/etapas", { ids }));
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Colunas do quadro</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {etapas.map((e, i) => (
            <div key={e.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
              <div className="flex flex-col">
                <button onClick={() => mover(i, -1)} disabled={busy || i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => mover(i, 1)} disabled={busy || i === etapas.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="color"
                defaultValue={e.cor}
                onBlur={(ev) => ev.target.value.toLowerCase() !== e.cor.toLowerCase() && recolorir(e.id, ev.target.value)}
                className="w-7 h-7 rounded border border-border bg-transparent cursor-pointer shrink-0"
                title="Cor"
              />
              <input
                defaultValue={e.nome}
                onBlur={(ev) => ev.target.value.trim() && ev.target.value.trim() !== e.nome && renomear(e.id, ev.target.value.trim())}
                className="flex-1 min-w-0 text-sm rounded-md border border-border bg-background px-2 py-1 outline-none"
              />
              {e.sistema ? (
                <span className="text-[10px] text-muted-foreground shrink-0" title="Coluna padrão — não pode ser excluída">padrão</span>
              ) : (
                <button onClick={() => excluir(e)} disabled={busy} className="text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={nova}
            disabled={busy}
            className="w-full text-xs font-semibold text-green-600 dark:text-green-400 border border-dashed border-border rounded-lg py-2 hover:bg-green-500/5 flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Nova coluna
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Nome e cor salvam ao sair do campo. As 6 colunas padrão podem ser renomeadas e reordenadas, mas não excluídas.
        </p>
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Automações (gatilho → ação) ────────────────────────────────────────────

type GatilhoTipo = "CONTATO_NOVO" | "MENSAGEM_RECEBIDA" | "FORA_DO_HORARIO" | "CLIENTE_CADASTRADO";
type AcaoTipo =
  | "ENVIAR_MENSAGEM" | "MOVER_ETAPA" | "DEFINIR_STATUS"
  | "ADICIONAR_ETIQUETA" | "NOTIFICAR_RESPONSAVEL" | "ATRIBUIR_RODIZIO";

interface AcaoAuto {
  tipo: AcaoTipo;
  texto?: string;
  etapa?: EtapaQuadro;
  status?: ConversaStatus;
  etiqueta?: string;
}
interface Automacao {
  id: string;
  nome: string;
  ativa: boolean;
  gatilho: GatilhoTipo;
  gatilhoConfig?: { palavras?: string[]; horario?: { inicio: string; fim: string; dias: number[] } } | null;
  acoes: AcaoAuto[];
  sessaoId?: string | null;
  disparos: number;
  ultimoDisparoEm?: string | null;
}

const GATILHO_LABEL: Record<GatilhoTipo, string> = {
  CONTATO_NOVO: "Primeiro contato de um número novo",
  MENSAGEM_RECEBIDA: "Cliente manda mensagem",
  FORA_DO_HORARIO: "Mensagem fora do horário de atendimento",
  CLIENTE_CADASTRADO: "Cliente cadastrado no CRM com WhatsApp",
};
const ACAO_LABEL: Record<AcaoTipo, string> = {
  ENVIAR_MENSAGEM: "Enviar mensagem",
  MOVER_ETAPA: "Mover no quadro",
  DEFINIR_STATUS: "Definir status",
  ADICIONAR_ETIQUETA: "Adicionar etiqueta",
  NOTIFICAR_RESPONSAVEL: "Notificar responsável",
  ATRIBUIR_RODIZIO: "Atribuir por rodízio",
};
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function descreverAcao(a: AcaoAuto, etapaNome: Record<string, string>): string {
  if (a.tipo === "MOVER_ETAPA") {
    return `Mover p/ "${etapaNome[a.etapa ?? ""] ?? a.etapa}"`;
  }
  if (a.tipo === "DEFINIR_STATUS") return `Status → ${a.status ? STATUS_LABEL[a.status] : "?"}`;
  if (a.tipo === "ADICIONAR_ETIQUETA") return `Etiqueta "${a.etiqueta}"`;
  return ACAO_LABEL[a.tipo];
}

const EXEMPLOS_AUTO: Omit<Automacao, "id" | "disparos" | "ultimoDisparoEm">[] = [
  {
    nome: "Saudação no primeiro contato",
    ativa: true,
    gatilho: "CONTATO_NOVO",
    acoes: [{
      tipo: "ENVIAR_MENSAGEM",
      texto: "Olá! Aqui é da Infinity Glass 👋 Já recebemos sua mensagem e um atendente vai te responder rapidinho. Pra adiantar, pode me dizer o que você precisa e a cidade?",
    }],
  },
  {
    nome: "Distribuir no primeiro contato",
    ativa: true,
    gatilho: "CONTATO_NOVO",
    acoes: [{ tipo: "ATRIBUIR_RODIZIO" }],
  },
  {
    nome: "Fora do horário",
    ativa: true,
    gatilho: "FORA_DO_HORARIO",
    gatilhoConfig: { horario: { inicio: "08:00", fim: "18:00", dias: [1, 2, 3, 4, 5] } },
    acoes: [
      { tipo: "ENVIAR_MENSAGEM", texto: "Recebemos sua mensagem! Nosso atendimento é de segunda a sexta, das 8h às 18h. Retornamos assim que abrirmos. 🙏" },
      { tipo: "DEFINIR_STATUS", status: "PENDENTE" },
    ],
  },
];

function CardAutomacao({
  a, podeEditar, etapaNome, onToggle, onEditar, onExcluir,
}: {
  a: Automacao;
  podeEditar: boolean;
  etapaNome: Record<string, string>;
  onToggle: () => void;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-background shadow-sm p-3.5 flex gap-3.5 items-start", !a.ativa && "opacity-60")}>
      <button
        onClick={onToggle}
        disabled={!podeEditar}
        title={a.ativa ? "Pausar" : "Ativar"}
        className={cn(
          "mt-0.5 w-9 h-5 rounded-full shrink-0 relative transition-colors disabled:cursor-not-allowed",
          a.ativa ? "bg-green-500" : "bg-muted-foreground/30"
        )}
      >
        <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", a.ativa ? "left-[18px]" : "left-0.5")} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{a.nome}</p>
        <div className="flex flex-wrap items-center gap-1.5 text-[13px] mt-1.5">
          <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/35 bg-muted/60 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
            <Zap className="w-3 h-3" />
            {GATILHO_LABEL[a.gatilho]}
            {a.gatilho === "MENSAGEM_RECEBIDA" && a.gatilhoConfig?.palavras?.length ? ` (${a.gatilhoConfig.palavras.join(", ")})` : ""}
          </span>
          {a.acoes.map((ac, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <span className="inline-flex items-center gap-1 rounded-md border border-green-500/35 bg-muted/60 px-2 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400">
                {descreverAcao(ac, etapaNome)}
              </span>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
          <span>Disparou {a.disparos}×</span>
          {a.ultimoDisparoEm && <span>Última: {formatTime(a.ultimoDisparoEm)}</span>}
        </div>
      </div>
      {podeEditar && (
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={onEditar} className="text-[11px] font-semibold rounded-md border border-border bg-muted/50 px-2.5 py-1 text-muted-foreground hover:text-foreground">
            Editar
          </button>
          <button onClick={onExcluir} className="text-[11px] font-semibold rounded-md border border-border bg-muted/50 px-2.5 py-1 text-destructive hover:bg-destructive/10">
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}

function FormAutomacao({
  inicial, etapas, onClose, onSaved,
}: {
  inicial: Automacao | null;
  etapas: EtapaCol[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [gatilho, setGatilho] = useState<GatilhoTipo>(inicial?.gatilho ?? "CONTATO_NOVO");
  const [palavras, setPalavras] = useState((inicial?.gatilhoConfig?.palavras ?? []).join(", "));
  const [inicio, setInicio] = useState(inicial?.gatilhoConfig?.horario?.inicio ?? "08:00");
  const [fim, setFim] = useState(inicial?.gatilhoConfig?.horario?.fim ?? "18:00");
  const [dias, setDias] = useState<number[]>(inicial?.gatilhoConfig?.horario?.dias ?? [1, 2, 3, 4, 5]);
  const [acoes, setAcoes] = useState<AcaoAuto[]>(inicial?.acoes?.length ? inicial.acoes : [{ tipo: "ENVIAR_MENSAGEM", texto: "" }]);
  const [sessaoId, setSessaoId] = useState<string>(inicial?.sessaoId ?? "");
  const [salvando, setSalvando] = useState(false);

  const { data: sessoes = [] } = useQuery({
    queryKey: ["wa-sessoes", "todas"],
    queryFn: async () => {
      const { data } = await axios.get("/api/whatsapp/sessoes?escopo=todas");
      return data as Sessao[];
    },
    enabled: gatilho === "CLIENTE_CADASTRADO",
  });

  const setAcao = (i: number, patch: Partial<AcaoAuto>) =>
    setAcoes((as) => as.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  async function salvar() {
    if (!nome.trim()) { toast.error("Dê um nome à regra"); return; }
    const gatilhoConfig: Automacao["gatilhoConfig"] = {};
    if (gatilho === "MENSAGEM_RECEBIDA" && palavras.trim()) {
      gatilhoConfig.palavras = palavras.split(",").map((p) => p.trim()).filter(Boolean);
    }
    if (gatilho === "FORA_DO_HORARIO") {
      gatilhoConfig.horario = { inicio, fim, dias };
    }
    const body = {
      nome: nome.trim(),
      gatilho,
      gatilhoConfig,
      acoes,
      sessaoId: gatilho === "CLIENTE_CADASTRADO" ? (sessaoId || null) : null,
    };
    setSalvando(true);
    try {
      if (inicial) await axios.patch(`/api/whatsapp/automacoes/${inicial.id}`, body);
      else await axios.post("/api/whatsapp/automacoes", body);
      toast.success(inicial ? "Regra atualizada" : "Regra criada");
      onSaved();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{inicial ? "Editar regra" : "Nova regra"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Saudação no primeiro contato" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Quando (gatilho)</Label>
            <select
              value={gatilho}
              onChange={(e) => setGatilho(e.target.value as GatilhoTipo)}
              className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 outline-none"
            >
              {(Object.keys(GATILHO_LABEL) as GatilhoTipo[]).map((g) => (
                <option key={g} value={g}>{GATILHO_LABEL[g]}</option>
              ))}
            </select>
          </div>

          {gatilho === "MENSAGEM_RECEBIDA" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Palavras-chave (opcional, separadas por vírgula)</Label>
              <Input value={palavras} onChange={(e) => setPalavras(e.target.value)} placeholder="fechado, aprovado, pode fazer" />
              <p className="text-[11px] text-muted-foreground">Vazio = qualquer mensagem dispara a regra.</p>
            </div>
          )}

          {gatilho === "CLIENTE_CADASTRADO" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Enviar pelo canal</Label>
              <select
                value={sessaoId}
                onChange={(e) => setSessaoId(e.target.value)}
                className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 outline-none"
              >
                <option value="">Primeiro canal online</option>
                {sessoes.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
              <p className="text-[11px] text-amber-600 dark:text-amber-500">
                ⚠️ Mandar mensagem pra quem nunca te chamou aumenta o risco de bloqueio no WhatsApp.
                Use só quando o cliente já espera o contato. Só dispara se ainda não existe conversa com esse número.
              </p>
            </div>
          )}

          {gatilho === "FORA_DO_HORARIO" && (
            <div className="space-y-2">
              <Label className="text-xs">Horário de atendimento</Label>
              <div className="flex items-center gap-2 text-sm">
                <input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1" />
                <span className="text-muted-foreground">até</span>
                <input type="time" value={fim} onChange={(e) => setFim(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DIAS_SEMANA.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setDias((ds) => (ds.includes(i) ? ds.filter((x) => x !== i) : [...ds, i]))}
                    className={cn(
                      "text-xs font-semibold rounded-md border px-2 py-1",
                      dias.includes(i) ? "bg-green-600 text-white border-transparent" : "border-border text-muted-foreground"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">A regra dispara quando a mensagem chega FORA desse horário.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Fazer o quê (ações, em ordem)</Label>
            {acoes.map((a, i) => (
              <div key={i} className="rounded-lg border border-border p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={a.tipo}
                    onChange={(e) => setAcao(i, { tipo: e.target.value as AcaoTipo })}
                    className="flex-1 text-sm rounded-md border border-border bg-background px-2 py-1.5 outline-none"
                  >
                    {(Object.keys(ACAO_LABEL) as AcaoTipo[]).map((t) => (
                      <option key={t} value={t}>{ACAO_LABEL[t]}</option>
                    ))}
                  </select>
                  {acoes.length > 1 && (
                    <button onClick={() => setAcoes((as) => as.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {a.tipo === "ENVIAR_MENSAGEM" && (
                  <>
                    <textarea
                      value={a.texto ?? ""}
                      onChange={(e) => setAcao(i, { texto: e.target.value })}
                      rows={3}
                      placeholder="Texto da mensagem…"
                      className="w-full text-sm rounded-md border border-border bg-background px-2.5 py-2 outline-none resize-none"
                    />
                    <p className="text-[11px] text-muted-foreground">Use {"{{nome}}"} ou {"{{primeiro_nome}}"} pra personalizar.</p>
                  </>
                )}
                {a.tipo === "MOVER_ETAPA" && (
                  <select
                    value={a.etapa ?? etapas[0]?.id ?? "NOVA"}
                    onChange={(e) => setAcao(i, { etapa: e.target.value })}
                    className="w-full text-sm rounded-md border border-border bg-background px-2 py-1.5 outline-none"
                  >
                    {etapas.map((et) => (
                      <option key={et.id} value={et.id}>{et.nome}</option>
                    ))}
                  </select>
                )}
                {a.tipo === "DEFINIR_STATUS" && (
                  <select
                    value={a.status ?? "PENDENTE"}
                    onChange={(e) => setAcao(i, { status: e.target.value as ConversaStatus })}
                    className="w-full text-sm rounded-md border border-border bg-background px-2 py-1.5 outline-none"
                  >
                    {(["ABERTA", "PENDENTE", "RESOLVIDA"] as ConversaStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                )}
                {a.tipo === "ADICIONAR_ETIQUETA" && (
                  <Input value={a.etiqueta ?? ""} onChange={(e) => setAcao(i, { etiqueta: e.target.value })} placeholder="Nome da etiqueta" />
                )}
                {a.tipo === "NOTIFICAR_RESPONSAVEL" && (
                  <Input value={a.texto ?? ""} onChange={(e) => setAcao(i, { texto: e.target.value })} placeholder="Texto da notificação (opcional)" />
                )}
              </div>
            ))}
            <button
              onClick={() => setAcoes((as) => [...as, { tipo: "ENVIAR_MENSAGEM", texto: "" }])}
              className="text-xs font-semibold text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar ação
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando} className="bg-green-600 hover:bg-green-700 text-white">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : inicial ? "Salvar" : "Criar regra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PainelAutomacoes() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Automacao | null | "novo">(null);

  const { data, isLoading } = useQuery({
    queryKey: ["wa-automacoes"],
    queryFn: async () => {
      const { data } = await axios.get("/api/whatsapp/automacoes");
      return data as { automacoes: Automacao[]; podeEditar: boolean };
    },
  });
  const automacoes = data?.automacoes ?? [];
  const podeEditar = data?.podeEditar ?? false;
  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["wa-automacoes"] });

  const etapas = useEtapas().data?.etapas ?? ETAPAS_FALLBACK;
  const etapaNome: Record<string, string> = Object.fromEntries(etapas.map((e) => [e.id, e.nome]));

  const toggle = async (a: Automacao) => {
    try {
      await axios.patch(`/api/whatsapp/automacoes/${a.id}`, { ativa: !a.ativa });
      invalidar();
    } catch {
      toast.error("Erro ao alterar");
    }
  };
  const excluir = async (a: Automacao) => {
    if (!confirm(`Excluir a regra "${a.nome}"?`)) return;
    try {
      await axios.delete(`/api/whatsapp/automacoes/${a.id}`);
      invalidar();
    } catch {
      toast.error("Erro ao excluir");
    }
  };
  const criarExemplos = async () => {
    try {
      await Promise.all(EXEMPLOS_AUTO.map((e) => axios.post("/api/whatsapp/automacoes", e)));
      toast.success("Exemplos criados");
      invalidar();
    } catch {
      toast.error("Erro ao criar exemplos");
    }
  };

  const ativas = automacoes.filter((a) => a.ativa).length;

  return (
    <div className="flex-1 min-w-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-7 pb-16">
        <h2 className="text-xl font-bold tracking-tight">Automações</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-[60ch]">
          Regras de <b className="text-foreground">gatilho → ação</b> que rodam sozinhas sobre cada
          conversa, no mesmo motor de eventos do módulo. Não valem para grupos.
        </p>

        {!podeEditar && (
          <div className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Só Administrador e Desenvolvedor criam ou editam regras. Você vê as que estão ativas.
          </div>
        )}

        <div className="flex items-center gap-3 mt-5 mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {ativas} ativa{ativas === 1 ? "" : "s"} · {automacoes.length - ativas} pausada{automacoes.length - ativas === 1 ? "" : "s"}
          </span>
          <span className="flex-1" />
          {podeEditar && (
            <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => setForm("novo")}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Nova regra
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </div>
        ) : automacoes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma regra ainda.</p>
            {podeEditar && (
              <div className="flex gap-2 justify-center mt-3">
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={criarExemplos}>
                  <Sparkles className="w-3.5 h-3.5 mr-1" /> Adicionar exemplos
                </Button>
                <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => setForm("novo")}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Nova regra
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {automacoes.map((a) => (
              <CardAutomacao
                key={a.id}
                a={a}
                podeEditar={podeEditar}
                etapaNome={etapaNome}
                onToggle={() => toggle(a)}
                onEditar={() => setForm(a)}
                onExcluir={() => excluir(a)}
              />
            ))}
          </div>
        )}
      </div>

      {form && (
        <FormAutomacao
          inicial={form === "novo" ? null : form}
          etapas={etapas}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); invalidar(); }}
        />
      )}
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
  const [aba, setAba] = useState<"conversas" | "quadro" | "automacoes" | "canais">("conversas");
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

  // Módulo liberado só para o Desenvolvedor por enquanto. Some da sidebar para
  // os demais cargos (inclusive Administrador); aqui bloqueia o acesso direto
  // pela URL.
  if (user && user.role !== "DESENVOLVEDOR") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <MessageCircle className="w-16 h-16 text-muted-foreground opacity-30" />
        <div>
          <h2 className="text-xl font-semibold">Acesso restrito</h2>
          <p className="text-muted-foreground mt-1 text-sm max-w-sm">
            O módulo WhatsApp está disponível apenas para o Desenvolvedor por enquanto.
          </p>
        </div>
      </div>
    );
  }

  const abaBtn = (
    id: "conversas" | "quadro" | "automacoes" | "canais",
    label: string,
    icon: React.ReactNode,
    extra?: React.ReactNode,
  ) => (
    <button
      onClick={() => { setAba(id); if (id !== "conversas") setConversa(null); }}
      className={cn(
        "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
        aba === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
      {extra}
    </button>
  );

  return (
    <div className="h-[calc(100svh-4rem)] min-h-0 flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm -m-4 md:-m-6">
      {/* Navegação do módulo — Caixa de entrada | Quadro | Automações | Canais */}
      <div className="flex items-center gap-1 px-2.5 h-11 border-b border-border bg-muted/40 shrink-0">
        <div className="flex items-center gap-2 pl-1 pr-3 mr-1 border-r border-border shrink-0">
          <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_0_3px] shadow-green-500/20" />
          <span className="text-sm font-bold tracking-tight hidden sm:inline">Atendimento WhatsApp</span>
          <span className="text-[10px] font-bold tracking-wider text-blue-600 dark:text-blue-400 border border-blue-500/40 rounded px-1 py-px">IA</span>
        </div>
        {abaBtn("conversas", "Caixa de entrada", <Inbox className="w-4 h-4" />)}
        {sessoes.length > 0 && abaBtn("quadro", "Quadro", <Activity className="w-4 h-4" />)}
        {abaBtn("automacoes", "Automações", <Zap className="w-4 h-4" />)}
        {abaBtn(
          "canais",
          "Canais",
          <Smartphone className="w-4 h-4" />,
          sessoes.length > 0 ? (
            <span className="text-[11px] font-semibold rounded-full bg-muted px-1.5 leading-tight">{sessoes.length}</span>
          ) : undefined
        )}
      </div>

      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
        {/* Rail de sessões */}
        <PainelSessoes
          sessoes={sessoes}
          selected={sessaoId}
          onSelect={(id) => { setSessaoId(id); setConversa(null); setAba("conversas"); }}
          onAdd={() => setModalAberto(true)}
          podeAdicionar={podeAdicionar}
        />

        {aba === "automacoes" ? (
          <PainelAutomacoes />
        ) : aba === "canais" ? (
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
            <div className={cn("flex flex-col border-r border-border min-h-0 overflow-hidden", painelChat ? "hidden md:flex md:w-80" : "flex flex-1 md:flex-none md:w-80")}>
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
            <div className={cn("flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden", !painelChat && "hidden md:flex")}>
              <AreaChat
                conversa={conversa}
                onBack={() => setConversa(null)}
                sessaoNome={sessaoAtual?.nome}
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
