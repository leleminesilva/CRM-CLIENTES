"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArchiveIcon,
  EllipsisIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { ChartFrame, ChartTable } from "@fin/components/charts/chart-frame";
import { ChartLegend } from "@fin/components/charts/income-expense-chart";
import { NetWorthChart } from "@fin/components/charts/net-worth-chart";
import { ConfirmDialog } from "@fin/components/shared/confirm-dialog";
import { MoneyInput, moneyToInput } from "@fin/components/shared/money-input";
import { MoneyText } from "@fin/components/shared/money-text";
import { PageHeader } from "@fin/components/shared/page-header";
import { Panel } from "@fin/components/shared/panel";
import { Button } from "@fin/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@fin/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@fin/components/ui/dropdown-menu";
import { Field } from "@fin/components/ui/field";
import { Input } from "@fin/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@fin/components/ui/select";
import { handleActionResult } from "@fin/lib/action-result";
import { formatDate, formatMonth, type ISODate } from "@fin/lib/dates";
import { formatMoney } from "@fin/lib/money";
import {
  archiveAssetAction,
  createAssetAction,
  createLiabilityAction,
  deleteAssetAction,
  deleteLiabilityAction,
  revalueAssetAction,
  updateAssetAction,
  updateLiabilityAction,
} from "../actions";
import type { listAssets, listLiabilities, netWorthAsOf, netWorthHistory } from "../queries";
import {
  ASSET_KINDS,
  assetSchema,
  LIABILITY_KINDS,
  liabilitySchema,
  revalueAssetSchema,
} from "../schemas";

type Asset = Awaited<ReturnType<typeof listAssets>>[number];
type Liability = Awaited<ReturnType<typeof listLiabilities>>[number];

const ASSET_LABELS: Record<(typeof ASSET_KINDS)[number], string> = {
  INVESTMENT: "Investimento",
  EQUIPMENT: "Equipamento",
  VEHICLE: "Veículo",
  REAL_ESTATE: "Imóvel",
  OTHER: "Outro bem",
};
const LIABILITY_LABELS: Record<(typeof LIABILITY_KINDS)[number], string> = {
  LOAN: "Empréstimo",
  FINANCING: "Financiamento",
  PERSONAL_DEBT: "Dívida pessoal",
  OTHER: "Outra dívida",
};

interface Props {
  snapshot: Awaited<ReturnType<typeof netWorthAsOf>>;
  history: Awaited<ReturnType<typeof netWorthHistory>>;
  assets: Asset[];
  liabilities: Liability[];
  today: ISODate;
}

