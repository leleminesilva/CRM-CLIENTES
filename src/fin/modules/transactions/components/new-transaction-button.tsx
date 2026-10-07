"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@fin/components/ui/button";
import { Tooltip } from "@fin/components/ui/tooltip";
import { useTransactionForm } from "./transaction-form-provider";

export function NewTransactionButton() {
  const { openCreate } = useTransactionForm();
  return (
    <Tooltip content="Novo lançamento (N)">
      <Button
        onClick={() => openCreate()}
        size="md"
        className="max-sm:size-9 max-sm:px-0"
        aria-label="Novo lançamento"
      >
        <PlusIcon />
        <span className="max-sm:hidden">Novo lançamento</span>
      </Button>
    </Tooltip>
  );
}
