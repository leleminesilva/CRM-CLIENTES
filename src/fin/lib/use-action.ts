"use client";

import * as React from "react";

/**
 * Subconjunto do `useAction` do next-safe-action usado no Financeiro (executeAsync + isExecuting).
 * O hook original importa `useActionState`, que só existe no React 19, e quebra o build de
 * produção do CRM (React 18). As actions em si (createSafeActionClient) continuam as mesmas.
 */
export function useAction<A extends (...args: never[]) => Promise<unknown>>(action: A) {
  const [isExecuting, setExecuting] = React.useState(false);
  const executeAsync = React.useCallback(
    async (...args: Parameters<A>): Promise<Awaited<ReturnType<A>>> => {
      setExecuting(true);
      try {
        return (await action(...args)) as Awaited<ReturnType<A>>;
      } finally {
        setExecuting(false);
      }
    },
    [action],
  );
  return { executeAsync, isExecuting, isPending: isExecuting };
}
