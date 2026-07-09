"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import {
  format, parse, startOfWeek, getDay,
  addDays, addWeeks, subWeeks, addMonths, subMonths,
  isSameDay, isToday, startOfWeek as weekStart,
  eachDayOfInterval, endOfWeek, isPast,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import type { Tarefa } from "@/types";
import { TIPO_TAREFA_LABELS, dataCalendario, dataHoraVencimento } from "@/lib/utils/formatters";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { "pt-BR": ptBR },
});

const TIPO_COLORS: Record<string, string> = {
  REUNIAO:   "#6366f1",
  LIGACAO:   "#8b5cf6",
  VISITA:    "#ec4899",
  FOLLOW_UP: "#f59e0b",
  EMAIL:     "#3b82f6",
  TAREFA:    "#64748b",
};

const PRIORIDADE_LABEL: Record<string, string> = { ALTA: "Alta", MEDIA: "Média", BAIXA: "Baixa" };
const PRIORIDADE_COLOR: Record<string, string> = { ALTA: "text-red-500", MEDIA: "text-amber-500", BAIXA: "text-emerald-500" };

const TIPOS = [
  { value: "REUNIAO",   label: "Reunião" },
  { value: "LIGACAO",   label: "Ligação" },
  { value: "VISITA",    label: "Visita" },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "EMAIL",     label: "E-mail" },
  { value: "TAREFA",    label: "Tarefa" },
];

const PRIORIDADES = [
  { value: "ALTA",  label: "🔴 Alta" },
  { value: "MEDIA", label: "🟡 Média" },
  { value: "BAIXA", label: "🟢 Baixa" },
];

type ViewType = "mes" | "semana" | "dia" | "agenda";

interface AgendaEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Tarefa;
  allDay: boolean;
}

// ── Event card usado nas views Semana e Dia ────────────────────────────────
function EventCard({ event, compact = false }: { event: AgendaEvent; compact?: boolean }) {
  const t = event.resource;
  const concluida = t.status === "CONCLUIDA";
  const color = TIPO_COLORS[t.tipo] || "#6366f1";

  if (compact) {
    return (
      <div
        className={cn("flex items-center gap-1.5 rounded px-2 py-1 text-white text-xs font-medium truncate", concluida && "opacity-50")}
        style={{ backgroundColor: color }}
        title={event.title}
      >
        {concluida && <CheckCircle2 className="w-3 h-3 shrink-0" />}
        {t.horario && <span className="shrink-0 opacity-80">{t.horario}</span>}
        <span className="truncate">{t.titulo}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3 rounded-lg border p-3 bg-card hover:bg-accent/30 transition-colors", concluida && "opacity-60")}>
      <div className="w-1 rounded-full shrink-0 self-stretch" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("font-medium text-sm leading-tight", concluida && "line-through text-muted-foreground")}>
            {t.titulo}
          </p>
          {concluida && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: color }}>
            {TIPO_TAREFA_LABELS[t.tipo] || t.tipo}
          </span>
          <span className={cn("text-xs font-medium", PRIORIDADE_COLOR[t.prioridade])}>
            {PRIORIDADE_LABEL[t.prioridade]}
          </span>
          {t.horario && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Clock className="w-3 h-3" /> {t.horario}
            </span>
          )}
          {t.status === "PENDENTE" && isPast(dataHoraVencimento(t)) && (
            <span className="text-xs text-red-500 font-medium flex items-center gap-0.5">
              <Clock className="w-3 h-3" /> Atrasada
            </span>
          )}
        </div>
        {t.descricao && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{t.descricao}</p>
        )}
      </div>
    </div>
  );
}