export function NetWorthView({ snapshot, history, assets, liabilities, today }: Props) {
  const [assetForm, setAssetForm] = React.useState<{ asset?: Asset } | null>(null);
  const [revaluing, setRevaluing] = React.useState<Asset | null>(null);
  const [liabForm, setLiabForm] = React.useState<{ liability?: Liability } | null>(null);
  const [del, setDel] = React.useState<{
    kind: "asset" | "liability";
    id: string;
    name: string;
  } | null>(null);
  const change = Number(history.at(-1)?.netWorth ?? 0) - Number(history.at(-2)?.netWorth ?? 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Patrimônio"
        description="Tudo o que você tem menos tudo o que deve. Contas e cartões entram sozinhos; bens e dívidas fora do sistema você cadastra."
      />

      <Panel className="grid gap-6 p-5 md:grid-cols-[1.4fr_1fr_1fr] md:items-end">
        <div className="grid gap-1">
          <span className="text-[13px] text-ink-2">Patrimônio líquido</span>
          <MoneyText
            value={snapshot.netWorth}
            variant="hero"
            tone={snapshot.netWorth.startsWith("-") ? "critical" : "default"}
          />
          <span className="text-xs text-ink-3">
            {history.length > 1 ? (
              <>
                {change >= 0 ? "▲" : "▼"} <MoneyText value={String(Math.abs(change))} /> vs fim do
                mês anterior
              </>
            ) : null}
          </span>
        </div>
        <div className="grid gap-1 md:border-l md:border-line md:pl-6">
          <span className="text-[13px] text-ink-2">Ativos</span>
          <MoneyText value={snapshot.assetsTotal} variant="kpi" tone="positive" />
          <span className="text-xs text-ink-3">
            Disponível <MoneyText value={snapshot.liquid} /> · investido{" "}
            <MoneyText value={snapshot.invested} />
          </span>
        </div>
        <div className="grid gap-1 md:border-l md:border-line md:pl-6">
          <span className="text-[13px] text-ink-2">Passivos</span>
          <MoneyText value={snapshot.liabilitiesTotal} variant="kpi" />
          <span className="text-xs text-ink-3">Cartões, parcelas e dívidas</span>
        </div>
      </Panel>

      <ChartFrame
        question="Meu patrimônio está crescendo?"
        answer={`${change >= 0 ? "Subiu" : "Caiu"} ${formatMoney(Math.abs(change).toFixed(2))} em relação ao fim do mês passado.`}
        chart={
          <div className="grid gap-3">
            <ChartLegend
              items={[
                { label: "Patrimônio líquido", color: "var(--ink)", line: true },
                { label: "Ativos", color: "var(--series-income)", line: true },
                { label: "Passivos", color: "var(--series-expense)", line: true },
              ]}
            />
            <NetWorthChart
              data={history.map((h) => ({
                month: h.month,
                netWorth: Number(h.netWorth),
                assets: Number(h.assets),
                liabilities: Number(h.liabilities),
              }))}
            />
          </div>
        }
        table={
          <ChartTable
            head={["Mês", "Ativos", "Passivos", "Patrimônio líquido"]}
            rows={history.map((h) => [
              formatMonth(h.month),
              formatMoney(h.assets),
              formatMoney(h.liabilities),
              formatMoney(h.netWorth),
            ])}
          />
        }
        footnote="Cada mês usa os saldos e as avaliações vigentes naquela data. Reavaliar um bem não altera meses passados."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="grid content-start gap-2">
          <div className="flex items-center justify-between">
            <h2 className="title-section">Ativos</h2>
            <Button variant="secondary" size="sm" onClick={() => setAssetForm({})}>
              <PlusIcon /> Cadastrar bem
            </Button>
          </div>
          <Panel className="overflow-hidden">
            <ul className="divide-y divide-line">
              {snapshot.assets
                .filter((a) => a.key.startsWith("account:"))
                .map((a) => (
                  <li
                    key={a.key}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <span className="truncate">{a.label}</span>
                    <MoneyText
                      value={a.value}
                      variant="table"
                      className="font-medium"
                      tone={a.value.startsWith("-") ? "critical" : "default"}
                    />
                  </li>
                ))}
              {assets.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate text-sm">{a.name}</span>
                    <span className="text-xs text-ink-3">
                      {ASSET_LABELS[a.kind]} · avaliado em {formatDate(a.valuedAt)}
                    </span>
                  </div>
                  <MoneyText
                    value={a.currentValue}
                    variant="table"
                    className="text-sm font-medium"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${a.name}`}>
                        <EllipsisIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setRevaluing(a)}>
                        <RefreshCwIcon /> Atualizar valor
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setAssetForm({ asset: a })}>
                        <PencilIcon /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={async () => {
                          if (handleActionResult(await archiveAssetAction({ id: a.id })))
                            toast.success(`“${a.name}” arquivado`);
                        }}
                      >
                        <ArchiveIcon /> Arquivar (vendido, doado)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        destructive
                        onSelect={() => setDel({ kind: "asset", id: a.id, name: a.name })}
                      >
                        <Trash2Icon /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        <section className="grid content-start gap-2">
          <div className="flex items-center justify-between">
            <h2 className="title-section">Passivos</h2>
            <Button variant="secondary" size="sm" onClick={() => setLiabForm({})}>
              <PlusIcon /> Cadastrar dívida
            </Button>
          </div>
          <Panel className="overflow-hidden">
            {snapshot.liabilities.length === 0 && liabilities.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-ink-3">
                Sem dívidas registradas. Cartões e parcelamentos aparecem aqui sozinhos.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {snapshot.liabilities
                  .filter((l) => !l.key.startsWith("liability:"))
                  .map((l) => (
                    <li
                      key={l.key}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                    >
                      {l.href ? (
                        <Link href={l.href} className="truncate hover:underline">
                          {l.label}
                        </Link>
                      ) : (
                        <span className="truncate">{l.label}</span>
                      )}
                      <MoneyText value={l.value} variant="table" className="font-medium" />
                    </li>
                  ))}
                {liabilities.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="grid min-w-0 flex-1">
                      <span className="truncate text-sm">{l.name}</span>
                      <span className="text-xs text-ink-3">
                        {LIABILITY_LABELS[l.kind]}
                        {l.creditor ? ` · ${l.creditor}` : ""}
                      </span>
                    </div>
                    <MoneyText
                      value={l.currentBalance}
                      variant="table"
                      className="text-sm font-medium"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${l.name}`}>
                          <EllipsisIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setLiabForm({ liability: l })}>
                          <PencilIcon /> Atualizar saldo / editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          destructive
                          onSelect={() => setDel({ kind: "liability", id: l.id, name: l.name })}
                        >
                          <Trash2Icon /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      </div>

      {assetForm ? (
        <AssetDialog
          key={assetForm.asset?.id ?? "novo"}
          asset={assetForm.asset}
          today={today}
          onClose={() => setAssetForm(null)}
        />
      ) : null}
      {revaluing ? (
        <RevalueDialog asset={revaluing} today={today} onClose={() => setRevaluing(null)} />
      ) : null}
      {liabForm ? (
        <LiabilityDialog
          key={liabForm.liability?.id ?? "nova"}
          liability={liabForm.liability}
          today={today}
          onClose={() => setLiabForm(null)}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(del)}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Excluir “${del?.name ?? ""}”?`}
        description={
          <p>
            {del?.kind === "asset"
              ? "O bem e o histórico de avaliações serão apagados; o patrimônio passado deixa de contá-lo."
              : "A dívida será removida do patrimônio."}
          </p>
        }
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!del) return;
          const r =
            del.kind === "asset"
              ? await deleteAssetAction({ id: del.id })
              : await deleteLiabilityAction({ id: del.id });
          if (handleActionResult(r)) toast.success("Excluído");
        }}
      />
    </div>
  );
}

function AssetDialog({
  asset,
  today,
  onClose,
}: {
  asset?: Asset;
  today: ISODate;
  onClose: () => void;
}) {
  type V = z.input<typeof assetSchema>;
  type O = z.output<typeof assetSchema>;
  const form = useForm<V, unknown, O>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      name: asset?.name ?? "",
      kind: asset?.kind ?? "EQUIPMENT",
      acquisitionDate: asset?.acquisitionDate ?? null,
      acquisitionValue: asset?.acquisitionValue ? moneyToInput(asset.acquisitionValue) : "",
      currentValue: asset ? moneyToInput(asset.currentValue) : "",
      valuedAt: asset?.valuedAt ?? today,
      notes: "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{asset ? "Editar bem" : "Cadastrar bem"}</DialogTitle>
          <DialogDescription>
            Equipamentos, veículos, imóveis e investimentos fora das contas.
          </DialogDescription>
        </DialogHeader>
        <form
          id="asset-form"
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit(async (v) => {
            const r = asset
              ? await updateAssetAction({ ...v, id: asset.id })
              : await createAssetAction(v);
            if (handleActionResult(r, form)) {
              toast.success(asset ? "Bem salvo" : "Bem cadastrado");
              onClose();
            }
          })}
        >
          <Field label="Nome" error={errors.name?.message}>
            {(a) => <Input {...a} autoFocus {...form.register("name")} />}
          </Field>
          <Field label="Tipo">
            {(a) => (
              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id={a.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {ASSET_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>
          {!asset ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor atual" error={errors.currentValue?.message}>
                {(a) => <MoneyInput {...a} {...form.register("currentValue")} />}
              </Field>
              <Field label="Avaliado em" error={errors.valuedAt?.message}>
                {(a) => <Input {...a} type="date" {...form.register("valuedAt")} />}
              </Field>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Comprado em" aside="opcional">
              {(a) => (
                <Controller
                  control={form.control}
                  name="acquisitionDate"
                  render={({ field }) => (
                    <Input
                      {...a}
                      type="date"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Valor pago" aside="opcional">
              {(a) => <MoneyInput {...a} {...form.register("acquisitionValue")} />}
            </Field>
          </div>
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="asset-form" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : "Salvar bem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevalueDialog({
  asset,
  today,
  onClose,
}: {
  asset: Asset;
  today: ISODate;
  onClose: () => void;
}) {
  type V = z.input<typeof revalueAssetSchema>;
  type O = z.output<typeof revalueAssetSchema>;
  const form = useForm<V, unknown, O>({
    resolver: zodResolver(revalueAssetSchema),
    defaultValues: { id: asset.id, value: moneyToInput(asset.currentValue), date: today },
  });
  const { errors, isSubmitting } = form.formState;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Atualizar valor de “{asset.name}”</DialogTitle>
          <DialogDescription>
            O novo valor vale a partir da data; meses anteriores mantêm a avaliação que tinham.
          </DialogDescription>
        </DialogHeader>
        <form
          id="revalue-form"
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit(async (v) => {
            if (handleActionResult(await revalueAssetAction(v), form)) {
              toast.success("Valor atualizado");
              onClose();
            }
          })}
        >
          <Field label="Novo valor" error={errors.value?.message}>
            {(a) => <MoneyInput {...a} autoFocus {...form.register("value")} />}
          </Field>
          <Field label="Data da avaliação" error={errors.date?.message}>
            {(a) => <Input {...a} type="date" {...form.register("date")} />}
          </Field>
        </form>
        {asset.valuations.length > 1 ? (
          <ul className="grid gap-1 text-[13px] text-ink-2">
            {asset.valuations.map((v) => (
              <li key={v.date} className="flex justify-between">
                <span>{formatDate(v.date)}</span>
                <MoneyText value={v.value} />
              </li>
            ))}
          </ul>
        ) : null}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="revalue-form" disabled={isSubmitting}>
            Atualizar valor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LiabilityDialog({
  liability,
  today,
  onClose,
}: {
  liability?: Liability;
  today: ISODate;
  onClose: () => void;
}) {
  type V = z.input<typeof liabilitySchema>;
  type O = z.output<typeof liabilitySchema>;
  const form = useForm<V, unknown, O>({
    resolver: zodResolver(liabilitySchema),
    defaultValues: {
      name: liability?.name ?? "",
      kind: liability?.kind ?? "FINANCING",
      creditor: liability?.creditor ?? "",
      originalAmount: liability ? moneyToInput(liability.originalAmount) : "",
      currentBalance: liability ? moneyToInput(liability.currentBalance) : "",
      startDate: liability?.startDate ?? today,
      endDate: liability?.endDate ?? null,
      notes: "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{liability ? "Atualizar dívida" : "Cadastrar dívida"}</DialogTitle>
          <DialogDescription>
            Empréstimos e financiamentos fora do cartão e dos parcelamentos do sistema.
          </DialogDescription>
        </DialogHeader>
        <form
          id="liability-form"
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit(async (v) => {
            const r = liability
              ? await updateLiabilityAction({ ...v, id: liability.id })
              : await createLiabilityAction(v);
            if (handleActionResult(r, form)) {
              toast.success(liability ? "Dívida salva" : "Dívida cadastrada");
              onClose();
            }
          })}
        >
          <Field label="Nome" error={errors.name?.message}>
            {(a) => <Input {...a} autoFocus {...form.register("name")} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo">
              {(a) => (
                <Controller
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={a.id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LIABILITY_KINDS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {LIABILITY_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>
            <Field label="Credor" aside="opcional">
              {(a) => <Input {...a} {...form.register("creditor")} />}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor original" error={errors.originalAmount?.message}>
              {(a) => <MoneyInput {...a} {...form.register("originalAmount")} />}
            </Field>
            <Field label="Saldo devedor hoje" error={errors.currentBalance?.message}>
              {(a) => <MoneyInput {...a} {...form.register("currentBalance")} />}
            </Field>
          </div>
          <Field label="Contratada em" error={errors.startDate?.message}>
            {(a) => <Input {...a} type="date" className="w-44" {...form.register("startDate")} />}
          </Field>
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="liability-form" disabled={isSubmitting}>
            Salvar dívida
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
