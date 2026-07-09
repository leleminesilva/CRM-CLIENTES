"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Hash, Send, Loader2, Search, Plus, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const POLL_RESUMO_MS = 5000;
const POLL_MENSAGENS_MS = 3000;

interface Usuario {
  id: string;
  nome: string;
  avatar?: string | null;
}

interface Mensagem {
  id: string;
  conteudo: string;
  autorId: string;
  destinatarioId?: string | null;
  lida: boolean;
  createdAt: string;
  autor: Usuario;
}

interface Conversa {
  usuario: Usuario;
  naoLidas: number;
  ultimaMensagem: { conteudo: string; autorId: string; createdAt: string };
}

interface Resumo {
  naoLidasGeral: number;
  totalNaoLidas: number;
  conversas: Conversa[];
}

function getInitials(nome: string) {
  return nome.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function formatListTime(date: string) {
  const d = new Date(date);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM/yy", { locale: ptBR });
}

function formatMsgTime(date: string) {
  return format(new Date(date), "HH:mm");
}

function labelDate(d: string) {
  const date = new Date(d);
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

// ── Novo DM ──────────────────────────────────────────────────────────────

function NovoDmDialog({ open, onClose, onSelect, excluirId }: { open: boolean; onClose: () => void; onSelect: (u: Usuario) => void; excluirId?: string }) {
  const [busca, setBusca] = useState("");
  const { data: usuarios = [] } = useQuery({
    queryKey: ["chat-usuarios-ativos"],
    queryFn: async () => {
      const { data } = await axios.get("/api/usuarios/ativos");
      return data.data as Usuario[];
    },
    enabled: open,
  });

  const filtrados = usuarios.filter((u) => u.id !== excluirId && u.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8 h-9 text-sm" placeholder="Buscar funcionário..." value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
        </div>
        <ScrollArea className="max-h-72">
          <div className="space-y-1">
            {filtrados.map((u) => (
              <button
                key={u.id}
                onClick={() => onSelect(u)}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0">
                  {getInitials(u.nome)}
                </div>
                <span className="text-sm font-medium">{u.nome}</span>
              </button>
            ))}
            {filtrados.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum funcionário encontrado</p>}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ── Lista lateral ────────────────────────────────────────────────────────

function ListaConversas({
  resumo, selecionado, onSelectGeral, onSelectDm, onNovoDm,
}: {
  resumo: Resumo | undefined; selecionado: { tipo: "geral" } | { tipo: "dm"; usuario: Usuario } | null;
  onSelectGeral: () => void; onSelectDm: (u: Usuario) => void; onNovoDm: () => void;
}) {
  return (
    <div className="w-full md:w-72 flex flex-col border-r border-border shrink-0">
      <div className="h-14 flex items-center justify-between px-4 border-b border-border">
        <p className="font-semibold text-sm">Chat da Equipe</p>
        <button onClick={onNovoDm} title="Nova conversa" className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          <button
            onClick={onSelectGeral}
            className={cn(
              "w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg hover:bg-accent transition-colors text-left",
              selecionado?.tipo === "geral" && "bg-accent"
            )}
          >
            <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Hash className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Geral</p>
              <p className="text-xs text-muted-foreground">Canal de toda a equipe</p>
            </div>
            {!!resumo?.naoLidasGeral && (
              <Badge className="bg-indigo-600 text-white h-5 min-w-[20px] shrink-0 text-xs px-1.5">{resumo.naoLidasGeral}</Badge>
            )}
          </button>
        </div>

        <div className="px-4 pb-1 pt-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Conversas</p>
        </div>
        <div className="px-2 pb-2 space-y-0.5">
          {(resumo?.conversas ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground px-2.5 py-4 text-center">Nenhuma conversa ainda — clique em + pra começar</p>
          )}
          {(resumo?.conversas ?? []).map((c) => (
            <button
              key={c.usuario.id}
              onClick={() => onSelectDm(c.usuario)}
              className={cn(
                "w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg hover:bg-accent transition-colors text-left",
                selecionado?.tipo === "dm" && selecionado.usuario.id === c.usuario.id && "bg-accent"
              )}
            >
              <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0">
                {getInitials(c.usuario.nome)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className={cn("text-sm truncate", c.naoLidas > 0 && "font-semibold")}>{c.usuario.nome}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{formatListTime(c.ultimaMensagem.createdAt)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{c.ultimaMensagem.conteudo}</p>
              </div>
              {c.naoLidas > 0 && <Badge className="bg-indigo-600 text-white h-5 min-w-[20px] shrink-0 text-xs px-1.5">{c.naoLidas}</Badge>}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Área de mensagens ────────────────────────────────────────────────────

function AreaMensagens({ selecionado }: { selecionado: { tipo: "geral" } | { tipo: "dm"; usuario: Usuario } | null }) {
  const { user } = useAuth();
  const [texto, setTexto] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const queryKey = selecionado?.tipo === "dm" ? ["chat-mensagens", "dm", selecionado.usuario.id] : ["chat-mensagens", "geral"];
  const url = selecionado?.tipo === "dm" ? `/api/chat/dm/${selecionado.usuario.id}` : "/api/chat/geral";

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await axios.get(url);
      return data.data as Mensagem[];
    },
    enabled: !!selecionado,
    refetchInterval: POLL_MENSAGENS_MS,
  });

  const enviar = useMutation({
    mutationFn: async (conteudo: string) => {
      const { data } = await axios.post(url, { conteudo });
      return data.data as Mensagem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["chat-resumo"] });
      setTexto("");
    },
    onError: () => toast.error("Erro ao enviar mensagem"),
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [data]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (texto.trim()) enviar.mutate(texto.trim());
    }
  }

  if (!selecionado) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
        <MessageSquare className="w-16 h-16 opacity-20" />
        <div className="text-center">
          <p className="font-medium">Selecione o canal Geral ou uma conversa</p>
          <p className="text-sm mt-1">Ou clique em + pra falar com alguém da equipe</p>
        </div>
      </div>
    );
  }

  const mensagens = data ?? [];
  const groups: { date: string; msgs: Mensagem[] }[] = [];
  for (const msg of mensagens) {
    const d = format(new Date(msg.createdAt), "yyyy-MM-dd");
    const last = groups[groups.length - 1];
    if (last?.date === d) last.msgs.push(msg);
    else groups.push({ date: d, msgs: [msg] });
  }

  const titulo = selecionado.tipo === "geral" ? "Geral" : selecionado.usuario.nome;
  const subtitulo = selecionado.tipo === "geral" ? "Canal de toda a equipe" : undefined;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="h-14 flex items-center gap-3 px-4 border-b border-border bg-card shrink-0">
        <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", selecionado.tipo === "geral" ? "bg-indigo-600 text-white" : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-bold")}>
          {selecionado.tipo === "geral" ? <Hash className="w-4 h-4" /> : getInitials(selecionado.usuario.nome)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{titulo}</p>
          {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : mensagens.length === 0 ? (
          <div className="flex justify-center py-8 text-muted-foreground text-sm">Nenhuma mensagem ainda — diga oi 👋</div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.date}>
                <div className="flex justify-center mb-3">
                  <span className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">{labelDate(g.date)}</span>
                </div>
                <div className="space-y-1.5">
                  {g.msgs.map((msg) => {
                    const minha = msg.autorId === user?.id;
                    return (
                      <div key={msg.id} className={cn("flex gap-2", minha ? "justify-end" : "justify-start")}>
                        {!minha && selecionado.tipo === "geral" && (
                          <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-auto">
                            {getInitials(msg.autor.nome)}
                          </div>
                        )}
                        <div className={cn("max-w-[70%] rounded-2xl px-3.5 py-2 text-sm shadow-sm", minha ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-card text-foreground rounded-tl-sm border border-border")}>
                          {!minha && selecionado.tipo === "geral" && (
                            <p className="text-xs font-semibold mb-0.5 text-indigo-500">{msg.autor.nome}</p>
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
                          <div className={cn("flex items-center gap-1 mt-1", minha ? "justify-end" : "justify-start")}>
                            <span className={cn("text-[10px]", minha ? "text-indigo-200" : "text-muted-foreground")}>{formatMsgTime(msg.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
            className="flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all min-h-[42px] max-h-32"
            style={{ scrollbarWidth: "none" }}
          />
          <button
            disabled={!texto.trim() || enviar.isPending}
            onClick={() => texto.trim() && enviar.mutate(texto.trim())}
            className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shrink-0 flex items-center justify-center"
          >
            {enviar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────

export default function ChatPage() {
  const { user } = useAuth();
  const [selecionado, setSelecionado] = useState<{ tipo: "geral" } | { tipo: "dm"; usuario: Usuario } | null>({ tipo: "geral" });
  const [novoDmAberto, setNovoDmAberto] = useState(false);
  const [painelMobileAberto, setPainelMobileAberto] = useState(true);

  const { data: resumo } = useQuery({
    queryKey: ["chat-resumo"],
    queryFn: async () => {
      const { data } = await axios.get("/api/chat/conversas");
      return data as Resumo;
    },
    refetchInterval: POLL_RESUMO_MS,
    refetchIntervalInBackground: true,
  });

  return (
    <div className="h-full flex overflow-hidden rounded-xl border border-border bg-background shadow-sm -m-4 md:-m-6">
      <div className={cn("flex-col border-r border-border", painelMobileAberto ? "flex flex-1 md:flex-none" : "hidden md:flex")}>
        <ListaConversas
          resumo={resumo}
          selecionado={selecionado}
          onSelectGeral={() => { setSelecionado({ tipo: "geral" }); setPainelMobileAberto(false); }}
          onSelectDm={(u) => { setSelecionado({ tipo: "dm", usuario: u }); setPainelMobileAberto(false); }}
          onNovoDm={() => setNovoDmAberto(true)}
        />
      </div>
      <div className={cn("flex-1 flex-col min-w-0", !painelMobileAberto ? "flex" : "hidden md:flex")}>
        <AreaMensagens selecionado={selecionado} />
      </div>

      <NovoDmDialog
        open={novoDmAberto}
        onClose={() => setNovoDmAberto(false)}
        excluirId={user?.id}
        onSelect={(u) => {
          setSelecionado({ tipo: "dm", usuario: u });
          setNovoDmAberto(false);
          setPainelMobileAberto(false);
        }}
      />
    </div>
  );
}
