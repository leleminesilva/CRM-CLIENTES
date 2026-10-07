"use client";

import { FileUpIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "@fin/lib/use-action";
import * as React from "react";
import { toast } from "sonner";
import { AccountSelect } from "@fin/components/shared/account-select";
import { CategoryCombobox } from "@fin/components/shared/category-combobox";
import { MoneyText } from "@fin/components/shared/money-text";
import { Panel, PanelHeader } from "@fin/components/shared/panel";
import { Button } from "@fin/components/ui/button";
import { Checkbox } from "@fin/components/ui/checkbox";
import { Field } from "@fin/components/ui/field";
import { formatDate } from "@fin/lib/dates";
import { handleActionResult } from "@fin/lib/action-result";
import type { FormOptions } from "@fin/modules/transactions/form-options";
import { commitImportAction, previewImportAction } from "../actions";
import type { ImportPreview, PreviewRow } from "../types";

type Source = "CSV" | "XLSX" | "OFX";
const PAGE = 200;

function sourceOf(name: string): Source | null {
  const ext = name.toLowerCase().split(".").pop();
  return ext === "csv" || ext === "txt"
    ? "CSV"
    : ext === "xlsx"
      ? "XLSX"
      : ext === "ofx" || ext === "qfx"
        ? "OFX"
        : null;
}

async function readFile(file: File, source: Source): Promise<string> {
  if (source !== "XLSX") return file.text();
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

interface RowState {
  selected: boolean;
  categoryId: string | null;
}

export function ImportWizard({ options }: { options: FormOptions }) {
  const router = useRouter();
  const [accountId, setAccountId] = React.useState<string | null>(options.accounts[0]?.id ?? null);
  const [file, setFile] = React.useState<File | null>(null);
  const [invert, setInvert] = React.useState(false);
  const [preview, setPreview] = React.useState<
    (ImportPreview & { source: Source; fileName: string }) | null
  >(null);
  const [rows, setRows] = React.useState<RowState[]>([]);
  const [visible, setVisible] = React.useState(PAGE);
  const [done, setDone] = React.useState<{ imported: number; skippedDuplicates: number } | null>(
    null,
  );
  const [reading, setReading] = React.useState(false);
  const previewAction = useAction(previewImportAction);
  const commitAction = useAction(commitImportAction);

  const source = file ? sourceOf(file.name) : null;

  async function onPreview() {
    if (!file || !source || !accountId) return;
    setReading(true);
    try {
      const content = await readFile(file, source);
      const result = await previewAction.executeAsync({
        source,
        fileName: file.name,
        accountId,
        content,
        invertSign: invert,
      });
      if (!handleActionResult(result) || !result?.data) return;
      setPreview({ ...result.data, source, fileName: file.name });
      setRows(result.data.rows.map((r) => ({ selected: !r.duplicate, categoryId: r.categoryId })));
      setVisible(PAGE);
    } finally {
      setReading(false);
    }
  }

  async function onCommit() {
    if (!preview || !accountId) return;
    const chosen = preview.rows
      .map((r, i) => ({ r, s: rows[i]! }))
      .filter((x) => x.s.selected)
      .map(({ r, s }) => ({
        date: r.date,
        description: r.description,
        amount: r.amount,
        categoryId: s.categoryId,
        externalId: r.externalId,
      }));
    const result = await commitAction.executeAsync({
      source: preview.source,
      fileName: preview.fileName,
      accountId,
      rows: chosen,
    });
    if (!handleActionResult(result) || !result?.data) return;
    setDone(result.data);
    setPreview(null);
    toast.success(`${result.data.imported} lançamentos importados.`);
    router.refresh();
  }

  function reset() {
    setPreview(null);
    setDone(null);
    setFile(null);
    setRows([]);
  }

  function update(i: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  if (done)
    return (
      <Panel className="grid gap-4 p-6" role="status">
        <h2 className="text-lg font-semibold">Importação concluída</h2>
        <p className="text-[13px] text-ink-2">
          {done.imported} {done.imported === 1 ? "lançamento entrou" : "lançamentos entraram"} na
          conta como pagos
          {done.skippedDuplicates > 0
            ? `; ${done.skippedDuplicates} repetidos foram ignorados`
            : ""}
          . Se algo ficou errado, desfaça pelo histórico abaixo.
        </p>
        <div>
          <Button variant="secondary" onClick={reset}>
            Importar outro arquivo
          </Button>
        </div>
      </Panel>
    );

  if (!preview)
    return (
      <Panel>
        <PanelHeader
          title="1. Escolha o arquivo"
          description="Extrato em CSV, Excel (.xlsx) ou OFX do seu banco."
        />
        <form
          className="grid gap-4 p-5 sm:max-w-xl"
          onSubmit={(e) => {
            e.preventDefault();
            void onPreview();
          }}
        >
          <Field label="Conta do extrato">
            {(c) => (
              <AccountSelect
                {...c}
                accounts={options.accounts}
                value={accountId}
                onChange={setAccountId}
              />
            )}
          </Field>
          <Field
            label="Arquivo"
            hint="CSV precisa de cabeçalho com Data, Descrição e Valor (ou Débito e Crédito)."
            error={file && !source ? "Formato não suportado. Use .csv, .xlsx ou .ofx." : undefined}
          >
            {(c) => (
              <input
                {...c}
                type="file"
                accept=".csv,.txt,.xlsx,.ofx,.qfx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-control file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-[13px] file:text-ink"
              />
            )}
          </Field>
          {source && source !== "OFX" ? (
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
              <Checkbox checked={invert} onCheckedChange={(v) => setInvert(v === true)} />
              Compras aparecem com valor positivo (fatura de cartão): inverter o sinal
            </label>
          ) : null}
          <div>
            <Button type="submit" disabled={!file || !source || !accountId || reading}>
              {reading ? <Loader2Icon className="animate-spin" /> : <FileUpIcon />}
              Ler arquivo
            </Button>
          </div>
        </form>
      </Panel>
    );

  const chosen = rows.filter((r) => r.selected).length;
  const expenses = (n: PreviewRow["type"]) => preview.rows.filter((r) => r.type === n).length;
  const bulk = (type: "INCOME" | "EXPENSE", id: string) =>
    setRows((prev) =>
      prev.map((r, i) =>
        preview.rows[i]!.type === type && r.selected && !r.categoryId
          ? { ...r, categoryId: id }
          : r,
      ),
    );

  return (
    <Panel>
      <PanelHeader
        title="2. Revise antes de importar"
        description={`${preview.fileName} · ${preview.stats.fresh} novos · ${preview.stats.duplicates} já existem · ${preview.stats.errors} com problema`}
      />
      <div className="grid gap-4 p-5">
        {preview.errors.length > 0 ? (
          <details className="rounded-card border border-line bg-surface-sunken p-3 text-[13px]">
            <summary className="cursor-pointer font-medium">
              {preview.errors.length} linhas não puderam ser lidas
            </summary>
            <ul className="mt-2 grid gap-1 text-ink-2">
              {preview.errors.slice(0, 50).map((e) => (
                <li key={e.line}>
                  Linha {e.line}: {e.reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          {expenses("EXPENSE") > 0 ? (
            <div className="w-56">
              <span className="mb-1 block text-xs text-ink-3">
                Categoria para despesas sem categoria
              </span>
              <CategoryCombobox
                groups={options.categories.expense}
                value={null}
                onChange={(id) => bulk("EXPENSE", id)}
                placeholder="Aplicar a todas…"
                aria-label="Categoria para despesas sem categoria"
              />
            </div>
          ) : null}
          {expenses("INCOME") > 0 ? (
            <div className="w-56">
              <span className="mb-1 block text-xs text-ink-3">
                Categoria para receitas sem categoria
              </span>
              <CategoryCombobox
                groups={options.categories.income}
                value={null}
                onChange={(id) => bulk("INCOME", id)}
                placeholder="Aplicar a todas…"
                aria-label="Categoria para receitas sem categoria"
              />
            </div>
          ) : null}
        </div>
        <div
          className="overflow-x-auto rounded-card border border-line"
          role="region"
          aria-label="Linhas a importar"
          tabIndex={0}
        >
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th scope="col" className="w-10 px-3 py-2">
                  <Checkbox
                    aria-label="Selecionar todas"
                    checked={chosen === rows.length ? true : chosen === 0 ? false : "indeterminate"}
                    onCheckedChange={(v) =>
                      setRows((prev) => prev.map((r) => ({ ...r, selected: v === true })))
                    }
                  />
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Data
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Descrição
                </th>
                <th scope="col" className="w-56 px-3 py-2 font-medium">
                  Categoria
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {preview.rows.slice(0, visible).map((r, i) => (
                <tr key={r.line} className={rows[i]?.selected ? "" : "bg-surface-sunken/50"}>
                  <td className="px-3 py-1.5">
                    <Checkbox
                      aria-label={`Importar ${r.description}`}
                      checked={rows[i]?.selected ?? false}
                      onCheckedChange={(v) => update(i, { selected: v === true })}
                    />
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="px-3 py-1.5">
                    {r.description}
                    {r.duplicate ? (
                      <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-2">
                        {r.duplicateReason === "id" ? "Já importado" : "Parece repetido"}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-1.5">
                    <CategoryCombobox
                      groups={
                        r.type === "EXPENSE"
                          ? options.categories.expense
                          : options.categories.income
                      }
                      value={rows[i]?.categoryId ?? null}
                      onChange={(id) => update(i, { categoryId: id })}
                      placeholder="Sem categoria"
                      aria-label={`Categoria de ${r.description}`}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <MoneyText
                      value={r.amount}
                      variant="table"
                      sign="auto"
                      tone={r.type === "INCOME" ? "positive" : "default"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible < preview.rows.length ? (
          <div>
            <Button variant="secondary" size="sm" onClick={() => setVisible((v) => v + PAGE)}>
              Mostrar mais ({preview.rows.length - visible} restantes)
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <Button variant="ghost" onClick={reset}>
            Voltar
          </Button>
          <Button
            onClick={() => void onCommit()}
            disabled={chosen === 0 || commitAction.isExecuting}
          >
            {commitAction.isExecuting ? <Loader2Icon className="animate-spin" /> : null}
            Importar {chosen} {chosen === 1 ? "lançamento" : "lançamentos"}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
