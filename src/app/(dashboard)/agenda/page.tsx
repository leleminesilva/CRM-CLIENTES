"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
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
  REUNIAO: "#6366f1",
  LIGACAO: "#8b5cf6",
  VISITA: "#ec4899",
  FOLLOW_UP: "#f59e0b",
  EMAIL: "#3b82f6",
  TAREFA: "#64748b",
};

export default function AgendaPage() {
  const { data } = useQuery({
    queryKey: ["tarefas-agenda"],
    queryFn: async () => {
      const { data } = await axios.get("/api/tarefas");
      return data.data as Tarefa[];
    },
  });

  const tarefas = data || [];

  const events = tarefas.map((t) => ({
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
      opacity: event.resource.status === "CONCLUIDA" ? 0.6 : 1,
    },
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">Agenda</h2>
        <p className="text-muted-foreground">Visualização de tarefas e compromissos</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        {Object.entries(TIPO_TAREFA_LABELS).map(([tipo, label]) => (
          <div key={tipo} className="flex items-center gap-1.5 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TIPO_COLORS[tipo] || "#6366f1" }} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-xl overflow-hidden" style={{ height: "calc(100vh - 260px)", minHeight: "500px" }}>
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
    </div>
  );
}
