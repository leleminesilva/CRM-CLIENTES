import type { Metadata } from "next";
import { MonthSwitcher } from "@fin/components/shared/month-switcher";
import { PageHeader } from "@fin/components/shared/page-header";
import { requirePageContext } from "@fin/lib/context";
import { resolveMonth, type SearchParams } from "@fin/lib/month";
import { CalendarView } from "@fin/modules/calendar/components/calendar-view";
import { calendarEvents, calendarGrid } from "@fin/modules/calendar/queries";

export const metadata: Metadata = { title: "Calendário" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePageContext();
  const { month, currentMonth } = resolveMonth((await searchParams).mes, ctx.today);
  const grid = calendarGrid(month);
  const events = await calendarEvents(ctx, month, ctx.today);
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Calendário"
        description="Recebimentos, contas, faturas, parcelas e assinaturas dia a dia. Toque num dia para ver os detalhes."
        actions={<MonthSwitcher month={month} currentMonth={currentMonth} />}
      />
      <CalendarView
        key={month}
        month={month}
        start={grid.start}
        end={grid.end}
        today={ctx.today}
        events={events}
      />
    </div>
  );
}
