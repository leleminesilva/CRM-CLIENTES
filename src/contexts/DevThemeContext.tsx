"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DEV_THEMES, DEFAULT_DEV_THEME, type DevThemeId, type DevTheme } from "@/lib/devThemes";

interface DevThemeContextType {
  // isThemed = usuário escolheu um layout diferente de "Padrão" — é essa a
  // flag que os componentes devem checar antes de aplicar qualquer estilo do tema.
  isThemed: boolean;
  themeId: DevThemeId;
  theme: DevTheme;
  setThemeId: (id: DevThemeId) => void;
}

const DevThemeContext = createContext<DevThemeContextType>({
  isThemed: false,
  themeId: DEFAULT_DEV_THEME,
  theme: DEV_THEMES[DEFAULT_DEV_THEME],
  setThemeId: () => {},
});

export function DevThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [themeId, setThemeIdState] = useState<DevThemeId>(DEFAULT_DEV_THEME);

  // Cada usuário guarda a própria escolha de layout, localmente.
  useEffect(() => {
    if (!user?.id) return;
    const saved = localStorage.getItem(`devTheme_${user.id}`);
    if (saved && saved in DEV_THEMES) setThemeIdState(saved as DevThemeId);
  }, [user?.id]);

  function setThemeId(id: DevThemeId) {
    setThemeIdState(id);
    if (user?.id) localStorage.setItem(`devTheme_${user.id}`, id);
  }

  const isThemed = themeId !== "padrao";

  return (
    <DevThemeContext.Provider value={{ isThemed, themeId, theme: DEV_THEMES[themeId], setThemeId }}>
      {children}
    </DevThemeContext.Provider>
  );
}

export function useDevTheme() {
  return useContext(DevThemeContext);
}

// Marca a árvore com data-dev-theme, que os overrides de variáveis CSS em
// globals.css usam pra recolorir o app inteiro (não só o Dashboard).
export function DevThemeRoot({ children, className }: { children: React.ReactNode; className?: string }) {
  const { isThemed, themeId } = useDevTheme();
  return (
    <div className={className} data-dev-theme={isThemed ? themeId : undefined}>
      {children}
    </div>
  );
}
