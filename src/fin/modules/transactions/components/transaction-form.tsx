"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDownIcon, RepeatIcon } from "lucide-react";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { AccountSelect } from "@fin/components/shared/account-select";
import { CategoryCombobox } from "@fin/components/shared/category-combobox";
import { MoneyInput, moneyToInput } from "@fin/components/shared/money-input";
import { Button } from "@fin/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@fin/components/ui/dialog";
import { Field } from "@fin/components/ui/field";
import { Input, Textarea } from "@fin/components/ui/input";
import { Segmented } from "@fin/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@fin/components/ui/select";
import { Switch } from "@fin/components/ui/switch";
import { handleActionResult } from "@fin/lib/action-result";
import { cn } from "@fin/lib/cn";
import { addDays, formatDate, formatMonth, type ISODate } from "@fin/lib/dates";
import { resolveInvoice } from "@fin/modules/credit-cards/domain/invoice-cycle";
import {
  createTransactionAction,
  deleteTransactionsAction,
  updateTransactionAction,
} from "../actions";
import { createTransactionSchema, PAYMENT_METHODS } from "../schemas";
import { PAYMENT_METHOD_LABELS, type TransactionDTO } from "../types";
import type { FormOptions } from "../form-options";
import { ExistingAttachments, PendingAttachments, uploadAttachment } from "./attachments-field";
import type { PlanPrefill } from "@fin/modules/installments/components/plan-form-dialog";
import { DescriptionField } from "./description-field";
import type { TransactionFormOutput, TransactionFormValues } from "./form-values";
import { DEFAULT_REPEAT, RepeatFields } from "./repeat-fields";
import { useScopeDialog } from "./scope-dialog";

export type FormMode =
  | { kind: "create"; prefill?: Partial<TransactionFormValues> }
  | { kind: "edit"; transaction: TransactionDTO };

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: FormMode;
  options: FormOptions;
  today: ISODate;
  /** Abre a compra parcelada com os dados já digitados. */
  onInstallment?: (prefill: PlanPrefill) => void;
}

const TYPE_TITLES = { EXPENSE: "despesa", INCOME: "receita", TRANSFER: "transferência" } as const;
const NO_VALUE = "__none__";
const LAST_ACCOUNT_KEY = "cg:last-account";

function lastAccount(options: FormOptions): string | null {
  try {
    const stored = window.localStorage.getItem(LAST_ACCOUNT_KEY);
    if (stored && options.accounts.some((a) => a.id === stored)) return stored;
  } catch {
    // Sem armazenamento local: usa a primeira conta.
  }
  return options.accounts[0]?.id ?? null;
}

function defaultsFor(mode: FormMode, options: FormOptions, today: ISODate): TransactionFormValues {
  if (mode.kind === "edit") {
    const t = mode.transaction;
    return {
      type: t.type === "INCOME" || t.type === "TRANSFER" ? t.type : "EXPENSE",
      description: t.description,
      amount: moneyToInput(t.amount),
      date: t.date,
      dueDate: t.dueDate === t.date ? null : t.dueDate,
      settled: t.status === "SETTLED",
      settledAt: t.settledAt,
      accountId: t.account?.id ?? null,
      creditCardId: t.creditCard?.id ?? null,
      transferAccountId: t.transferAccount?.id ?? null,
      categoryId: t.category?.id ?? null,
      nature: t.nature,
      paymentMethod: t.paymentMethod,
      notes: t.notes ?? "",
      repeat: null,
    };
  }
  return {
    type: "EXPENSE",
    description: "",
    amount: "",
    date: today,
    dueDate: null,
    settled: true,
    settledAt: null,
    accountId: lastAccount(options),
    creditCardId: null,
    transferAccountId: null,
    categoryId: null,
    nature: null,
    paymentMethod: null,
    notes: "",
    repeat: null,
    ...mode.prefill,
  };
}

