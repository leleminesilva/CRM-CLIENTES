"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";
import { useMediaQuery } from "@fin/lib/use-client-store";

export function Toaster() {
  const { resolvedTheme } = useTheme();
  // No celular, no topo: embaixo cobriria a barra de navegação e os botões da tela.
  const isDesktop = useMediaQuery("(min-width: 48rem)");
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position={isDesktop ? "bottom-right" : "top-center"}
      visibleToasts={3}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!rounded-card !border !border-line !bg-surface-raised !text-ink !shadow-float !font-sans",
          description: "!text-ink-2",
          actionButton: "!bg-ink !text-on-ink !rounded-control !font-medium",
          cancelButton: "!bg-surface-sunken !text-ink-2",
        },
      }}
    />
  );
}
