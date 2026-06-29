"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageCircle, Plus, Trash2, Phone, Send,
  Loader2, Settings, ChevronLeft, Check, CheckCheck,
  Search, Smartphone,
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

// ── Types ──────────────────────────────────────────────────────────────────

interface Instancia {
  id: string;
  nome: string;
  phoneNumberId: string;
  phoneNumber?: string;
  ativo: boolean;
  _count?: { conversas: number };
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
  if (status === "lida") return <CheckCheck className="w-3.5 h-3.5 text-blue-400" />;
  if (status === "entregue") return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />;
  return <Check className="w-3.5 h-3.5 text-muted-foreground" />;
}

// ── Modal de nova instância ────────────────────────────────────────────────

function ModalInstancia({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!nome || !phoneNumberId || !accessToken) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setLoading(true);
    try {
      await axios.post("/api/whatsapp/instancias", { nome, phoneNumberId, accessToken, phoneNumber });
      toast.success("Número conectado com sucesso!");
      onSaved();
      onClose();
      setNome(""); setPhoneNumberId(""); setAccessToken(""); setPhoneNumber("");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-green-500" />
            Conectar número WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Você precisará dos dados do seu App no{" "}
            <span className="font-medium text-foreground">Meta for Developers</span>{" "}
            (developers.facebook.com).
          </p>

          <div className="space-y-2">
            <Label>Nome do número <span className="text-red-500">*</span></Label>
            <Input placeholder="Ex: Comercial, Suporte..." value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Phone Number ID <span className="text-red-500">*</span></Label>
            <Input placeholder="ID do número no Meta" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
            <p className="text-xs text-muted-foreground">WhatsApp → Phone Numbers → ID</p>
          </div>
          <div className="space-y-2">
            <Label>Access Token <span className="text-red-500">*</span></Label>
            <Input placeholder="Token permanente do App" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
            <p className="text-xs text-muted-foreground">System User Access Token (não expira)</p>
          </div>
          <div className="space-y-2">
            <Label>Número de telefone</Label>
            <Input placeholder="+55 11 99999-9999" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Conectar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Painel de instâncias ───────────────────────────────────────────────────

function PainelInstancias({
  instancias,
  selected,
  onSelect,
  onAdd,
  isAdmin,
}: {
  instancias: Instancia[];
  selected: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  isAdmin: boolean;
}) {
  return (
    <div className="w-16 md:w-20 flex flex-col bg-sidebar border-r border-border shrink-0">
      <div className="h-14 flex items-center justify-center border-b border-border">
        <MessageCircle className="w-6 h-6 text-green-500" />
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
                selected === inst.id
                  ? "bg-green-600 text-white shadow-lg scale-105"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              {getInitials(inst.nome)}
              {inst.ativo && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
              )}
            </button>
          ))}
        </div>
      </ScrollArea>
      {isAdmin && (
        <div className="p-2 border-t border-border flex flex-col items-center gap-1">
          <Button size="icon" variant="ghost" className="w-10 h-10 rounded-xl" onClick={onAdd} title="Adicionar número">
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
  instancia,
  selectedId,
  onSelect,
  search,
  onSearchChange,
}: {
  conversas: Conversa[];
  instancia: Instancia | undefined;
  selectedId: string | null;
  onSelect: (c: Conversa) => void;
  search: string;
  onSearchChange: (v: string) => void;
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
      <div className="h-14 flex items-center px-4 border-b border-border gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{instancia?.nome ?? "Selecione um número"}</p>
          {instancia?.phoneNumber && (
            <p className="text-xs text-muted-foreground">{formatPhone(instancia.phoneNumber)}</p>
          )}
        </div>
      </div>

      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
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
                      <span className={cn("text-sm truncate", c.naoLidas > 0 && "font-semibold")}>
                        {c.contatoNome ?? formatPhone(c.contatoPhone)}
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

function AreaChat({
  conversa,
  onBack,
}: {
  conversa: Conversa | null;
  onBack: () => void;
}) {
  const [texto, setTexto] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["wa-mensagens", conversa?.id],
    queryFn: async () => {
      const { data } = await axios.get(`/api/whatsapp/conversas/${conversa!.id}`);
      return data as { mensagens: Mensagem[] };
    },
    enabled: !!conversa?.id,
    refetchInterval: 4000,
  });

  const enviar = useMutation({
    mutationFn: async (mensagem: string) => {
      const { data } = await axios.post("/api/whatsapp/enviar", {
        conversaId: conversa!.id,
        mensagem,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-mensagens", conversa?.id] });
      queryClient.invalidateQueries({ queryKey: ["wa-conversas"] });
      setTexto("");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Erro ao enviar mensagem");
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.mensagens]);

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
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-border bg-card shrink-0">
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
      <ScrollArea className="flex-1 px-4 py-4" style={{ backgroundImage: "radial-gradient(circle, hsl(var(--muted)/0.3) 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
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
                            ? "bg-green-600 text-white rounded-tr-sm"
                            : "bg-card text-foreground rounded-tl-sm border border-border"
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
                        <div className={cn(
                          "flex items-center gap-1 mt-1",
                          msg.direcao === "saida" ? "justify-end" : "justify-start"
                        )}>
                          <span className={cn(
                            "text-[10px]",
                            msg.direcao === "saida" ? "text-green-200" : "text-muted-foreground"
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
      <div className="p-3 border-t border-border bg-card shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem... (Enter para enviar)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all min-h-[42px] max-h-32"
            style={{ scrollbarWidth: "none" }}
          />
          <Button
            size="icon"
            disabled={!texto.trim() || enviar.isPending}
            onClick={() => texto.trim() && enviar.mutate(texto.trim())}
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
  );
}

// ── Painel de configurações ────────────────────────────────────────────────

function PainelConfig({
  instancias,
  onDelete,
  onAdd,
  isAdmin,
}: {
  instancias: Instancia[];
  onDelete: (id: string) => void;
  onAdd: () => void;
  isAdmin: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col p-6 gap-6 overflow-auto">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Números conectados
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os números WhatsApp Business conectados ao CRM.
        </p>
      </div>

      <div className="space-y-3 max-w-xl">
        {instancias.map((inst) => (
          <div key={inst.id} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center text-sm font-bold">
              {getInitials(inst.nome)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{inst.nome}</p>
              <p className="text-xs text-muted-foreground truncate">
                {inst.phoneNumber ? formatPhone(inst.phoneNumber) : `ID: ${inst.phoneNumberId}`}
              </p>
              <p className="text-xs text-muted-foreground">{inst._count?.conversas ?? 0} conversa(s)</p>
            </div>
            <Badge variant={inst.ativo ? "default" : "secondary"} className={inst.ativo ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : ""}>
              {inst.ativo ? "Ativo" : "Inativo"}
            </Badge>
            {isAdmin && (
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 w-8 h-8"
                onClick={() => onDelete(inst.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}

        {isAdmin && (
          <Button variant="outline" className="w-full" onClick={onAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Conectar novo número
          </Button>
        )}
      </div>

      <div className="max-w-xl rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/10 p-4">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-400 mb-2">Como configurar o Webhook na Meta</p>
        <ol className="text-xs text-amber-700 dark:text-amber-500 space-y-1 list-decimal list-inside">
          <li>Acesse developers.facebook.com → seu App → WhatsApp → Configuração</li>
          <li>Em &quot;Webhooks&quot;, clique em &quot;Editar&quot;</li>
          <li>
            URL do callback:{" "}
            <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded font-mono">
              https://seu-dominio.vercel.app/api/whatsapp/webhook
            </code>
          </li>
          <li>Token de verificação: o valor de <code className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 rounded">WHATSAPP_WEBHOOK_TOKEN</code> no .env</li>
          <li>Inscreva-se em: <strong>messages</strong></li>
        </ol>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

function WhatsAppContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const phoneParam = useMemo(() => searchParams.get("phone"), [searchParams]);
  const isAdmin = user?.role === "ADMINISTRADOR";

  const [instanciaId, setInstanciaId] = useState<string | null>(null);
  const [conversa, setConversa] = useState<Conversa | null>(null);
  const [searchConversa, setSearchConversa] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [painelConfig, setPainelConfig] = useState(false);
  const queryClient = useQueryClient();

  const { data: instancias = [] } = useQuery({
    queryKey: ["wa-instancias"],
    queryFn: async () => {
      const { data } = await axios.get("/api/whatsapp/instancias");
      return data as Instancia[];
    },
  });

  const { data: conversas = [] } = useQuery({
    queryKey: ["wa-conversas", instanciaId],
    queryFn: async () => {
      const params = instanciaId ? `?instanciaId=${instanciaId}` : "";
      const { data } = await axios.get(`/api/whatsapp/conversas${params}`);
      return data as Conversa[];
    },
    enabled: !!instanciaId,
    refetchInterval: 5000,
  });

  // Busca todas conversas quando vem via ?phone= para encontrar em qualquer instância
  const { data: todasConversas = [] } = useQuery({
    queryKey: ["wa-conversas-todas"],
    queryFn: async () => {
      const { data } = await axios.get("/api/whatsapp/conversas");
      return data as Conversa[];
    },
    enabled: !!phoneParam,
  });

  useEffect(() => {
    if (instancias.length > 0 && !instanciaId) {
      setInstanciaId(instancias[0].id);
    }
  }, [instancias, instanciaId]);

  // Auto-abre conversa quando vem de /clientes via ?phone=
  useEffect(() => {
    if (!phoneParam || todasConversas.length === 0) return;
    const tail = phoneParam.slice(-9);
    const match = todasConversas.find((c) =>
      c.contatoPhone.replace(/\D/g, "").endsWith(tail)
    );
    if (match) {
      setInstanciaId(match.instanciaId);
      setConversa(match);
      setPainelConfig(false);
    }
  }, [phoneParam, todasConversas]);

  const deletarInstancia = useCallback(async (id: string) => {
    if (!confirm("Deseja remover este número? Todas as conversas serão excluídas.")) return;
    try {
      await axios.delete(`/api/whatsapp/instancias/${id}`);
      queryClient.invalidateQueries({ queryKey: ["wa-instancias"] });
      if (instanciaId === id) setInstanciaId(null);
      toast.success("Número removido");
    } catch {
      toast.error("Erro ao remover número");
    }
  }, [instanciaId, queryClient]);

  const instanciaAtual = instancias.find((i) => i.id === instanciaId);
  const painelChat = conversa !== null;

  if (user && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <MessageCircle className="w-16 h-16 text-muted-foreground opacity-30" />
        <div>
          <h2 className="text-xl font-semibold">Acesso restrito</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            O módulo WhatsApp está disponível apenas para administradores.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden rounded-xl border border-border bg-background shadow-sm -m-4 md:-m-6">
      {/* Painel de instâncias */}
      <PainelInstancias
        instancias={instancias}
        selected={instanciaId}
        onSelect={(id) => { setInstanciaId(id); setConversa(null); setPainelConfig(false); }}
        onAdd={() => setModalAberto(true)}
        isAdmin={isAdmin}
      />

      {/* Se não há instâncias, mostra onboarding */}
      {instancias.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="w-20 h-20 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <MessageCircle className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Conecte seu WhatsApp Business</h2>
            <p className="text-muted-foreground mt-2 max-w-sm">
              Adicione os números WhatsApp Business da sua empresa para visualizar e responder mensagens diretamente pelo CRM.
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setModalAberto(true)} className="bg-green-600 hover:bg-green-700 text-white gap-2">
              <Plus className="w-4 h-4" />
              Conectar primeiro número
            </Button>
          )}
        </div>
      ) : painelConfig ? (
        <PainelConfig
          instancias={instancias}
          onDelete={deletarInstancia}
          onAdd={() => setModalAberto(true)}
          isAdmin={isAdmin}
        />
      ) : (
        <>
          {/* Lista de conversas — esconde no mobile quando chat está aberto */}
          <div className={cn("flex flex-col border-r border-border", painelChat ? "hidden md:flex md:w-80" : "flex flex-1 md:flex-none md:w-80")}>
            <ListaConversas
              conversas={conversas}
              instancia={instanciaAtual}
              selectedId={conversa?.id ?? null}
              onSelect={(c) => setConversa(c)}
              search={searchConversa}
              onSearchChange={setSearchConversa}
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

      {/* Botão de configurações */}
      {instancias.length > 0 && isAdmin && (
        <button
          onClick={() => { setPainelConfig(!painelConfig); setConversa(null); }}
          className={cn(
            "absolute top-4 right-4 p-2 rounded-lg transition-colors",
            painelConfig ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
          title="Configurações"
        >
          <Settings className="w-4 h-4" />
        </button>
      )}

      <ModalInstancia
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["wa-instancias"] })}
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
