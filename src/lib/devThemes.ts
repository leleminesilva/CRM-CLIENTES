export type DevThemeId =
  | "padrao"
  | "vidro-luz"
  | "painel-comando"
  | "editorial-premium"
  | "blueprint"
  | "aco-cobre";

export interface DevTheme {
  id: DevThemeId;
  label: string;
  tagline: string;
  emoji: string;
  fontVar: string;               // CSS var holding the display font-family for this theme
  fontMono: boolean;              // KPI values / data use monospace
  cardFacet: boolean;             // cut-corner (clip-path) cards vs plain square corners
  cardBlur: boolean;              // glass blur panels vs flat panels
  eyebrow: string;                // small label shown above "Dashboard Executivo"
  sidebarBg: string;              // css background
  sidebarBorder: string;
  sidebarEdge?: string;           // gradient line on the sidebar's right edge
  navActiveBg: string;
  navIndicator?: string;          // gradient for the active nav item's left bar
  navHoverBg: string;
  text: string;
  muted: string;
  topbarBg: string;
  avatarBg: string;
  roleColor: string;
  pageBg: string;
  ambientGlow?: string;
  cardBg: string;
  cardBorder: string;
  eyebrowColor: string;
  totalLineColor: string;
  pieColors: string[];
  vendorColors: string[];
  serviceColors: string[];
  kpiAccentDefault: string;
  kpiAccentMap?: Record<string, string>;
}

