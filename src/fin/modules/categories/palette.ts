/**
 * Cores de identidade das categorias (só em ícones e chips — nunca em gráficos, ver DS §2.2).
 * O chip mistura a cor com a tinta do tema, então o mesmo hex funciona no claro e no escuro.
 */
export const CATEGORY_COLORS = [
  { hex: "#2a78d6", name: "Azul" },
  { hex: "#eb6834", name: "Laranja" },
  { hex: "#1baf7a", name: "Verde-água" },
  { hex: "#eda100", name: "Amarelo" },
  { hex: "#e87ba4", name: "Rosa" },
  { hex: "#008300", name: "Verde" },
  { hex: "#4a3aa7", name: "Violeta" },
  { hex: "#e34948", name: "Vermelho" },
  { hex: "#0e8a96", name: "Petróleo" },
  { hex: "#6b7a73", name: "Grafite" },
] as const;

export const CATEGORY_COLOR_HEXES = CATEGORY_COLORS.map((c) => c.hex) as [string, ...string[]];
