import { Space_Grotesk, JetBrains_Mono, Playfair_Display, Oswald } from "next/font/google";

// Fontes exclusivas dos layouts do Desenvolvedor. next/font só baixa o arquivo
// no navegador quando algum elemento realmente usa a font-family — como os
// outros cargos nunca aplicam essas variáveis, o custo pra eles é zero.
export const devFontGlass = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-dev-glass" });
export const devFontMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-dev-mono" });
export const devFontSerif = Playfair_Display({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-dev-serif" });
export const devFontIndustrial = Oswald({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-dev-industrial" });

export const DEV_FONT_VARIABLES = `${devFontGlass.variable} ${devFontMono.variable} ${devFontSerif.variable} ${devFontIndustrial.variable}`;
