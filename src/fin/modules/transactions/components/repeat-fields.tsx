"use client";

import { Controller, type Control, useWatch } from "react-hook-form";
import { Field } from "@fin/components/ui/field";
import { Input } from "@fin/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@fin/components/ui/select";
import { Switch } from "@fin/components/ui/switch";
import { parseISODate } from "@fin/lib/dates";
import { DEFAULT_REPEAT, type RepeatInput } from "@fin/modules/recurrences/schemas";

export { DEFAULT_REPEAT };
import type { TransactionFormOutput, TransactionFormValues } from "./form-values";

const FREQUENCIES = [
  { value: "MONTHLY:1", label: "Todo mês" },
  { value: "MONTHLY:2", label: "A cada 2 meses" },
  { value: "MONTHLY:3", label: "A cada 3 meses" },
  { value: "MONTHLY:6", label: "A cada 6 meses" },
  { value: "YEARLY:1", label: "Todo ano" },
  { value: "WEEKLY:1", label: "Toda semana" },
  { value: "WEEKLY:2", label: "A cada 2 semanas" },
];

type FormControl = Control<TransactionFormValues, unknown, TransactionFormOutput>;

/** Configuração de repetição: frequência, dia, ajuste de dia útil e término. */
export function RepeatFields({
  control,
  startDate,
  errors,
}: {
  control: FormControl;
  startDate: string;
  errors?: Record<string, { message?: string } | undefined>;
}) {
  const repeat = useWatch({ control, name: "repeat" }) as RepeatInput | null;
  if (!repeat) return null;
  const day = parseISODate(startDate).day;
  const isWeekly = repeat.frequency === "WEEKLY";

  return (
    <div className="grid gap-3 rounded-card border border-line bg-surface p-3 sm:grid-cols-2">
      <Field label="Frequência">
        {(a) => (
          <Controller
            control={control}
            name="repeat"
            render={({ field }) => (
              <Select
                value={`${repeat.frequency}:${repeat.intervalCount}`}
                onValueChange={(v) => {
                  const [frequency, interval] = v.split(":") as [RepeatInput["frequency"], string];
                  field.onChange({
                    ...repeat,
                    frequency,
                    intervalCount: Number.parseInt(interval, 10),
                    dayRule: frequency === "WEEKLY" ? "FIXED_DAY" : repeat.dayRule,
                  });
                }}
              >
                <SelectTrigger id={a.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </Field>

      {!isWeekly ? (
        <Field label="Dia" error={errors?.dayOfMonth?.message}>
          {(a) => (
            <Controller
              control={control}
              name="repeat"
              render={({ field }) => (
                <Select
                  value={
                    repeat.dayRule === "NTH_BUSINESS_DAY"
                      ? `NTH:${repeat.dayOfMonth ?? 5}`
                      : repeat.dayRule
                  }
                  onValueChange={(v) => {
                    if (v.startsWith("NTH:"))
                      field.onChange({
                        ...repeat,
                        dayRule: "NTH_BUSINESS_DAY",
                        dayOfMonth: Number.parseInt(v.slice(4), 10),
                        nonBusinessDayShift: "NONE",
                      });
                    else
                      field.onChange({
                        ...repeat,
                        dayRule: v as RepeatInput["dayRule"],
                        dayOfMonth: null,
                      });
                  }}
                >
                  <SelectTrigger id={a.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED_DAY">
                      Dia {day} {day >= 29 ? "(ou o último do mês)" : ""}
                    </SelectItem>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20].map((n) => (
                      <SelectItem key={n} value={`NTH:${n}`}>
                        {n}º dia útil
                      </SelectItem>
                    ))}
                    <SelectItem value="LAST_BUSINESS_DAY">Último dia útil</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>
      ) : (
        <div />
      )}

      {repeat.dayRule === "FIXED_DAY" ? (
        <Field label="Se cair em fim de semana ou feriado">
          {(a) => (
            <Controller
              control={control}
              name="repeat.nonBusinessDayShift"
              render={({ field }) => (
                <Select value={field.value as string} onValueChange={field.onChange}>
                  <SelectTrigger id={a.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Manter a data</SelectItem>
                    <SelectItem value="NEXT">Próximo dia útil</SelectItem>
                    <SelectItem value="PREVIOUS">Dia útil anterior</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>
      ) : null}

      <Field label="Termina" error={errors?.endDate?.message ?? errors?.maxOccurrences?.message}>
        {(a) => (
          <div className="flex gap-2">
            <Controller
              control={control}
              name="repeat.endMode"
              render={({ field }) => (
                <Select value={field.value as string} onValueChange={field.onChange}>
                  <SelectTrigger id={a.id} className="min-w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Nunca</SelectItem>
                    <SelectItem value="until">Em uma data</SelectItem>
                    <SelectItem value="count">Após N vezes</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {repeat.endMode === "until" ? (
              <Controller
                control={control}
                name="repeat.endDate"
                render={({ field }) => (
                  <Input
                    type="date"
                    aria-label="Data final"
                    value={(field.value as string | null) ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                  />
                )}
              />
            ) : null}
            {repeat.endMode === "count" ? (
              <Controller
                control={control}
                name="repeat.maxOccurrences"
                render={({ field }) => (
                  <Input
                    type="number"
                    min={1}
                    max={600}
                    inputMode="numeric"
                    aria-label="Quantas vezes"
                    className="w-24"
                    value={(field.value as number | null) ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? null : Number.parseInt(e.target.value, 10),
                      )
                    }
                  />
                )}
              />
            ) : null}
          </div>
        )}
      </Field>

      <Controller
        control={control}
        name="repeat.isEstimatedAmount"
        render={({ field }) => (
          <label className="flex cursor-pointer items-center justify-between gap-3 sm:col-span-2">
            <span className="grid gap-0.5">
              <span className="text-sm">O valor varia a cada vez</span>
              <span className="text-xs text-ink-3">
                Ex.: energia, água. A previsão usa a média dos últimos meses.
              </span>
            </span>
            <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
          </label>
        )}
      />
    </div>
  );
}
