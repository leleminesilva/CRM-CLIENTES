import localFont from "next/font/local";

// Fontes exclusivas dos layouts do Desenvolvedor, hospedadas no projeto (pacotes @fontsource): o build
// não depende do Google Fonts. next/font só baixa o arquivo no navegador quando algum elemento realmente
// usa a font-family — como os outros cargos nunca aplicam essas variáveis, o custo pra eles é zero.
export const devFontGlass = localFont({
  src: [
    { path: "../../node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-dev-glass",
});
export const devFontMono = localFont({
  src: [
    { path: "../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-dev-mono",
});
export const devFontSerif = localFont({
  src: [
    { path: "../../node_modules/@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/playfair-display/files/playfair-display-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-dev-serif",
});
export const devFontIndustrial = localFont({
  src: [
    { path: "../../node_modules/@fontsource/oswald/files/oswald-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/oswald/files/oswald-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-dev-industrial",
});

export const DEV_FONT_VARIABLES = `${devFontGlass.variable} ${devFontMono.variable} ${devFontSerif.variable} ${devFontIndustrial.variable}`;
