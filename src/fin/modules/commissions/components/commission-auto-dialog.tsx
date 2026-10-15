"use client";

import { RefreshCwIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
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
import { handleActionResult } from "@fin/lib/action-result";
import { formatMonth } from "@fin/lib/dates";
import { saveCommissionSettingsAction, syncCommissionsFromSalesAction } from "../actions";

export function CommissionAutoDialog({
  open,
  onOpenChange,
  month,
  settings,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  month: string;
  settings: { ratePercent: string; payDay: number };
}) {
  const [rate, setRate] = React.useState(settings.ratePercent.replace(".", ","));
  const [payDay, setPayDay] = React.useState(String(settings.payDay));
  const [busy, setBusy] = React.useState<"save" | "sync" | null>(null);

  const rateOk = Number.parseFloat(rate.replace(",", ".")) > 0 && Number.parseFloat(rate.replace(",", ".")) <= 100;
  const dayOk = Number.isInteger(Number(payDay)) && Number(payDay) >= 1 && Number(payDay) <= 28;
  const changed =
    rate.replace(",", ".") !== settings.ratePercent || Number(payDay) !== settings.payDay;

  async function save(): Promise<boolean> {
    setBusy("save");
    try {
      const ok = handleActionResult(
        await saveCommissionSettingsAction({ ratePercent: rate, payDay: Number(payDay) }),
      );
      if (ok) toast.success("Comissão automática salva");
      return ok;
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    if (changed && !(await save())) return;
    setBusy("sync");
    try {
      const result = await syncCommissionsFromSalesAction({ month });
      if (handleActionResult(result)) {
        const d = result?.data;
        toast.success(
          d
            ? `${d.created} criadas, ${d.adopted} já existiam (ligadas à venda), ${d.updated} atualizadas`
            : "Comissões geradas",
        );
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Comissão automática</DialogTitle>
          <DialogDescription>
            Quando o vendedor registra uma venda no CRM, a comissão dele é lançada aqui sozinha, como
            despesa a pagar: valor da venda × percentual, no mês seguinte.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Percentual da comissão (%)" hint="Vale para as próximas vendas.">
              {(a) => (
                <Input {...a} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
              )}
            </Field>
            <Field label="Dia do pagamento (mês seguinte)" hint="Junto com o salário (1 a 28).">
              {(a) => (
                <Input
                  {...a}
                  inputMode="numeric"
                  value={payDay}
                  onChange={(e) => setPayDay(e.target.value.replace(/\D/g, ""))}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-2 rounded-card bg-surface-sunken px-3 py-3">
            <p className="text-[13px] text-ink-2">
              Gera as comissões das vendas já registradas em <strong>{formatMonth(month)}</strong> que
              ainda não têm comissão. As que já existem (inclusive as importadas por planilha) são
              ligadas à venda, sem duplicar.
            </p>
            <div>
              <Button
                variant="secondary"
                onClick={() => void sync()}
                disabled={busy !== null || !rateOk || !dayOk}
              >
                <RefreshCwIcon />
                {busy === "sync" ? "Gerando…" : `Gerar das vendas de ${formatMonth(month)}`}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy !== null}>
            Fechar
          </Button>
          <Button onClick={() => void save()} disabled={busy !== null || !rateOk || !dayOk || !changed}>
            {busy === "save" ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