export function TransactionForm({
  open,
  onOpenChange,
  mode,
  options,
  today,
  onInstallment,
}: TransactionFormProps) {
  const editing = mode.kind === "edit" ? mode.transaction : null;
  const defaults = React.useMemo(() => defaultsFor(mode, options, today), [mode, options, today]);
  const form = useForm<TransactionFormValues, unknown, TransactionFormOutput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting, dirtyFields } = form.formState;
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [detailsOpen, setDetailsOpen] = React.useState(
    Boolean(defaults.repeat) ||
      Boolean(defaults.notes) ||
      Boolean(defaults.paymentMethod) ||
      Boolean(editing?.attachmentCount),
  );
  const scope = useScopeDialog();

  const type = useWatch({ control: form.control, name: "type" });
  const date = useWatch({ control: form.control, name: "date" });
  const settled = useWatch({ control: form.control, name: "settled" });
  const repeat = useWatch({ control: form.control, name: "repeat" });
  const accountId = useWatch({ control: form.control, name: "accountId" });
  const creditCardId = useWatch({ control: form.control, name: "creditCardId" });
  const card = options.cards.find((c) => c.id === creditCardId) ?? null;
  const onCard = type === "EXPENSE" && Boolean(card);
  const invoiceCycle = card ? resolveInvoice(date, card.closingDay, card.dueDay) : null;
  const isTransfer = type === "TRANSFER";
  const inSeries = Boolean(editing?.recurrenceId);
  const groups = type === "INCOME" ? options.categories.income : options.categories.expense;

  const settledLabel =
    type === "INCOME" ? "Já foi recebido" : isTransfer ? "Já foi realizada" : "Já foi pago";
  const accountLabel =
    type === "INCOME" ? "Conta de destino" : isTransfer ? "Conta de origem" : "Conta";

  function changeType(next: TransactionFormValues["type"]) {
    form.setValue("type", next, { shouldDirty: true });
    form.setValue("categoryId", null);
    form.setValue("nature", null);
    if (next !== "EXPENSE") form.setValue("creditCardId", null);
    if (next === "TRANSFER") form.setValue("repeat", null);
    form.clearErrors();
  }

  async function save(values: TransactionFormOutput, again: boolean) {
    if (editing) {
      let chosenScope: "this" | "future" | "all-pending" = "this";
      const contentChanged = [
        "description",
        "amount",
        "categoryId",
        "accountId",
        "paymentMethod",
        "nature",
      ].some((k) => dirtyFields[k as keyof typeof dirtyFields]);
      if (inSeries && contentChanged) {
        const answer = await scope.ask("Salvar alteração");
        if (!answer) return;
        chosenScope = answer;
      }
      const { repeat: _repeat, ...fields } = values;
      const result = await updateTransactionAction({
        ...fields,
        id: editing.id,
        scope: chosenScope,
      });
      if (handleActionResult(result, form)) {
        toast.success("Lançamento salvo");
        onOpenChange(false);
      }
      return;
    }

    const result = await createTransactionAction(values);
    if (!handleActionResult(result, form)) return;
    const id = result?.data?.id;
    if (!id) return;

    let uploaded = 0;
    for (const file of pendingFiles) if (await uploadAttachment(id, file)) uploaded++;
    if (values.accountId) {
      try {
        window.localStorage.setItem(LAST_ACCOUNT_KEY, values.accountId);
      } catch {
        // Sem armazenamento local: tudo bem.
      }
    }

    const noun =
      values.type === "INCOME"
        ? "Receita"
        : values.type === "TRANSFER"
          ? "Transferência"
          : "Despesa";
    toast.success(
      `${noun} salva${uploaded ? ` com ${uploaded} anexo${uploaded > 1 ? "s" : ""}` : ""}`,
      {
        duration: 8000,
        action: {
          label: "Desfazer",
          onClick: () => {
            void deleteTransactionsAction({
              ids: [id],
              scope: values.repeat ? "future" : "this",
            }).then((r) => {
              if (handleActionResult(r)) toast.success("Lançamento desfeito");
            });
          },
        },
      },
    );

    if (again) {
      form.reset({
        ...defaultsFor({ kind: "create" }, options, today),
        type: values.type,
        date: values.date,
        accountId: values.accountId,
      });
      setPendingFiles([]);
      form.setFocus("amount");
    } else {
      onOpenChange(false);
    }
  }

  const title = editing ? "Editar lançamento" : `Nova ${TYPE_TITLES[type]}`;
  const dayChips: { label: string; value: ISODate }[] = [
    { label: "Hoje", value: today },
    { label: "Ontem", value: addDays(today, -1) },
    { label: "Anteontem", value: addDays(today, -2) },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="md" aria-describedby="transaction-form-help">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription id="transaction-form-help">
              {editing
                ? "Altere o que precisar e salve."
                : "Preencha o essencial e salve. Enter salva."}
            </DialogDescription>
          </DialogHeader>

          <form
            id="transaction-form"
            noValidate
            onSubmit={(e) => void form.handleSubmit((v) => save(v, false))(e)}
            className="grid gap-4"
          >
            {!(editing && inSeries) ? (
              <Segmented
                aria-label="Tipo de lançamento"
                value={type}
                onValueChange={changeType}
                options={[
                  { value: "EXPENSE", label: "Despesa" },
                  { value: "INCOME", label: "Receita" },
                  { value: "TRANSFER", label: "Transferência" },
                ]}
                className="w-full"
              />
            ) : (
              <p className="flex items-center gap-2 rounded-control bg-surface-sunken px-3 py-2 text-[13px] text-ink-2">
                <RepeatIcon className="size-4" /> Faz parte de uma série. Ao salvar, você escolhe
                até onde aplicar a mudança.
              </p>
            )}

            <Field label="Valor" error={errors.amount?.message}>
              {(a) => (
                <MoneyInput {...a} placeholder="0,00" autoFocus {...form.register("amount")} />
              )}
            </Field>

            <Field label="Descrição" error={errors.description?.message}>
              {(a) => (
                <Controller
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <DescriptionField
                      {...a}
                      ref={field.ref}
                      type={type}
                      value={field.value}
                      placeholder={isTransfer ? "Ex.: Aplicação na reserva" : "Ex.: Combustível"}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      onPick={(s) => {
                        field.onChange(s.description);
                        if (!form.getValues("amount"))
                          form.setValue("amount", moneyToInput(s.amount), { shouldDirty: true });
                        if (s.categoryId)
                          form.setValue("categoryId", s.categoryId, { shouldDirty: true });
                        if (s.accountId)
                          form.setValue("accountId", s.accountId, { shouldDirty: true });
                        if (s.paymentMethod)
                          form.setValue("paymentMethod", s.paymentMethod, { shouldDirty: true });
                      }}
                    />
                  )}
                />
              )}
            </Field>

            {!isTransfer ? (
              <Field label="Categoria" error={errors.categoryId?.message}>
                {(a) => (
                  <Controller
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <CategoryCombobox
                        {...a}
                        groups={groups}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                )}
              </Field>
            ) : null}

            {type === "EXPENSE" && options.cards.length > 0 ? (
              <Segmented
                aria-label="Forma de pagamento"
                value={onCard ? "card" : "account"}
                onValueChange={(v) => {
                  if (v === "card") {
                    form.setValue("creditCardId", options.cards[0]?.id ?? null, {
                      shouldDirty: true,
                    });
                    form.setValue("settled", false);
                  } else {
                    form.setValue("creditCardId", null, { shouldDirty: true });
                  }
                }}
                options={[
                  { value: "account", label: "Conta" },
                  { value: "card", label: "Cartão de crédito" },
                ]}
                className="w-full"
              />
            ) : null}

            <div className={cn("grid gap-4", isTransfer && "sm:grid-cols-2")}>
              {onCard ? (
                <Field
                  label="Cartão"
                  error={errors.creditCardId?.message}
                  hint={
                    invoiceCycle
                      ? `Entra na fatura de ${formatMonth(invoiceCycle.referenceMonth)} (vence em ${formatDate(invoiceCycle.dueDate)}).`
                      : undefined
                  }
                >
                  {(a) => (
                    <Controller
                      control={form.control}
                      name="creditCardId"
                      render={({ field }) => (
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
                          <SelectTrigger id={a.id} aria-describedby={a["aria-describedby"]}>
                            <SelectValue placeholder="Escolha o cartão" />
                          </SelectTrigger>
                          <SelectContent>
                            {options.cards.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  )}
                </Field>
              ) : (
                <Field label={accountLabel} error={errors.accountId?.message}>
                  {(a) => (
                    <Controller
                      control={form.control}
                      name="accountId"
                      render={({ field }) => (
                        <AccountSelect
                          {...a}
                          accounts={options.accounts}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={settled ? "Escolha a conta" : "Opcional enquanto pendente"}
                        />
                      )}
                    />
                  )}
                </Field>
              )}
              {isTransfer ? (
                <Field label="Conta de destino" error={errors.transferAccountId?.message}>
                  {(a) => (
                    <Controller
                      control={form.control}
                      name="transferAccountId"
                      render={({ field }) => (
                        <AccountSelect
                          {...a}
                          accounts={options.accounts}
                          value={field.value}
                          onChange={field.onChange}
                          exclude={accountId}
                        />
                      )}
                    />
                  )}
                </Field>
              ) : null}
            </div>

            <Field label="Data" error={errors.date?.message}>
              {(a) => (
                <div className="flex flex-wrap items-center gap-2">
                  <Input {...a} type="date" className="w-40" {...form.register("date")} />
                  {dayChips.map((c) => (
                    <Button
                      key={c.label}
                      type="button"
                      size="sm"
                      variant={date === c.value ? "primary" : "secondary"}
                      onClick={() =>
                        form.setValue("date", c.value, { shouldDirty: true, shouldValidate: true })
                      }
                    >
                      {c.label}
                    </Button>
                  ))}
                </div>
              )}
            </Field>

            {!onCard ? (
              <Controller
                control={form.control}
                name="settled"
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-card border border-line bg-surface px-3 py-2.5">
                    <span className="grid gap-0.5">
                      <span className="text-sm font-medium">{settledLabel}</span>
                      <span className="text-xs text-ink-3">
                        {field.value
                          ? "Entra no saldo da conta agora."
                          : "Fica pendente até você marcar como concluído."}
                      </span>
                    </span>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />
            ) : null}

            {!settled && !onCard ? (
              <Field
                label={type === "INCOME" ? "Previsão de recebimento" : "Vencimento"}
                hint="Se vazio, usa a data do lançamento."
                error={errors.dueDate?.message}
              >
                {(a) => (
                  <Controller
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <Input
                        {...a}
                        type="date"
                        className="w-44"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    )}
                  />
                )}
              </Field>
            ) : null}

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => setDetailsOpen((o) => !o)}
                aria-expanded={detailsOpen}
                className="flex w-fit cursor-pointer items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink"
              >
                <ChevronDownIcon
                  className={cn("size-4 transition-transform", detailsOpen && "rotate-180")}
                />
                {detailsOpen
                  ? "Menos opções"
                  : "Mais opções: repetir, forma de pagamento, observações e anexos"}
              </button>

              {detailsOpen ? (
                <div className="grid gap-4">
                  {settled ? (
                    <Field
                      label={type === "INCOME" ? "Data do recebimento" : "Data do pagamento"}
                      hint="Se vazio, usa a data do lançamento."
                    >
                      {(a) => (
                        <Controller
                          control={form.control}
                          name="settledAt"
                          render={({ field }) => (
                            <Input
                              {...a}
                              type="date"
                              className="w-44"
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value || null)}
                            />
                          )}
                        />
                      )}
                    </Field>
                  ) : null}

                  {!isTransfer ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Forma de pagamento">
                        {(a) => (
                          <Controller
                            control={form.control}
                            name="paymentMethod"
                            render={({ field }) => (
                              <Select
                                value={field.value ?? NO_VALUE}
                                onValueChange={(v) => field.onChange(v === NO_VALUE ? null : v)}
                              >
                                <SelectTrigger id={a.id}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NO_VALUE}>Não informar</SelectItem>
                                  {PAYMENT_METHODS.map((m) => (
                                    <SelectItem key={m} value={m}>
                                      {PAYMENT_METHOD_LABELS[m]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        )}
                      </Field>
                      {type === "EXPENSE" ? (
                        <Field label="Natureza" hint="Fixa entra no total de despesas fixas.">
                          {(a) => (
                            <Controller
                              control={form.control}
                              name="nature"
                              render={({ field }) => (
                                <Select
                                  value={field.value ?? NO_VALUE}
                                  onValueChange={(v) => field.onChange(v === NO_VALUE ? null : v)}
                                >
                                  <SelectTrigger id={a.id}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={NO_VALUE}>
                                      Automática (pela categoria)
                                    </SelectItem>
                                    <SelectItem value="FIXED">Fixa</SelectItem>
                                    <SelectItem value="VARIABLE">Variável</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          )}
                        </Field>
                      ) : null}
                    </div>
                  ) : null}

                  {type === "EXPENSE" && !editing && onInstallment ? (
                    <div className="flex items-center justify-between gap-3 rounded-card border border-dashed border-line-strong px-3 py-2.5">
                      <span className="text-[13px] text-ink-2">
                        Comprou parcelado? Gere todas as parcelas de uma vez.
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const v = form.getValues();
                          onInstallment({
                            description: v.description,
                            totalAmount: v.amount,
                            categoryId: v.categoryId,
                            creditCardId: v.creditCardId ?? null,
                            purchaseDate: v.date,
                          });
                        }}
                      >
                        Parcelar
                      </Button>
                    </div>
                  ) : null}

                  {!isTransfer && !editing ? (
                    <div className="grid gap-3">
                      <Controller
                        control={form.control}
                        name="repeat"
                        render={({ field }) => (
                          <label className="flex cursor-pointer items-center justify-between gap-3">
                            <span className="grid gap-0.5">
                              <span className="text-sm font-medium">Repetir</span>
                              <span className="text-xs text-ink-3">
                                Salário, aluguel, assinaturas: gera os próximos 12 meses.
                              </span>
                            </span>
                            <Switch
                              checked={Boolean(field.value)}
                              onCheckedChange={(on) =>
                                field.onChange(
                                  on ? { ...DEFAULT_REPEAT, isEstimatedAmount: false } : null,
                                )
                              }
                            />
                          </label>
                        )}
                      />
                      {repeat ? (
                        <RepeatFields
                          control={form.control}
                          startDate={form.getValues("dueDate") ?? date}
                          errors={
                            errors.repeat as
                              Record<string, { message?: string } | undefined> | undefined
                          }
                        />
                      ) : null}
                    </div>
                  ) : null}

                  <Field label="Observações" aside="opcional" error={errors.notes?.message}>
                    {(a) => <Textarea {...a} rows={2} {...form.register("notes")} />}
                  </Field>

                  <div className="grid gap-1.5">
                    <span className="text-[13px] leading-4 font-medium text-ink-2">Anexos</span>
                    {editing ? (
                      <ExistingAttachments transactionId={editing.id} />
                    ) : (
                      <PendingAttachments files={pendingFiles} onChange={setPendingFiles} />
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </form>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            {!editing ? (
              <Button
                type="button"
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => void form.handleSubmit((v) => save(v, true))()}
              >
                Salvar e criar outro
              </Button>
            ) : null}
            <Button type="submit" form="transaction-form" disabled={isSubmitting}>
              {isSubmitting
                ? "Salvando…"
                : editing
                  ? "Salvar alterações"
                  : `Salvar ${TYPE_TITLES[type]}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {scope.dialog}
    </>
  );
}
