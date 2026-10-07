"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@fin/components/ui/button";
import { Tooltip } from "@fin/components/ui/tooltip";
import { useLocalStorageFlag } from "@fin/lib/use-client-store";

const STORAGE_KEY = "cg:discreet";

/** Modo discreto: borra todos os valores monetários (classe .money-value). */
export function useDiscreet() {
  const [discreet, setDiscreet] = useLocalStorageFlag(STORAGE_KEY);
  const toggle = React.useCallback(() => setDiscreet(!discreet), [discreet, setDiscreet]);
  return { discreet, toggle };
}

/** Reflete o modo discreto no <html> (o CSS faz o resto). */
export function DiscreetProvider({ children }: { children: React.ReactNode }) {
  const { discreet } = useDiscreet();
  React.useEffect(() => {
    document.documentElement.dataset.discreet = discreet ? "true" : "false";
  }, [discreet]);
  return <>{children}</>;
}

export function DiscreetToggle() {
  const { discreet, toggle } = useDiscreet();
  const label = discreet ? "Mostrar valores" : "Ocultar valores";
  return (
    <Tooltip content={label}>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label={label}
        aria-pressed={discreet}
      >
        {discreet ? <EyeOffIcon /> : <EyeIcon />}
      </Button>
    </Tooltip>
  );
}
