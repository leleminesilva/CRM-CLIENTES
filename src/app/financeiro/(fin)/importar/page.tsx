import type { Metadata } from "next";
import { PageHeader } from "@fin/components/shared/page-header";
import { requirePageContext } from "@fin/lib/context";
import { ImportHistory } from "@fin/modules/imports/components/import-history";
import { ImportWizard } from "@fin/modules/imports/components/import-wizard";
import { listImports } from "@fin/modules/imports/queries";
import { loadFormOptions } from "@fin/modules/transactions/queries";

export const metadata: Metadata = { title: "Importar extrato" };

export default async function ImportPage() {
  const ctx = await requirePageContext();
  const [options, batches] = await Promise.all([loadFormOptions(ctx), listImports(ctx)]);
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Importar extrato"
        description="Traga o extrato do banco em CSV, Excel ou OFX. Você revisa tudo antes de gravar, e repetidos são detectados."
      />
      <ImportWizard options={options} />
      <ImportHistory batches={batches} />
    </div>
  );
}
