"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@fin/components/ui/button";
import { useTransactionForm } from "./transaction-form-provider";

export function NewExpenseButton() {
  const { openCreate } = useTransactionForm();
  return (
    <Button onClick={() => openCreate({ type: "EXPENSE" })}>
      <PlusIcon /> Nova despesa
    </Button>
  );
}
