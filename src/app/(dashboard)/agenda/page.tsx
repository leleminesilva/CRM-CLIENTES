"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Tarefa } from "@/types";
import { TIPO_TAREFA_LABELS } from "@/lib/utils/formatters";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { "pt-BR": ptBR },
});

const TIPO_COLORS: Record<string, string> = {
  REUNIAO:  "#6366f1",
  LIGACAO:  "#8b5cf6",
  VISITA:   "#ec4899",
  FOLLOW_UP:"#f59e0b",
  EMAIL:    "#3b82f6",
  TAREFA:   "#64748b",
};

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

export default function AgendaPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    tipo: "TAREFA",
    prioridade: "MEDIA",
    dataVencimento: "",
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
      setForm({ titulo: "", tipo: "TAREFA", prioridade: "MEDIA", dataVencimento: "", descricao: "" });
    },
    onError: () => toast.error("Erro ao criar evento"),
  });

  const events = (data || []).map((t) => ({
    id: t.id,
    title: `${TIPO_TAREFA_LABELS[t.tipo] || t.tipo}: ${t.titulo}`,
    start: new Date(t.dataVencimento),
    end: new Date(t.dataVencimento),
    resource: t,
    allDay: true,
  }));

  const eventStyleGetter = (event: { resource: Tarefa }) => ({
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
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Agenda</h2>
          <p className="text-muted-foreground">Visualização de tarefas e compromissos</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Plus className="w-4 h-4" /> Novo Evento
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        {Object.entries(TIPO_TAREFA_LABELS).map(([tipo, label]) => (
          <div key={tipo} className="flex items-center gap-1.5 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TIPO_COLORS[tipo] || "#6366f1" }} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-xl overflow-hidden" style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "100%", padding: "16px" }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eventPropGetter={eventStyleGetter as any}
          messages={{
            next: "Próximo",
            previous: "Anterior",
            today: "Hoje",
            month: "Mês",
            week: "Semana",
            day: "Dia",
            agenda: "Agenda",
            date: "Data",
            time: "Hora",
            event: "Evento",
            noEventsInRange: "Nenhuma tarefa neste período",
            allDay: "Dia inteiro",
          }}
          culture="pt-BR"
        />
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
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={v => setForm(f => ({ ...f, prioridade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input
                type="date"
                value={form.dataVencimento}
                onChange={e => setForm(f => ({ ...f, dataVencimento: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                placeholder="Detalhes do evento..."
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
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
