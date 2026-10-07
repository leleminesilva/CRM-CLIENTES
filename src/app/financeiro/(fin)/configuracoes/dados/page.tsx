import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon, FileArchiveIcon, FileJsonIcon } from "lucide-react";
import { Panel, PanelHeader } from "@fin/components/shared/panel";
import { Button } from "@fin/components/ui/button";
import { requirePageContext } from "@fin/lib/context";

export const metadata: Metadata = { title: "Dados" };

export default async function DataPage() {
  const ctx = await requirePageContext();
  return (
    <div className="grid gap-6">
      <Panel>
        <PanelHeader
          title="Exportar meus dados"
          description={`Tudo do workspace “${ctx.workspace.name}” num arquivo aberto, legível fora do sistema.`}
        />
        <div className="flex flex-wrap gap-3 p-5">
          <Button asChild variant="secondary">
            <a href="/api/fin/exportar?formato=json" download>
              <FileJsonIcon /> Baixar JSON
            </a>
          </Button>
          <Button asChild variant="secondary">
            <a href="/api/fin/exportar?formato=zip" download>
              <FileArchiveIcon /> Baixar ZIP com anexos
            </a>
          </Button>
          <p className="basis-full text-xs text-ink-2">
            <DownloadIcon className="mr-1 inline size-3" />
            Para relatórios em planilha ou PDF, use{" "}
            <Link className="underline underline-offset-4" href="/financeiro/relatorios">
              Relatórios
            </Link>
            .
          </p>
        </div>
      </Panel>
    </div>
  );
}
