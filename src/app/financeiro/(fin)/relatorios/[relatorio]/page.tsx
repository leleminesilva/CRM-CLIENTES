import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@fin/components/shared/page-header";
import { Button } from "@fin/components/ui/button";
import { requirePageContext } from "@fin/lib/context";
import type { SearchParams } from "@fin/lib/month";
import { loadFormOptions } from "@fin/modules/transactions/queries";
import { ReportFilterBar } from "@fin/modules/reports/components/report-filters";
import { ReportView } from "@fin/modules/reports/components/report-view";
import { REPORTS, parseReportFilters, runReport } from "@fin/modules/reports/definitions";

export const metadata: Metadata = { title: "Relatório" };

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ relatorio: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePageContext();
  const { relatorio } = await params;
  if (!REPORTS.some((r) => r.id === relatorio)) notFound();
  const filters = parseReportFilters(await searchParams, ctx.today);
  const [report, options] = await Promise.all([
    runReport(ctx, relatorio, filters, ctx.today),
    loadFormOptions(ctx),
  ]);
  if (!report) notFound();
  const kind =
    relatorio === "comparacao-meses"
      ? "months"
      : relatorio === "comparacao-anos"
        ? "years"
        : report.filterable
          ? "range"
          : "none";

  return (
    <div className="grid gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2.5">
          <Link href="/financeiro/relatorios">
            <ChevronLeftIcon /> Relatórios
          </Link>
        </Button>
        <PageHeader title={report.title} description={report.description} />
      </div>
      <ReportFilterBar filters={filters} options={options} kind={kind} />
      <ReportView report={report} />
    </div>
  );
}
