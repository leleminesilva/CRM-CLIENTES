"use client";

import { CheckCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@fin/components/ui/button";
import { handleActionResult } from "@fin/lib/action-result";
import { markAllAlertsReadAction } from "../actions";

export function MarkAllReadButton() {
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        if (handleActionResult(await markAllAlertsReadAction()))
          toast.success("Todos os alertas marcados como lidos");
      }}
    >
      <CheckCheckIcon /> Marcar todos como lidos
    </Button>
  );
}
