export type DevThemeId = "vidro-luz" | "painel-comando" | "editorial-premium";

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
};

export const DEV_THEME_LIST = Object.values(DEV_THEMES);
export const DEFAULT_DEV_THEME: DevThemeId = "vidro-luz";
