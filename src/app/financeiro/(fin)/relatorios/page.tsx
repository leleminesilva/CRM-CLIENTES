import { ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@fin/components/shared/page-header";
import { Panel } from "@fin/components/shared/panel";
import { REPORTS } from "@fin/modules/reports/definitions";

export const metadata: Metadata = { title: "Relatórios" };

const GROUPS = ["Receitas e despesas", "Cartões e dívidas", "Comparações", "Patrimônio"] as const;

export default function ReportsPage() {
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Relatórios"
        description="Escolha o relatório, filtre o período e exporte em CSV, Excel ou PDF."
      />
      {GROUPS.map((g) => (
        <section key={g} className="grid gap-3">
          <h2 className="title-section">{g}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {REPORTS.filter((r) => r.group === g).map((r) => (
              <Link
                key={r.id}
                href={`/financeiro/relatorios/${r.id}`}
                className="group block rounded-card focus-visible:outline-2"
              >
                <Panel className="grid h-full content-start gap-1.5 p-4 transition-colors group-hover:border-line-strong">
                  <span className="flex items-center justify-between gap-2 font-medium">
                    {r.title}
                    <ArrowRightIcon
                      className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                  <span className="text-[13px] leading-5 text-ink-2">{r.description}</span>
                </Panel>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
