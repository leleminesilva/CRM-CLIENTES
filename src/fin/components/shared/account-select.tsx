"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@fin/components/ui/select";
import type { FormOptions } from "@fin/modules/transactions/form-options";

interface AccountSelectProps {
  accounts: FormOptions["accounts"];
  value: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  exclude?: string | null;
}

export function AccountSelect({
  accounts,
  value,
  onChange,
  placeholder = "Escolha a conta",
  exclude,
  ...aria
}: AccountSelectProps) {
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger {...aria}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {accounts
          .filter((a) => a.id !== exclude)
          .map((a) => (
            <SelectItem key={a.id} value={a.id}>
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block size-2.5 rounded-full border border-line-strong"
                  style={a.color ? { backgroundColor: a.color, borderColor: a.color } : undefined}
                />
                {a.name}
              </span>
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
