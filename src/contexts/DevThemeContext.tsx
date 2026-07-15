"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DEV_THEMES, DEFAULT_DEV_THEME, type DevThemeId, type DevTheme } from "@/lib/devThemes";

interface DevThemeContextType {
  isDev: boolean;
  themeId: DevThemeId;
  theme: DevTheme;
  setThemeId: (id: DevThemeId) => void;
}

const DevThemeContext = createContext<DevThemeContextType>({
  isDev: false,
  themeId: DEFAULT_DEV_THEME,
  theme: DEV_THEMES[DEFAULT_DEV_THEME],
  setThemeId: () => {},
});

export function DevThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isDev = user?.role === "DESENVOLVEDOR";
  const [themeId, setThemeIdState] = useState<DevThemeId>(DEFAULT_DEV_THEME);

  // Cada Desenvolvedor guarda a própria escolha de layout, localmente.
  useEffect(() => {
    if (!user?.id) return;
    const saved = localStorage.getItem(`devTheme_${user.id}`);
    if (saved && saved in DEV_THEMES) setThemeIdState(saved as DevThemeId);
  }, [user?.id]);

  function setThemeId(id: DevThemeId) {
    setThemeIdState(id);
    if (user?.id) localStorage.setItem(`devTheme_${user.id}`, id);
  }

  return (
    <DevThemeContext.Provider value={{ isDev, themeId, theme: DEV_THEMES[themeId], setThemeId }}>
      {children}
    </DevThemeContext.Provider>
  );
}

export function useDevTheme() {
  return useContext(DevThemeContext);
}
