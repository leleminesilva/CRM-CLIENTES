import { BellOffIcon } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@fin/components/shared/empty-state";
import { PageHeader } from "@fin/components/shared/page-header";
import { Panel } from "@fin/components/shared/panel";
import { requirePageContext } from "@fin/lib/context";
import { AlertItem } from "@fin/modules/alerts/components/alert-item";
import { MarkAllReadButton } from "@fin/modules/alerts/components/mark-all-read-button";
import { PRIORITY_LABELS } from "@fin/modules/alerts/components/priority-mark";
import { listAlerts } from "@fin/modules/alerts/queries";
import { refreshAlerts } from "@fin/modules/alerts/service";

export const metadata: Metadata = { title: "Alertas" };

const ORDER = ["CRITICAL", "IMPORTANT", "ATTENTION", "INFO"] as const;

export default async function AlertsPage() {
  const ctx = await requirePageContext();
  await refreshAlerts(ctx, ctx.today, { force: true });
  const alerts = await listAlerts(ctx);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Alertas"
        description="Vencimentos, atrasos e mudanças que pedem atenção, do mais grave ao informativo."
        actions={alerts.some((a) => !a.read) ? <MarkAllReadButton /> : null}
      />
      {alerts.length === 0 ? (
        <Panel>
          <EmptyState
            icon={BellOffIcon}
            title="Tudo em dia"
            description="Nenhuma conta vencendo, nada atrasado. Os alertas aparecem aqui quando algo pedir sua atenção."
          />
        </Panel>
      ) : (
        ORDER.filter((p) => alerts.some((a) => a.priority === p)).map((p) => (
          <section key={p} className="grid gap-2">
            <h2 className="title-section">{PRIORITY_LABELS[p]}</h2>
            <Panel className="overflow-hidden">
              <ul className="divide-y divide-line">
                {alerts
                  .filter((a) => a.priority === p)
                  .map((a) => (
                    <li key={a.id}>
                      <AlertItem alert={a} />
                    </li>
                  ))}
              </ul>
            </Panel>
          </section>
        ))
      )}
    </div>
  );
}
