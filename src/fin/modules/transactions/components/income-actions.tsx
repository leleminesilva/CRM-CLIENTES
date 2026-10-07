"use client";

import { PlusIcon, WalletIcon } from "lucide-react";
import { Button } from "@fin/components/ui/button";
import { DEFAULT_REPEAT } from "./repeat-fields";
import { useTransactionForm } from "./transaction-form-provider";

/** Atalhos da página de renda: nova receita e cadastro guiado da renda base mensal. */
export function IncomeActions({ baseCategoryId }: { baseCategoryId: string | null }) {
  const { openCreate } = useTransactionForm();
  return (
    <>
      <Button
        variant="secondary"
        onClick={() =>
          openCreate({
            type: "INCOME",
            description: "Receita mensal",
            categoryId: baseCategoryId,
            settled: false,
            repeat: { ...DEFAULT_REPEAT, dayRule: "NTH_BUSINESS_DAY", dayOfMonth: 5 },
          })
        }
      >
        <WalletIcon /> Cadastrar receita recorrente
      </Button>
      <Button
        onClick={() =>
          openCreate({
            type: "INCOME",
            settled: false,
          })
        }
      >
        <PlusIcon /> Nova receita
      </Button>
    </>
  );
}
