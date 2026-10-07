"use client";

import * as React from "react";
import { AccountSelect } from "@fin/components/shared/account-select";
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
import { Input } from "@fin/components/ui/input";
import type { ISODate } from "@fin/lib/dates";
import type { FormOptions } from "../form-options";

interface SettleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  /** "recebido" | "pago" | "realizada" — vocabulário da ação. */
  verb: string;
  needsAccount: boolean;
  accounts: FormOptions["accounts"];
  today: ISODate;
  onConfirm: (input: { settledAt: ISODate; accountId: string | null }) => Promise<void>;
}

/** Pede a data e, quando falta, a conta em que o dinheiro entrou ou saiu. */
export function SettleDialog({
  open,
  onOpenChange,
  count,
  verb,
  needsAccount,
  accounts,
  today,
  onConfirm,
}: SettleDialogProps) {
  const [date, setDate] = React.useState(today);
  const [accountId, setAccountId] = React.useState<string | null>(accounts[0]?.id ?? null);
  const [pending, setPending] = React.useState(false);
  const error = needsAccount && !accountId ? "Escolha a conta" : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            Marcar {count > 1 ? `${count} lançamentos` : "lançamento"} como {verb}
          </DialogTitle>
          <DialogDescription>
            O valor passa a contar no saldo da conta na data escolhida.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Data">
            {(a) => (
              <Input {...a} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            )}
          </Field>
          {needsAccount ? (
            <Field label="Conta" error={error ?? undefined}>
              {(a) => (
                <AccountSelect
                  {...a}
                  accounts={accounts}
                  value={accountId}
                  onChange={setAccountId}
                />
              )}
            </Field>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            disabled={pending || Boolean(error) || !date}
            onClick={async () => {
              setPending(true);
              await onConfirm({ settledAt: date, accountId });
              setPending(false);
            }}
          >
            {pending ? "Salvando…" : `Marcar como ${verb}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
