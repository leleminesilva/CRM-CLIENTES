"use client";

import * as React from "react";

const noopSubscribe = () => () => {};

/** true só no navegador, depois da hidratação (sem setState em effect). */
export function useIsClient(): boolean {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Resultado de uma media query, reativo. No servidor assume `serverValue`. */
export function useMediaQuery(query: string, serverValue = true): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

const LOCAL_EVENT = "cg:local-storage";

/** Valor booleano persistido no localStorage, sincronizado entre componentes e abas. */
export function useLocalStorageFlag(key: string): [boolean, (value: boolean) => void] {
  const subscribe = React.useCallback((onChange: () => void) => {
    window.addEventListener("storage", onChange);
    window.addEventListener(LOCAL_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(LOCAL_EVENT, onChange);
    };
  }, []);
  const read = () => {
    try {
      return window.localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  };
  const value = React.useSyncExternalStore(subscribe, read, () => false);
  const set = React.useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // Armazenamento indisponível (aba privada): o valor não persiste.
      }
      window.dispatchEvent(new Event(LOCAL_EVENT));
    },
    [key],
  );
  return [value, set];
}
