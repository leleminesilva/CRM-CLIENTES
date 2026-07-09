"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageCircle, Phone, Send, Loader2, ChevronLeft, Check, CheckCheck,
  Search, QrCode, AlertTriangle, Paperclip, FileText, Download, ExternalLink, WifiOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const POLL_INSTANCIAS_MS = 2500;
const POLL_CONVERSAS_MS = 3000;
const POLL_MENSAGENS_MS = 2500;
// Heartbeat do bridge é a cada 20s — 2 batidas perdidas (45s) já indicam processo morto,
// não só uma falha isolada de rede.
const HEARTBEAT_STALE_MS = 45000;

interface Instancia {
  id: string;
  nome: string;
  statusConexao: string;
  qrCode?: string | null;
  phoneNumber?: string | null;
  ultimoPing?: string | null;
}

interface Mensagem {
  id: string;
  direcao: "entrada" | "saida";
  tipo: string;
  conteudo: string;
  status: string;
  mediaUrl?: string | null;
  enviadaEm: string;
}

interface Conversa {
  id: string;
  instanciaId: string;
  contatoPhone: string;
  contatoNome?: string;
  clienteId?: string | null;
  naoLidas: number;
  ultimaMsgEm?: string;
  mensagens?: Mensagem[];
}

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return phone;
}

// Usado na lista de conversas (rótulo relativo do dia da última mensagem)
function formatTime(date: string) {
  const d = new Date(date);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM/yy", { locale: ptBR });
}

// Usado dentro do balão da mensagem — sempre hora, nunca "Ontem" (o separador de data já
// agrupa por dia; o horário de cada mensagem precisa ser sempre a hora mesmo).
function formatMsgTime(date: string) {
  return format(new Date(date), "HH:mm");
}

function getInitials(name?: string, phone?: string) {
  if (name) return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (phone ?? "?").slice(-2);
}

function instanciaConectadaEViva(inst?: Instancia): boolean {
  if (!inst || inst.statusConexao !== "conectado") return false;
  if (!inst.ultimoPing) return true; // versão antiga do bridge sem heartbeat ainda — não bloqueia
  return Date.now() - new Date(inst.ultimoPing).getTime() < HEARTBEAT_STALE_MS;
}

function previewConteudo(msg?: Mensagem): string {
  if (!msg) return "";
  if (msg.mediaUrl) {
    const rotulos: Record<string, string> = { imagem: "📷 Foto", video: "🎬 Vídeo", audio: "🎤 Áudio", documento: "📄 Documento", figurinha: "😀 Figurinha" };
    return rotulos[msg.tipo] || "📎 Anexo";
  }
  return msg.conteudo;
}

// Legenda embaixo da mídia no balão do chat: nunca pra áudio (WhatsApp não tem legenda de
// áudio) nem pro nome do arquivo em documento (isso já aparece dentro do card do anexo), e
// nunca quando é só um texto de preenchimento tipo "[imagem]"/"[audio]" sem legenda real.
function legendaVisivel(msg: Mensagem): boolean {
  if (!msg.conteudo) return false;
  if (msg.tipo === "audio" || msg.tipo === "documento") return false;
  return !/^\[.+\]$/.test(msg.conteudo);
}

function tocarBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // navegador pode bloquear áudio sem interação prévia — sem problema, é só um extra
  }
}

function StatusIcon({ status }: { status: string }) {
  if (status === "erro") return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
  if (status === "lida") return <CheckCheck className="w-3.5 h-3.5 text-blue-400" />;
  if (status === "entregue") return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />;
  if (status === "enviada") return <Check className="w-3.5 h-3.5 text-muted-foreground" />;
  return <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />;
}

// ── Bolha de mídia dentro do chat ───────────────────────────────────────────

function BolhaMidia({ msg }: { msg: Mensagem }) {
  if (!msg.mediaUrl) return null;
  if (msg.tipo === "imagem" || msg.tipo === "figurinha") {
    return (
      <a href={msg.mediaUrl} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={msg.mediaUrl} alt={msg.conteudo || "Imagem"} className="rounded-lg max-w-[240px] max-h-64 object-cover" />
      </a>
    );
  }
  if (msg.tipo === "video") {
    return <video controls src={msg.mediaUrl} className="rounded-lg max-w-[240px] max-h-64" />;
  }
  if (msg.tipo === "audio") {
    return <audio controls src={msg.mediaUrl} className="max-w-[240px] h-10" />;
  }
  return (
    <a
      href={msg.mediaUrl}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg border border-current/20 px-3 py-2 hover:bg-black/5 transition-colors"
    >
      <FileText className="w-5 h-5 shrink-0" />
      <span className="text-sm truncate max-w-[160px]">{msg.conteudo || "Documento"}</span>
      <Download className="w-4 h-4 shrink-0 opacity-70" />
    </a>
  );
}