export const DEV_THEMES: Record<DevThemeId, DevTheme> = {
  // Não sobrescreve nenhuma variável global — é o visual atual do CRM,
  // igual pros outros cargos. Serve pra voltar ao normal com 1 clique.
  padrao: {
    id: "padrao",
    label: "Padrão",
    tagline: "O visual atual do CRM — o mesmo que os outros cargos usam",
    emoji: "⚪️",
    fontVar: "inherit",
    fontMono: false,
    cardFacet: false,
    cardBlur: false,
    eyebrow: "",
    sidebarBg: "#0a0e17",
    sidebarBorder: "rgba(255,255,255,0.08)",
    navActiveBg: "rgba(99,102,241,0.18)",
    navIndicator: "#6366f1",
    navHoverBg: "rgba(255,255,255,0.04)",
    text: "#e5e7eb",
    muted: "#9ca3af",
    topbarBg: "rgba(10,14,23,0.9)",
    avatarBg: "#4f46e5",
    roleColor: "#818cf8",
    pageBg: "#0a0e17",
    cardBg: "#111624",
    cardBorder: "rgba(255,255,255,0.08)",
    eyebrowColor: "#818cf8",
    totalLineColor: "#ef4444",
    pieColors: ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"],
    vendorColors: ["#6366f1", "#10b981", "#f59e0b", "#3b82f6", "#f97316", "#ec4899"],
    serviceColors: ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#f97316", "#ec4899", "#8b5cf6", "#14b8a6"],
    kpiAccentDefault: "#6366f1",
  },

  "vidro-luz": {
    id: "vidro-luz",
    label: "Vidro & Luz",
    tagline: "Cantos facetados e luz prismática — a identidade da Infinity Glass",
    emoji: "💎",
    fontVar: "var(--font-dev-glass)",
    fontMono: true,
    cardFacet: true,
    cardBlur: true,
    eyebrow: "Painel exclusivo · Desenvolvedor",
    sidebarBg: "linear-gradient(180deg,#0d111c,#10141f)",
    sidebarBorder: "rgba(255,255,255,0.08)",
    sidebarEdge: "linear-gradient(180deg, transparent, #4f8dff 18%, #a855f7 50%, #22d3ee 82%, transparent)",
    navActiveBg: "linear-gradient(90deg, rgba(79,141,255,0.2), rgba(168,85,247,0.1))",
    navIndicator: "linear-gradient(180deg,#4f8dff,#a855f7)",
    navHoverBg: "rgba(255,255,255,0.04)",
    text: "#e8ecf5",
    muted: "#7b869e",
    topbarBg: "rgba(13,17,28,0.85)",
    avatarBg: "linear-gradient(135deg,#4f8dff,#a855f7)",
    roleColor: "#22d3ee",
    pageBg: "#060810",
    ambientGlow:
      "radial-gradient(680px 420px at 14% -6%, rgba(79,141,255,0.14), transparent 60%), " +
      "radial-gradient(560px 380px at 88% 8%, rgba(168,85,247,0.10), transparent 60%), " +
      "radial-gradient(520px 360px at 60% 100%, rgba(34,211,238,0.06), transparent 60%)",
    cardBg: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(255,255,255,0.1)",
    eyebrowColor: "#22d3ee",
    totalLineColor: "#4f8dff",
    pieColors: ["#4f8dff", "#a855f7", "#22d3ee", "#34d399", "#fbbf24", "#fb7185"],
    vendorColors: ["#4f8dff", "#22d3ee", "#fbbf24", "#a855f7", "#34d399", "#fb7185"],
    serviceColors: ["#4f8dff", "#22d3ee", "#34d399", "#fbbf24", "#fb923c", "#fb7185", "#a855f7", "#c084fc"],
    kpiAccentDefault: "linear-gradient(90deg,#4f8dff,#a855f7)",
    kpiAccentMap: {
      "bg-indigo-500":  "linear-gradient(90deg,#4f8dff,#a855f7)",
      "bg-violet-500":  "linear-gradient(90deg,#a855f7,#c084fc)",
      "bg-blue-500":    "linear-gradient(90deg,#4f8dff,#22d3ee)",
      "bg-emerald-500": "linear-gradient(90deg,#22d3ee,#34d399)",
      "bg-green-500":   "linear-gradient(90deg,#34d399,#4ade80)",
      "bg-amber-500":   "linear-gradient(90deg,#fbbf24,#fb923c)",
      "bg-orange-500":  "linear-gradient(90deg,#fb923c,#fb7185)",
      "bg-rose-500":    "linear-gradient(90deg,#fb7185,#f43f5e)",
      "bg-red-500":     "linear-gradient(90deg,#f43f5e,#dc2626)",
      "bg-red-700":     "linear-gradient(90deg,#dc2626,#991b1b)",
    },
  },

  "painel-comando": {
    id: "painel-comando",
    label: "Painel de Comando",
    tagline: "Denso, monoespaçado, verde-lima — feito pra quem vive no terminal",
    emoji: "🖥️",
    fontVar: "var(--font-dev-mono)",
    fontMono: true,
    cardFacet: false,
    cardBlur: false,
    eyebrow: "// dashboard_executivo",
    sidebarBg: "#0c0d0f",
    sidebarBorder: "rgba(255,255,255,0.07)",
    navActiveBg: "rgba(157,255,87,0.08)",
    navIndicator: "#9dff57",
    navHoverBg: "rgba(255,255,255,0.03)",
    text: "#e6e8e3",
    muted: "#767d73",
    topbarBg: "rgba(8,9,11,0.9)",
    avatarBg: "#9dff57",
    roleColor: "#9dff57",
    pageBg: "#08090b",
    cardBg: "#0c0d0f",
    cardBorder: "rgba(255,255,255,0.08)",
    eyebrowColor: "#9dff57",
    totalLineColor: "#9dff57",
    pieColors: ["#9dff57", "#5ec8ff", "#ffb454", "#ff5c5c", "#c792ea", "#6ee7b7"],
    vendorColors: ["#9dff57", "#5ec8ff", "#ffb454", "#ff5c5c", "#c792ea", "#6ee7b7"],
    serviceColors: ["#9dff57", "#5ec8ff", "#ffb454", "#ff5c5c", "#c792ea", "#6ee7b7", "#f472b6", "#38bdf8"],
    kpiAccentDefault: "#9dff57",
  },

  "editorial-premium": {
    id: "editorial-premium",
    label: "Editorial Premium",
    tagline: "Serifado, espaçoso, dourado — sensação de produto caro",
    emoji: "🥃",
    fontVar: "var(--font-dev-serif)",
    fontMono: false,
    cardFacet: false,
    cardBlur: false,
    eyebrow: "Visão executiva",
    sidebarBg: "#1c1712",
    sidebarBorder: "rgba(255,255,255,0.08)",
    navActiveBg: "rgba(201,168,106,0.14)",
    navIndicator: "#c9a86a",
    navHoverBg: "rgba(255,255,255,0.03)",
    text: "#f3ede2",
    muted: "#9c9184",
    topbarBg: "rgba(21,17,13,0.9)",
    avatarBg: "#c9a86a",
    roleColor: "#c9a86a",
    pageBg: "#15110d",
    cardBg: "#1c1712",
    cardBorder: "rgba(255,255,255,0.08)",
    eyebrowColor: "#c9a86a",
    totalLineColor: "#c9a86a",
    pieColors: ["#c9a86a", "#8fa583", "#9c5b4a", "#6b8caf", "#a67c52", "#7d8471"],
    vendorColors: ["#c9a86a", "#8fa583", "#9c5b4a", "#6b8caf", "#a67c52", "#7d8471"],
    serviceColors: ["#c9a86a", "#8fa583", "#9c5b4a", "#6b8caf", "#a67c52", "#7d8471", "#b08968", "#5f7161"],
    kpiAccentDefault: "#c9a86a",
  },

  // Planta técnica — mede-se vidro em milímetros, e um projeto de vidraçaria
  // sempre passa por uma prancha de desenho técnico antes de virar peça.
  blueprint: {
    id: "blueprint",
    label: "Blueprint",
    tagline: "Prancheta de projeto — grade técnica e linhas de cota em ciano",
    emoji: "📐",
    fontVar: "var(--font-dev-mono)",
    fontMono: true,
    cardFacet: false,
    cardBlur: false,
    eyebrow: "ESC 1:1 · vista técnica",
    sidebarBg: "#0a1f33",
    sidebarBorder: "rgba(224,242,255,0.14)",
    navActiveBg: "rgba(56,189,248,0.16)",
    navIndicator: "#38bdf8",
    navHoverBg: "rgba(224,242,255,0.05)",
    text: "#e0f2ff",
    muted: "#7fa8c9",
    topbarBg: "rgba(10,31,51,0.9)",
    avatarBg: "#38bdf8",
    roleColor: "#38bdf8",
    pageBg: "#081a2b",
    ambientGlow:
      "repeating-linear-gradient(0deg, rgba(224,242,255,0.035) 0px, rgba(224,242,255,0.035) 1px, transparent 1px, transparent 32px), " +
      "repeating-linear-gradient(90deg, rgba(224,242,255,0.035) 0px, rgba(224,242,255,0.035) 1px, transparent 1px, transparent 32px)",
    cardBg: "#0a1f33",
    cardBorder: "rgba(224,242,255,0.16)",
    eyebrowColor: "#38bdf8",
    totalLineColor: "#38bdf8",
    pieColors: ["#38bdf8", "#e0f2ff", "#7fa8c9", "#facc15", "#fb923c", "#4ade80"],
    vendorColors: ["#38bdf8", "#e0f2ff", "#facc15", "#7fa8c9", "#4ade80", "#fb923c"],
    serviceColors: ["#38bdf8", "#e0f2ff", "#7fa8c9", "#facc15", "#fb923c", "#4ade80", "#c4b5fd", "#f472b6"],
    kpiAccentDefault: "#38bdf8",
  },

  // Oficina — o lado industrial da vidraçaria: perfis de alumínio, ferragem
  // de cobre, chapa escovada. Tipografia condensada e pesada, sem enfeite.
  "aco-cobre": {
    id: "aco-cobre",
    label: "Aço & Cobre",
    tagline: "Industrial e robusto — perfis de alumínio e ferragem de cobre",
    emoji: "🔩",
    fontVar: "var(--font-dev-industrial)",
    fontMono: false,
    cardFacet: false,
    cardBlur: false,
    eyebrow: "OFICINA · DESENVOLVEDOR",
    sidebarBg: "#17181a",
    sidebarBorder: "rgba(201,121,63,0.18)",
    navActiveBg: "rgba(201,121,63,0.16)",
    navIndicator: "#c9793f",
    navHoverBg: "rgba(255,255,255,0.04)",
    text: "#ece8e3",
    muted: "#8a8f94",
    topbarBg: "rgba(23,24,26,0.92)",
    avatarBg: "#c9793f",
    roleColor: "#c9793f",
    pageBg: "#131415",
    cardBg: "#1b1c1e",
    cardBorder: "rgba(255,255,255,0.08)",
    eyebrowColor: "#c9793f",
    totalLineColor: "#c9793f",
    pieColors: ["#c9793f", "#8a8f94", "#5a6268", "#d4a24c", "#a1a8ad", "#7a4a2a"],
    vendorColors: ["#c9793f", "#8a8f94", "#d4a24c", "#5a6268", "#a1a8ad", "#7a4a2a"],
    serviceColors: ["#c9793f", "#8a8f94", "#5a6268", "#d4a24c", "#a1a8ad", "#7a4a2a", "#e2b877", "#4a4d50"],
    kpiAccentDefault: "#c9793f",
  },
};

export const DEV_THEME_LIST = Object.values(DEV_THEMES);
export const DEFAULT_DEV_THEME: DevThemeId = "padrao";