export default function AgendaPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewType>("mes");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    tipo: "TAREFA",
    prioridade: "MEDIA",
    dataVencimento: "",
    horario: "",
    descricao: "",
  });

  const { data } = useQuery({
    queryKey: ["tarefas-agenda"],
    queryFn: async () => {
      const { data } = await axios.get("/api/tarefas");
      return data.data as Tarefa[];
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: typeof form) => axios.post("/api/tarefas", payload),
    onSuccess: () => {
      toast.success("Evento adicionado à agenda!");
      queryClient.invalidateQueries({ queryKey: ["tarefas-agenda"] });
      setOpen(false);
      setForm({ titulo: "", tipo: "TAREFA", prioridade: "MEDIA", dataVencimento: "", horario: "", descricao: "" });
    },
    onError: () => toast.error("Erro ao criar evento"),
  });

  const events: AgendaEvent[] = (data || []).map((t) => ({
    id: t.id,
    title: `${TIPO_TAREFA_LABELS[t.tipo] || t.tipo}: ${t.titulo}`,
    start: dataCalendario(t.dataVencimento),
    end: dataCalendario(t.dataVencimento),
    resource: t,
    allDay: true,
  }));

  function eventsForDay(date: Date) {
    return events.filter((e) => isSameDay(e.start, date));
  }

  // ── Navegação ──────────────────────────────────────────────────────────────
  function navPrev() {
    if (view === "mes" || view === "agenda") setCurrentDate((d) => subMonths(d, 1));
    else if (view === "semana") setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => addDays(d, -1));
  }
  function navNext() {
    if (view === "mes" || view === "agenda") setCurrentDate((d) => addMonths(d, 1));
    else if (view === "semana") setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addDays(d, 1));
  }
  function navToday() { setCurrentDate(new Date()); }

  function titleLabel() {
    if (view === "mes" || view === "agenda") return format(currentDate, "MMMM yyyy", { locale: ptBR });
    if (view === "semana") {
      const s = weekStart(currentDate, { weekStartsOn: 1 });
      const e = endOfWeek(s, { weekStartsOn: 1 });
      return `${format(s, "d")} – ${format(e, "d 'de' MMMM", { locale: ptBR })}`;
    }
    return format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR });
  }

  // ── View: Semana ──────────────────────────────────────────────────────────
  function WeekView() {
    const start = weekStart(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end: endOfWeek(start, { weekStartsOn: 1 }) });
    const MAX_VISIBLE = 4;

    return (
      <div className="flex flex-col h-full">
        {/* Cabeçalho dos dias */}
        <div className="grid grid-cols-7 border-b">
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "p-3 text-center border-r last:border-r-0 cursor-pointer hover:bg-accent/40 transition-colors",
                isToday(day) && "bg-indigo-950/40"
              )}
              onClick={() => { setCurrentDate(day); setView("dia"); }}
            >
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {format(day, "EEE", { locale: ptBR })}
              </p>
              <p className={cn(
                "text-lg font-bold mt-0.5",
                isToday(day) ? "text-indigo-400" : "text-foreground"
              )}>
                {format(day, "d")}
              </p>
            </div>
          ))}
        </div>

        {/* Corpo com eventos */}
        <div className="grid grid-cols-7 flex-1 divide-x overflow-hidden">
          {days.map((day) => {
            const dayEvents = eventsForDay(day);
            const visible = dayEvents.slice(0, MAX_VISIBLE);
            const extra = dayEvents.length - MAX_VISIBLE;
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "p-2 flex flex-col gap-1 overflow-hidden min-h-0",
                  isToday(day) && "bg-indigo-950/20"
                )}
              >
                {visible.map((ev) => <EventCard key={ev.id} event={ev} compact />)}
                {extra > 0 && (
                  <button
                    className="text-xs text-indigo-400 font-medium hover:underline text-left"
                    onClick={() => { setCurrentDate(day); setView("dia"); }}
                  >
                    +{extra} mais
                  </button>
                )}
                {dayEvents.length === 0 && (
                  <p className="text-xs text-muted-foreground/40 text-center mt-2">—</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── View: Dia ─────────────────────────────────────────────────────────────
  function DayView() {
    const dayEvents = eventsForDay(currentDate);
    const pendentes = dayEvents.filter((e) => e.resource.status !== "CONCLUIDA");
    const concluidas = dayEvents.filter((e) => e.resource.status === "CONCLUIDA");

    return (
      <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
        {dayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground py-20 gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 opacity-40" />
            </div>
            <p className="text-sm">Nenhuma tarefa para este dia</p>
            <Button size="sm" variant="outline" onClick={() => {
              setForm((f) => ({ ...f, dataVencimento: format(currentDate, "yyyy-MM-dd") }));
              setOpen(true);
            }}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar tarefa
            </Button>
          </div>
        ) : (
          <>
            {pendentes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Pendentes ({pendentes.length})
                </p>
                {pendentes.map((ev) => <EventCard key={ev.id} event={ev} />)}
              </div>
            )}
            {concluidas.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Concluídas ({concluidas.length})
                </p>
                {concluidas.map((ev) => <EventCard key={ev.id} event={ev} />)}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── View: Agenda (lista cronológica) ──────────────────────────────────────
  function AgendaListView() {
    const start = weekStart(currentDate, { weekStartsOn: 1 });
    const end = addDays(start, 89); // ~3 meses à frente
    const days = eachDayOfInterval({ start: currentDate, end })
      .filter((d) => eventsForDay(d).length > 0);

    if (days.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground py-20">
          <p className="text-sm">Nenhum evento nos próximos 3 meses</p>
        </div>
      );
    }

    return (
      <div className="overflow-y-auto flex-1 p-4 space-y-6">
        {days.map((day) => (
          <div key={day.toISOString()}>
            <div className="flex items-center gap-3 mb-2">
              <div className={cn(
                "flex flex-col items-center justify-center w-10 h-10 rounded-lg text-center",
                isToday(day) ? "bg-indigo-600 text-white" : "bg-muted text-foreground"
              )}>
                <span className="text-xs font-medium leading-none">{format(day, "EEE", { locale: ptBR }).toUpperCase()}</span>
                <span className="text-lg font-bold leading-tight">{format(day, "d")}</span>
              </div>
              <div>
                <p className="text-sm font-semibold capitalize">
                  {format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
                <p className="text-xs text-muted-foreground">{eventsForDay(day).length} tarefa(s)</p>
              </div>
            </div>
            <div className="ml-13 space-y-2 pl-4 border-l-2 border-muted">
              {eventsForDay(day).map((ev) => <EventCard key={ev.id} event={ev} />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const eventStyleGetter = (event: AgendaEvent) => ({
    style: {
      backgroundColor: TIPO_COLORS[event.resource.tipo] || "#6366f1",
      borderRadius: "6px",
      border: "none",
      fontSize: "12px",
      padding: "2px 6px",
      color: "#fff",
      opacity: event.resource.status === "CONCLUIDA" ? 0.55 : 1,
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo || !form.dataVencimento) return toast.error("Preencha título e data");
    mutation.mutate(form);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold">Agenda</h2>
          <p className="text-muted-foreground">Visualização de tarefas e compromissos</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Plus className="w-4 h-4" /> Novo Evento
        </Button>
      </div>

      {/* Legenda */}
      <div className="flex gap-3 flex-wrap shrink-0">
        {Object.entries(TIPO_TAREFA_LABELS).map(([tipo, label]) => (
          <div key={tipo} className="flex items-center gap-1.5 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TIPO_COLORS[tipo] || "#6366f1" }} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendário */}
      <div className="bg-card border rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={navToday}>Hoje</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navPrev}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <p className="font-semibold text-sm capitalize">{titleLabel()}</p>

          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            {(["mes", "semana", "dia", "agenda"] as ViewType[]).map((v) => (
              <Button
                key={v}
                size="sm"
                variant={view === v ? "default" : "ghost"}
                className={cn("h-7 px-3 text-xs capitalize", view === v && "bg-background shadow-sm")}
                onClick={() => setView(v)}
              >
                {v === "mes" ? "Mês" : v === "semana" ? "Semana" : v === "dia" ? "Dia" : "Agenda"}
              </Button>
            ))}
          </div>
        </div>

        {/* Conteúdo da view */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {view === "mes" && (
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: "100%", padding: "16px" }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              eventPropGetter={eventStyleGetter as any}
              date={currentDate}
              view="month"
              onNavigate={setCurrentDate}
              onView={() => {}}
              toolbar={false}
              messages={{
                next: "Próximo", previous: "Anterior", today: "Hoje",
                month: "Mês", week: "Semana", day: "Dia", agenda: "Agenda",
                date: "Data", time: "Hora", event: "Evento",
                noEventsInRange: "Nenhuma tarefa neste período",
                allDay: "Dia inteiro",
              }}
              culture="pt-BR"
              onSelectSlot={(s: { start: Date }) => {
                setForm((f) => ({ ...f, dataVencimento: format(s.start, "yyyy-MM-dd") }));
                setOpen(true);
              }}
              selectable
            />
          )}

          {view === "semana" && <WeekView />}
          {view === "dia" && <DayView />}
          {view === "agenda" && <AgendaListView />}
        </div>
      </div>

      {/* Dialog — novo evento */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Evento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                placeholder="Ex: Reunião com cliente"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => setForm((f) => ({ ...f, prioridade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={form.dataVencimento}
                  onChange={(e) => setForm((f) => ({ ...f, dataVencimento: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Horário</Label>
                <Input
                  type="time"
                  value={form.horario}
                  onChange={(e) => setForm((f) => ({ ...f, horario: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                placeholder="Detalhes do evento..."
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : "Salvar Evento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