// ── Painel de instâncias (vários números conectados) ────────────────────────

function PainelInstancias({
  instancias, selected, onSelect,
}: {
  instancias: Instancia[]; selected: string | null; onSelect: (id: string) => void;
}) {
  if (instancias.length === 0) return null;

  return (
    <div className="w-16 md:w-20 flex flex-col bg-sidebar border-r border-border shrink-0">
      <div className="h-14 flex items-center justify-center border-b border-border">
        <QrCode className="w-6 h-6 text-red-500" />
      </div>
      <ScrollArea className="flex-1">
        <div className="py-2 flex flex-col items-center gap-2 px-2">
          {instancias.map((inst) => {
            const viva = instanciaConectadaEViva(inst);
            return (
              <button
                key={inst.id}
                onClick={() => onSelect(inst.id)}
                title={inst.nome}
                className={cn(
                  "relative w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all",
                  selected === inst.id ? "bg-red-600 text-white shadow-lg scale-105" : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {getInitials(inst.nome)}
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
                    viva ? "bg-green-500" : "bg-amber-500"
                  )}
                />
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Tela de conexão (aguardando bridge / QR code / bridge parado) ──────────

function TelaConexao({ instancia }: { instancia: Instancia | undefined }) {
  if (!instancia) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-20 h-20 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <QrCode className="w-10 h-10 text-red-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Aguardando conector</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">
            Inicie o script <code className="px-1 py-0.5 rounded bg-muted text-xs">whatsapp-bridge</code> no
            computador que vai ficar com o WhatsApp conectado. O QR Code aparece aqui assim que ele iniciar.
          </p>
        </div>
      </div>
    );
  }

  if (instancia.statusConexao === "conectado" && !instanciaConectadaEViva(instancia)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-20 h-20 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <WifiOff className="w-10 h-10 text-amber-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Conector sem resposta</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">
            O terminal do <code className="px-1 py-0.5 rounded bg-muted text-xs">whatsapp-bridge</code> parece ter
            fechado ou o computador dormiu. Abra o terminal de novo e rode <code className="px-1 py-0.5 rounded bg-muted text-xs">npm start</code> pra
            reconectar (não precisa escanear o QR de novo).
          </p>
        </div>
      </div>
    );
  }

  if (instancia.statusConexao === "aguardando_qr" && instancia.qrCode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="p-4 bg-white rounded-2xl shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={instancia.qrCode} alt="QR Code do WhatsApp" className="w-56 h-56" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Escaneie com o WhatsApp</h2>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho, e aponte a câmera pro QR Code.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
      <p className="text-muted-foreground">Conectando ao conector local...</p>
    </div>
  );
}

// ── Lista de conversas ──────────────────────────────────────────────────────

function ListaConversas({
  conversas, selectedId, onSelect, search, onSearchChange,
}: {
  conversas: Conversa[]; selectedId: string | null; onSelect: (c: Conversa) => void;
  search: string; onSearchChange: (v: string) => void;
}) {
  const filtered = conversas.filter((c) => {
    const q = search.toLowerCase();
    return c.contatoNome?.toLowerCase().includes(q) || c.contatoPhone.includes(q);
  });

  return (
    <div className="w-full md:w-80 flex flex-col border-r border-border shrink-0">
      <div className="h-14 flex items-center px-4 border-b border-border">
        <p className="font-semibold text-sm">Conversas (QR temporário)</p>
      </div>
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8 h-9 text-sm" placeholder="Buscar conversa..." value={search} onChange={(e) => onSearchChange(e.target.value)} />
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
                  className={cn("w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left", selectedId === c.id && "bg-accent")}
                >
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 flex items-center justify-center text-sm font-bold shrink-0">
                    {getInitials(c.contatoNome, c.contatoPhone)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={cn("text-sm truncate flex items-center gap-1", c.naoLidas > 0 && "font-semibold")}>
                        {c.contatoNome ?? formatPhone(c.contatoPhone)}
                        {c.clienteId && <span title="Cliente cadastrado" className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                      </span>
                      {c.ultimaMsgEm && <span className="text-xs text-muted-foreground shrink-0">{formatTime(c.ultimaMsgEm)}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <span className="text-xs text-muted-foreground truncate">
                        {lastMsg ? (lastMsg.direcao === "saida" ? `Você: ${previewConteudo(lastMsg)}` : previewConteudo(lastMsg)) : formatPhone(c.contatoPhone)}
                      </span>
                      {c.naoLidas > 0 && <Badge className="bg-red-600 text-white h-5 min-w-[20px] shrink-0 text-xs px-1.5">{c.naoLidas}</Badge>}
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

// ── Área do chat ─────────────────────────────────────────────────────────

function AreaChat({ conversa, onBack }: { conversa: Conversa | null; onBack: () => void }) {
  const [texto, setTexto] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["whats-mensagens", conversa?.id],
    queryFn: async () => {
      const { data } = await axios.get(`/api/whatsapp/conversas/${conversa!.id}`);
      return data as { mensagens: Mensagem[] };
    },
    enabled: !!conversa?.id,
    refetchInterval: POLL_MENSAGENS_MS,
  });

  const enviar = useMutation({
    mutationFn: async (mensagem: string) => {
      const { data } = await axios.post("/api/whatsapp/enviar", { conversaId: conversa!.id, mensagem });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whats-mensagens", conversa?.id] });
      queryClient.invalidateQueries({ queryKey: ["whats-conversas"] });
      setTexto("");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Erro ao enviar mensagem");
    },
  });

  const enviarArquivo = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("conversaId", conversa!.id);
      form.append("file", file);
      const { data } = await axios.post("/api/whatsapp/enviar-midia", form);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whats-mensagens", conversa?.id] });
      queryClient.invalidateQueries({ queryKey: ["whats-conversas"] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Erro ao enviar arquivo");
    },
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [data?.mensagens]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (texto.trim()) enviar.mutate(texto.trim());
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) enviarArquivo.mutate(file);
    e.target.value = "";
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
  const groups: { date: string; msgs: Mensagem[] }[] = [];
  for (const msg of mensagens) {
    const d = format(new Date(msg.enviadaEm), "yyyy-MM-dd");
    const last = groups[groups.length - 1];
    if (last?.date === d) last.msgs.push(msg);
    else groups.push({ date: d, msgs: [msg] });
  }

  function labelDate(d: string) {
    const date = new Date(d);
    if (isToday(date)) return "Hoje";
    if (isYesterday(date)) return "Ontem";
    return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="h-14 flex items-center gap-3 px-4 border-b border-border bg-card shrink-0">
        <button onClick={onBack} className="md:hidden p-1 -ml-1 rounded hover:bg-accent">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 flex items-center justify-center text-sm font-bold shrink-0">
          {getInitials(conversa.contatoNome, conversa.contatoPhone)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{conversa.contatoNome ?? formatPhone(conversa.contatoPhone)}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="w-3 h-3" /> {formatPhone(conversa.contatoPhone)}
          </p>
        </div>
        {conversa.clienteId && (
          <Link
            href={`/clientes/${conversa.clienteId}`}
            className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 shrink-0 px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
          >
            Ver cliente <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>

      <ScrollArea className="flex-1 px-4 py-4" style={{ backgroundImage: "radial-gradient(circle, hsl(var(--muted)/0.3) 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : mensagens.length === 0 ? (
          <div className="flex justify-center py-8 text-muted-foreground text-sm">Nenhuma mensagem ainda</div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.date}>
                <div className="flex justify-center mb-3">
                  <span className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">{labelDate(g.date)}</span>
                </div>
                <div className="space-y-1.5">
                  {g.msgs.map((msg) => (
                    <div key={msg.id} className={cn("flex", msg.direcao === "saida" ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm", msg.direcao === "saida" ? "bg-red-600 text-white rounded-tr-sm" : "bg-card text-foreground rounded-tl-sm border border-border")}>
                        {msg.mediaUrl ? (
                          <div className="space-y-1.5">
                            <BolhaMidia msg={msg} />
                            {legendaVisivel(msg) && <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
                        )}
                        <div className={cn("flex items-center gap-1 mt-1", msg.direcao === "saida" ? "justify-end" : "justify-start")}>
                          <span className={cn("text-[10px]", msg.direcao === "saida" ? "text-red-200" : "text-muted-foreground")}>{formatMsgTime(msg.enviadaEm)}</span>
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

      <div className="p-3 border-t border-border bg-card shrink-0">
        <div className="flex items-end gap-2">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
          <button
            type="button"
            disabled={enviarArquivo.isPending}
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-xl border border-input hover:bg-accent disabled:opacity-50 text-muted-foreground shrink-0 flex items-center justify-center"
            title="Anexar arquivo"
          >
            {enviarArquivo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </button>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem... (Enter para enviar)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-all min-h-[42px] max-h-32"
            style={{ scrollbarWidth: "none" }}
          />
          <button
            disabled={!texto.trim() || enviar.isPending}
            onClick={() => texto.trim() && enviar.mutate(texto.trim())}
            className="w-10 h-10 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shrink-0 flex items-center justify-center"
          >
            {enviar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────────

export default function WhatsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMINISTRADOR";
  const [instanciaId, setInstanciaId] = useState<string | null>(null);
  const [conversa, setConversa] = useState<Conversa | null>(null);
  const [search, setSearch] = useState("");
  const naoLidasAnterior = useRef<number | null>(null);

  const { data: instancias = [] } = useQuery({
    queryKey: ["whats-instancias"],
    queryFn: async () => {
      const { data } = await axios.get("/api/whatsapp/instancias?tipo=QRCODE");
      return data as Instancia[];
    },
    refetchInterval: POLL_INSTANCIAS_MS,
  });

  useEffect(() => {
    if (instancias.length > 0 && !instancias.some((i) => i.id === instanciaId)) {
      setInstanciaId(instancias[0].id);
    }
  }, [instancias, instanciaId]);

  const instanciaAtual = instancias.find((i) => i.id === instanciaId);
  const conectado = instanciaConectadaEViva(instanciaAtual);

  const { data: conversas = [] } = useQuery({
    queryKey: ["whats-conversas", instanciaAtual?.id],
    queryFn: async () => {
      const { data } = await axios.get(`/api/whatsapp/conversas?instanciaId=${instanciaAtual!.id}`);
      return data as Conversa[];
    },
    enabled: !!instanciaAtual?.id && conectado,
    refetchInterval: POLL_CONVERSAS_MS,
  });

  // Toast + beep quando chega mensagem nova de alguém que não é a conversa aberta no momento.
  // Só considera "nova" se a mensagem em si for recente — sem isso, a sincronização de
  // histórico (que pode marcar dezenas de conversas antigas como não lidas de uma vez ao
  // conectar) disparava um toast atrás do outro.
  useEffect(() => {
    const total = conversas.reduce((soma, c) => soma + c.naoLidas, 0);
    if (naoLidasAnterior.current !== null && total > naoLidasAnterior.current) {
      const candidatas = [...conversas]
        .filter((c) => c.naoLidas > 0 && c.id !== conversa?.id)
        .sort((a, b) => (b.ultimaMsgEm ?? "").localeCompare(a.ultimaMsgEm ?? ""));
      const comMaisRecente = candidatas[0];
      const recente = comMaisRecente?.ultimaMsgEm && Date.now() - new Date(comMaisRecente.ultimaMsgEm).getTime() < 2 * 60 * 1000;
      if (comMaisRecente && recente) {
        toast.message(`Nova mensagem — ${comMaisRecente.contatoNome ?? formatPhone(comMaisRecente.contatoPhone)}`, {
          description: previewConteudo(comMaisRecente.mensagens?.[0]),
        });
        tocarBeep();
      }
    }
    naoLidasAnterior.current = total;
  }, [conversas, conversa?.id]);

  const painelChat = conversa !== null;

  if (user && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <MessageCircle className="w-16 h-16 text-muted-foreground opacity-30" />
        <div>
          <h2 className="text-xl font-semibold">Acesso restrito</h2>
          <p className="text-muted-foreground mt-1 text-sm">Este módulo está disponível apenas para administradores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden rounded-xl border border-border bg-background shadow-sm -m-4 md:-m-6">
      <PainelInstancias
        instancias={instancias}
        selected={instanciaId}
        onSelect={(id) => { setInstanciaId(id); setConversa(null); }}
      />

      {!conectado ? (
        <TelaConexao instancia={instanciaAtual} />
      ) : (
        <>
          <div className={cn("flex flex-col border-r border-border", painelChat ? "hidden md:flex md:w-80" : "flex flex-1 md:flex-none md:w-80")}>
            <ListaConversas conversas={conversas} selectedId={conversa?.id ?? null} onSelect={setConversa} search={search} onSearchChange={setSearch} />
          </div>
          <div className={cn("flex-1 flex flex-col min-w-0", !painelChat && "hidden md:flex")}>
            <AreaChat conversa={conversa} onBack={() => setConversa(null)} />
          </div>
        </>
      )}
    </div>
  );
}
