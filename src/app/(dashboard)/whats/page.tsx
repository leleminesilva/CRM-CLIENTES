"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageCircle, Phone, Send, Loader2, ChevronLeft, Check, CheckCheck,
  Search, QrCode, AlertTriangle,
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

interface Instancia {
  id: string;
  nome: string;
  statusConexao: string;
  qrCode?: string | null;
  phoneNumber?: string | null;
}

interface Mensagem {
  id: string;
  direcao: "entrada" | "saida";
  tipo: string;
  conteudo: string;
  status: string;
  enviadaEm: string;
}

interface Conversa {
  id: string;
  instanciaId: string;
  contatoPhone: string;
  contatoNome?: string;
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

function formatTime(date: string) {
  const d = new Date(date);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM/yy", { locale: ptBR });
}

function getInitials(name?: string, phone?: string) {
  if (name) return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (phone ?? "?").slice(-2);
}

function StatusIcon({ status }: { status: string }) {
  if (status === "erro") return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
  if (status === "lida") return <CheckCheck className="w-3.5 h-3.5 text-blue-400" />;
  if (status === "enviada") return <Check className="w-3.5 h-3.5 text-muted-foreground" />;
  return <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />;
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
          {instancias.map((inst) => (
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
                  inst.statusConexao === "conectado" ? "bg-green-500" : "bg-amber-500"
                )}
              />
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Tela de conexão (aguardando bridge / QR code) ──────────────────────────

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
                      <span className={cn("text-sm truncate", c.naoLidas > 0 && "font-semibold")}>
                        {c.contatoNome ?? formatPhone(c.contatoPhone)}
                      </span>
                      {c.ultimaMsgEm && <span className="text-xs text-muted-foreground shrink-0">{formatTime(c.ultimaMsgEm)}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <span className="text-xs text-muted-foreground truncate">
                        {lastMsg ? (lastMsg.direcao === "saida" ? `Você: ${lastMsg.conteudo}` : lastMsg.conteudo) : formatPhone(c.contatoPhone)}
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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [data?.mensagens]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (texto.trim()) enviar.mutate(texto.trim());
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
                        <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
                        <div className={cn("flex items-center gap-1 mt-1", msg.direcao === "saida" ? "justify-end" : "justify-start")}>
                          <span className={cn("text-[10px]", msg.direcao === "saida" ? "text-red-200" : "text-muted-foreground")}>{formatTime(msg.enviadaEm)}</span>
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
  const conectado = instanciaAtual?.statusConexao === "conectado";

  const { data: conversas = [] } = useQuery({
    queryKey: ["whats-conversas", instanciaAtual?.id],
    queryFn: async () => {
      const { data } = await axios.get(`/api/whatsapp/conversas?instanciaId=${instanciaAtual!.id}`);
      return data as Conversa[];
    },
    enabled: !!instanciaAtual?.id && conectado,
    refetchInterval: POLL_CONVERSAS_MS,
  });

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
