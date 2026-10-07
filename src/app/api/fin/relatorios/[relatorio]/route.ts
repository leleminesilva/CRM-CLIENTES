import { NextResponse } from "next/server";
import { getContext } from "@fin/lib/context";
import { formatDate } from "@fin/lib/dates";
import { logger } from "@fin/lib/logger";
import { REPORTS, parseReportFilters, runReport } from "@fin/modules/reports/definitions";
import { toCsv } from "@fin/modules/reports/export/csv";
import { toPdf } from "@fin/modules/reports/export/pdf";
import { toXlsx } from "@fin/modules/reports/export/xlsx";

/** Exportação autenticada: ?formato=csv|xlsx|pdf + os mesmos filtros da tela. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ relatorio: string }> },
) {
  const ctx = await getContext();
  if (!ctx) return new NextResponse("Sessão expirada.", { status: 401 });
  const { relatorio } = await params;
  if (!REPORTS.some((r) => r.id === relatorio))
    return new NextResponse("Relatório não encontrado.", { status: 404 });
  const url = new URL(request.url);
  const format = url.searchParams.get("formato");
  if (format !== "csv" && format !== "xlsx" && format !== "pdf")
    return new NextResponse("Formato inválido.", { status: 400 });
  try {
    const sp = Object.fromEntries(url.searchParams.entries());
    const filters = parseReportFilters(sp, ctx.today);
    const report = await runReport(ctx, relatorio, filters, ctx.today);
    if (!report) return new NextResponse("Relatório não encontrado.", { status: 404 });
    const base = `${relatorio}-${ctx.today}`;
    const headers = (type: string, ext: string) => ({
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${base}.${ext}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (format === "csv")
      return new NextResponse(toCsv(report), {
        headers: headers("text/csv; charset=utf-8", "csv"),
      });
    if (format === "xlsx")
      return new NextResponse(new Uint8Array(await toXlsx(report)), {
        headers: headers(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "xlsx",
        ),
      });
    const filtersText = report.filterable
      ? `${formatDate(filters.from)} a ${formatDate(filters.to)}`
      : "posição de hoje";
    const pdf = await toPdf(report, {
      workspace: ctx.workspace.name,
      generatedAt: formatDate(ctx.today),
      filtersText,
    });
    return new NextResponse(new Uint8Array(pdf), { headers: headers("application/pdf", "pdf") });
  } catch (error) {
    logger.error({ err: error, report: relatorio }, "Falha ao exportar relatório");
    return new NextResponse("Não foi possível gerar o arquivo.", { status: 500 });
  }
}
